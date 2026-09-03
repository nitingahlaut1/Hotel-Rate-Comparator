import {
  proxyActivities,
  isCancellation,
  ApplicationFailure,
} from "@temporalio/workflow";
import type * as activities from "../activities";
import {
  HotelSearchRequest,
  HotelSearchWorkflowResult,
  SupplierExecutionResult,
} from "../types/hotel";
import { compareSupplierResults } from "../services/comparison.service";

/**
 * Configure supplier activities with required timeouts and native retry policy.
 * - startToCloseTimeout: 5 seconds
 * - retry: initialInterval 500ms, backoffCoefficient 2, maximumInterval 5s, maximumAttempts 3
 */
const { searchSupplierA, searchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5s",
  retry: {
    initialInterval: "500ms",
    backoffCoefficient: 2,
    maximumInterval: "5s",
    maximumAttempts: 3,
  },
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if ("cause" in err && err.cause instanceof Error) {
      return `${err.message}: ${err.cause.message}`;
    }
    return err.message;
  }
  return String(err);
}

/**
 * Temporal Workflow: hotelSearchWorkflow
 * Orchestrates concurrent supplier queries, handles partial failures and timeouts,
 * respects workflow cancellation, and deterministically compares hotel rates.
 */
export async function hotelSearchWorkflow(
  request: HotelSearchRequest,
): Promise<HotelSearchWorkflowResult> {
  // Execute Supplier A and Supplier B concurrently with independent error isolation
  const [resultA, resultB] = await Promise.all([
    (async (): Promise<SupplierExecutionResult> => {
      try {
        const response = await searchSupplierA(request);
        return {
          success: true,
          hotels: response.hotels,
        };
      } catch (err) {
        // Propagate Temporal cancellation without swallowing
        if (isCancellation(err)) {
          throw err;
        }
        return {
          success: false,
          error: extractErrorMessage(err),
        };
      }
    })(),
    (async (): Promise<SupplierExecutionResult> => {
      try {
        const response = await searchSupplierB(request);
        return {
          success: true,
          hotels: response.hotels,
        };
      } catch (err) {
        // Propagate Temporal cancellation without swallowing
        if (isCancellation(err)) {
          throw err;
        }
        return {
          success: false,
          error: extractErrorMessage(err),
        };
      }
    })(),
  ]);

  const supplierResults = {
    supplierA: resultA,
    supplierB: resultB,
  };

  try {
    // Deterministic price comparison & tie-breaking
    const comparison = compareSupplierResults(supplierResults);

    return {
      cheapestHotel: comparison.cheapestHotel,
      status: comparison.status,
      supplierResults,
      searchRequest: request,
    };
  } catch (err) {
    if (isCancellation(err)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw ApplicationFailure.nonRetryable(message, "ALL_SUPPLIERS_FAILED");
  }
}
