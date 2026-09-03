import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { WorkflowFailedError, WorkflowNotFoundError } from "@temporalio/client";
import { getTemporalClient } from "../../temporal/client";
import { config } from "../../config/env";
import { hotelSearchWorkflow } from "../../workflows/hotelSearch.workflow";
import {
  HotelSearchRequest,
  SearchApiResponse,
} from "../../types/hotel";

export interface SearchValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates search request parameters according to specifications:
 * - city required
 * - checkIn required (YYYY-MM-DD)
 * - checkOut required (YYYY-MM-DD)
 * - checkOut > checkIn
 */
export function validateSearchRequest(body: unknown): SearchValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Validation error: Request body is required" };
  }

  const { city, checkIn, checkOut } = body as Record<string, unknown>;

  if (typeof city !== "string" || !city.trim()) {
    return { valid: false, error: "Validation error: 'city' is required" };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (typeof checkIn !== "string" || !dateRegex.test(checkIn) || isNaN(Date.parse(checkIn))) {
    return {
      valid: false,
      error: "Validation error: 'checkIn' is required in YYYY-MM-DD format",
    };
  }

  if (typeof checkOut !== "string" || !dateRegex.test(checkOut) || isNaN(Date.parse(checkOut))) {
    return {
      valid: false,
      error: "Validation error: 'checkOut' is required in YYYY-MM-DD format",
    };
  }

  const checkInTime = new Date(checkIn).getTime();
  const checkOutTime = new Date(checkOut).getTime();

  if (checkOutTime <= checkInTime) {
    return {
      valid: false,
      error: "Validation error: 'checkOut' must be strictly after 'checkIn'",
    };
  }

  return { valid: true };
}

/**
 * Controller: POST /api/search-hotels
 * Orchestrates hotel search via Temporal Workflow without calling suppliers directly.
 */
export async function searchHotels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validation = validateSearchRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const {
      city,
      checkIn,
      checkOut,
      workflowId: clientWorkflowId,
      behavior,
      supplierABehavior,
      supplierBBehavior,
    } = req.body as HotelSearchRequest;

    const workflowId = clientWorkflowId?.trim() || `hotel-search-${randomUUID()}`;
    const client = await getTemporalClient();

    try {
      const result = await client.workflow.execute(hotelSearchWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId,
        args: [
          {
            city: city.trim(),
            checkIn,
            checkOut,
            behavior,
            supplierABehavior,
            supplierBBehavior,
          },
        ],
      });

      // Handle 404: No hotels found
      if (result.status === "NO_HOTELS_FOUND" || !result.cheapestHotel) {
        res.status(404).json({
          error: "No hotels found for the requested criteria",
          workflowId,
        });
        return;
      }

      // Handle 200: Successful best rate found
      const response: SearchApiResponse = {
        workflowId,
        hotelId: result.cheapestHotel.hotelId,
        name: result.cheapestHotel.name,
        price: result.cheapestHotel.price,
        supplier: result.cheapestHotel.supplier,
        status: result.status,
      };

      res.status(200).json(response);
    } catch (workflowErr) {
      // Map Temporal workflow errors
      if (workflowErr instanceof WorkflowFailedError) {
        const message = workflowErr.cause?.message || workflowErr.message;

        if (
          message.includes("Both suppliers failed") ||
          message.includes("ALL_SUPPLIERS_FAILED")
        ) {
          res.status(502).json({
            error: "Both suppliers failed to provide hotel rates",
            workflowId,
          });
          return;
        }

        if (workflowErr.cause?.name === "CancelledFailure" || message.includes("cancelled")) {
          res.status(499).json({
            error: "Search workflow was cancelled",
            workflowId,
          });
          return;
        }
      }

      console.error(`[Search Workflow Error] ID: ${workflowId}`, workflowErr);
      res.status(500).json({
        error: "Failed to process hotel search workflow",
        workflowId,
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: POST /api/search-hotels/:workflowId/cancel
 * Requests graceful cancellation of an in-flight search workflow.
 */
export async function cancelSearch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { workflowId } = req.params;

    if (!workflowId || !workflowId.trim()) {
      res.status(400).json({ error: "Validation error: 'workflowId' is required" });
      return;
    }

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId.trim());

    try {
      await handle.cancel();
      res.status(200).json({
        message: "Workflow cancellation requested",
        workflowId,
      });
    } catch (cancelErr) {
      if (
        cancelErr instanceof WorkflowNotFoundError ||
        (cancelErr instanceof Error && cancelErr.name === "WorkflowNotFoundError") ||
        (cancelErr instanceof Error && cancelErr.message.includes("not found in mutable state"))
      ) {
        res.status(404).json({
          error: `Workflow with ID '${workflowId}' not found or already completed`,
          workflowId,
        });
        return;
      }
      console.error(`[Cancel Workflow Error] ID: ${workflowId}`, cancelErr);
      res.status(500).json({
        error: "Failed to cancel workflow",
        workflowId,
      });
    }
  } catch (err) {
    next(err);
  }
}
