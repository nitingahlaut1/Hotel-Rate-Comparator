import { Hotel, SupplierResponse } from "../types/hotel";
import {
  parseBehavior,
  sleep,
  getFailTwiceAttempt,
} from "./mockSupplier";
import { SupplierError, SupplierServiceOptions } from "./supplierA";

/**
 * Generates deterministic hotel list for Supplier B.
 */
export function getSupplierBHotelsData(city: string): Hotel[] {
  const cityFormatted = city.trim();
  const lower = cityFormatted.toLowerCase();

  let basePrice = 115;
  if (lower === "dubai") basePrice = 115;
  else if (lower === "paris") basePrice = 165;
  else if (lower === "tokyo") basePrice = 135;
  else if (lower === "new york") basePrice = 195;
  else if (lower === "london") basePrice = 145;
  else if (lower === "tie" || lower === "samerate") basePrice = 100;

  return [
    {
      hotelId: "hotel-b-101",
      name: `Grand ${cityFormatted} Hotel`,
      price: basePrice,
      supplier: "B",
    },
    {
      hotelId: "hotel-b-102",
      name: `City View ${cityFormatted}`,
      price: basePrice + 25,
      supplier: "B",
    },
  ];
}

/**
 * Supplier B business service.
 * Handles behavior modes: success, delay, slow, empty, error, fail-twice.
 */
export async function executeSupplierB(
  options: SupplierServiceOptions,
): Promise<SupplierResponse> {
  const { city, checkIn, checkOut } = options;
  const behavior = parseBehavior(options.behavior, city);

  switch (behavior) {
    case "error":
      throw new SupplierError("Supplier B Internal Server Error", 500);

    case "empty":
      return { hotels: [] };

    case "delay":
      // Delay approximately 2 seconds and return successfully
      await sleep(2000);
      return { hotels: getSupplierBHotelsData(city) };

    case "slow":
      // Delay approximately 6 seconds (> 5s Temporal activity timeout)
      await sleep(6000);
      return { hotels: getSupplierBHotelsData(city) };

    case "fail-twice": {
      const key = `B:${city.toLowerCase()}:${checkIn}:${checkOut}`;
      const attempt = getFailTwiceAttempt(key);

      if (attempt <= 2) {
        throw new SupplierError(
          `Supplier B simulated failure (attempt ${attempt} of 2)`,
          500,
        );
      }

      // 3rd attempt onwards succeeds
      return { hotels: getSupplierBHotelsData(city) };
    }

    case "success":
    default:
      return { hotels: getSupplierBHotelsData(city) };
  }
}
