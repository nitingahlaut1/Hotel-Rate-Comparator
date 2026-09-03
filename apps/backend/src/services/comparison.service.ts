import {
  Hotel,
  SupplierExecutionResult,
  WorkflowExecutionStatus,
} from "../types/hotel";

export interface ComparisonResult {
  cheapestHotel: Hotel | null;
  status: WorkflowExecutionStatus;
}

/**
 * Deterministic hotel price comparison.
 *
 * Rules:
 * 1. Ignore failed suppliers.
 * 2. Ignore empty supplier results.
 * 3. Find the cheapest hotel across successful suppliers.
 * 4. If prices are equal, choose Supplier A (deterministic tie-breaker).
 * 5. If both suppliers fail, throw an appropriate error.
 * 6. If both suppliers return empty arrays, return "NO_HOTELS_FOUND".
 */
export function compareSupplierResults(supplierResults: {
  supplierA: SupplierExecutionResult;
  supplierB: SupplierExecutionResult;
}): ComparisonResult {
  const { supplierA, supplierB } = supplierResults;

  // Rule 5: If both suppliers fail, throw an error
  if (!supplierA.success && !supplierB.success) {
    const errorA = supplierA.error || "Activity failed";
    const errorB = supplierB.error || "Activity failed";
    throw new Error(`Both suppliers failed to provide hotel rates. Supplier A: ${errorA}; Supplier B: ${errorB}`);
  }

  // Filter valid candidate hotels from successful suppliers
  const hotelsA = supplierA.success && Array.isArray(supplierA.hotels) ? supplierA.hotels : [];
  const hotelsB = supplierB.success && Array.isArray(supplierB.hotels) ? supplierB.hotels : [];

  // Rule 6: If all successful suppliers returned empty arrays
  if (hotelsA.length === 0 && hotelsB.length === 0) {
    return {
      cheapestHotel: null,
      status: "NO_HOTELS_FOUND",
    };
  }

  // Determine workflow execution status
  const isPartial = !supplierA.success || !supplierB.success;
  const status: WorkflowExecutionStatus = isPartial ? "PARTIAL_SUCCESS" : "SUCCESS";

  let bestHotel: Hotel | null = null;

  // 1. Process Supplier A hotels first
  for (const hotel of hotelsA) {
    if (!bestHotel || hotel.price < bestHotel.price) {
      bestHotel = hotel;
    }
  }

  // 2. Process Supplier B hotels:
  // Must be strictly less than bestHotel.price to beat Supplier A (Rule 4 tie-breaker)
  for (const hotel of hotelsB) {
    if (!bestHotel || hotel.price < bestHotel.price) {
      bestHotel = hotel;
    }
  }

  return {
    cheapestHotel: bestHotel,
    status,
  };
}
