import { SupplierBehavior } from "../types/hotel";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates city, checkIn, and checkOut query parameters.
 */
export function validateSupplierParams(
  city: unknown,
  checkIn: unknown,
  checkOut: unknown,
): ValidationResult {
  if (typeof city !== "string" || !city.trim()) {
    return { valid: false, error: "Missing or invalid 'city' parameter" };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (typeof checkIn !== "string" || !dateRegex.test(checkIn) || isNaN(Date.parse(checkIn))) {
    return {
      valid: false,
      error: "Missing or invalid 'checkIn' parameter. Format must be YYYY-MM-DD",
    };
  }

  if (typeof checkOut !== "string" || !dateRegex.test(checkOut) || isNaN(Date.parse(checkOut))) {
    return {
      valid: false,
      error: "Missing or invalid 'checkOut' parameter. Format must be YYYY-MM-DD",
    };
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkOutDate < checkInDate) {
    return {
      valid: false,
      error: "'checkOut' date must be on or after 'checkIn' date",
    };
  }

  return { valid: true };
}

/**
 * Promise-based delay helper.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * In-memory state tracking for 'fail-twice' behavior.
 * Key: `${supplier}:${city}:${checkIn}:${checkOut}`
 */
const failTwiceCounters = new Map<string, number>();

export function getFailTwiceAttempt(key: string): number {
  const current = failTwiceCounters.get(key) || 0;
  const next = current + 1;
  failTwiceCounters.set(key, next);
  return next;
}

export function resetFailTwiceCounters(): void {
  failTwiceCounters.clear();
}

/**
 * Validates and sanitizes the requested behavior parameter.
 */
export function parseBehavior(behavior: unknown, city?: string): SupplierBehavior {
  const validBehaviors: SupplierBehavior[] = [
    "success",
    "delay",
    "slow",
    "empty",
    "error",
    "fail-twice",
  ];

  if (typeof behavior === "string" && validBehaviors.includes(behavior as SupplierBehavior)) {
    return behavior as SupplierBehavior;
  }

  if (city) {
    const lower = city.toLowerCase();
    if (lower === "nowhere" || lower === "empty") return "empty";
    if (lower === "error" || lower === "fail") return "error";
  }

  return "success";
}
