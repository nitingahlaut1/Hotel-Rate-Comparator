import { Context } from "@temporalio/activity";
import { HotelSearchRequest, SupplierResponse, Hotel } from "../types/hotel";
import { config } from "../config/env";

/**
 * Activity: searchSupplierB
 * Calls the Supplier B HTTP API (GET /supplierB/hotels).
 * Supports cancellation via Context.current().cancellationSignal.
 */
export async function searchSupplierB(
  request: HotelSearchRequest,
): Promise<SupplierResponse> {
  let signal: AbortSignal | undefined;

  try {
    const activityContext = Context.current();
    signal = activityContext.cancellationSignal;
  } catch {
    // Graceful fallback when invoked outside of active activity worker context
  }

  if (signal?.aborted) {
    throw new Error("Activity cancelled before execution");
  }

  const baseUrl =
    process.env["SUPPLIER_B_URL"] ||
    `http://localhost:${config.port}/supplierB/hotels`;

  const behavior = request.supplierBBehavior || request.behavior;

  const queryParams = new URLSearchParams({
    city: request.city,
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    ...(behavior ? { behavior } : {}),
  });

  const targetUrl = `${baseUrl}?${queryParams.toString()}`;

  const response = await fetch(targetUrl, { signal });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = (await response.json()) as { error?: string };
      if (errorJson.error) {
        errorDetail = errorJson.error;
      }
    } catch {
      // Body was not JSON
    }
    throw new Error(`Supplier B returned HTTP ${response.status}: ${errorDetail}`);
  }

  const data = (await response.json()) as {
    hotels: Array<{ hotelId: string; name: string; price: number; supplier?: "A" | "B" }>;
  };

  const hotels: Hotel[] = data.hotels.map((h) => ({
    hotelId: h.hotelId,
    name: h.name,
    price: h.price,
    supplier: "B",
  }));

  return { hotels };
}
