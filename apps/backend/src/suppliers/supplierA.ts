import { Hotel, SupplierResponse } from "../types/hotel";
import {
  parseBehavior,
  sleep,
  getFailTwiceAttempt,
} from "./mockSupplier";

export interface SupplierServiceOptions {
  city: string;
  checkIn: string;
  checkOut: string;
  behavior?: unknown;
}

export class SupplierError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "SupplierError";
  }
}

/**
 * Generates deterministic hotel list for Supplier A.
 */
export function getSupplierAHotelsData(city: string): Hotel[] {
  const cityFormatted = city.trim();
  const lower = cityFormatted.toLowerCase();

  let basePrice = 120;
  if (lower === "dubai") basePrice = 120;
  else if (lower === "paris") basePrice = 160;
  else if (lower === "tokyo") basePrice = 140;
  else if (lower === "new york") basePrice = 190;
  else if (lower === "london") basePrice = 150;
  else if (lower === "tie" || lower === "samerate") basePrice = 100;

  return [
    {
      hotelId: "hotel-a-101",
      name: `Grand ${cityFormatted} Hotel`,
      price: basePrice,
      supplier: "A",
    },
    {
      hotelId: "hotel-a-102",
      name: `${cityFormatted} Palace`,
      price: basePrice + 30,
      supplier: "A",
    },
  ];
}

/**
 * Supplier A business service.
 * Handles behavior modes: success, delay, slow, empty, error, fail-twice.
 */
export async function executeSupplierA(
  options: SupplierServiceOptions,
): Promise<SupplierResponse> {
  const { city, checkIn, checkOut } = options;
  const behavior = parseBehavior(options.behavior, city);

  switch (behavior) {
    case "error":
      throw new SupplierError("Supplier A Internal Server Error", 500);

    case "empty":
      return { hotels: [] };

    case "delay":
      // Delay approximately 2 seconds and return successfully
      await sleep(2000);
      return { hotels: getSupplierAHotelsData(city) };

    case "slow":
      // Delay approximately 6 seconds (> 5s Temporal activity timeout)
      await sleep(6000);
      return { hotels: getSupplierAHotelsData(city) };

    case "fail-twice": {
      const key = `A:${city.toLowerCase()}:${checkIn}:${checkOut}`;
      const attempt = getFailTwiceAttempt(key);

      if (attempt <= 2) {
        throw new SupplierError(
          `Supplier A simulated failure (attempt ${attempt} of 2)`,
          500,
        );
      }

      // 3rd attempt onwards succeeds
      return { hotels: getSupplierAHotelsData(city) };
    }

    case "success":
    default:
      return { hotels: getSupplierAHotelsData(city) };
  }
}
