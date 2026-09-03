import { Request, Response, NextFunction } from "express";
import {
  validateSupplierParams,
  executeSupplierA,
  executeSupplierB,
  SupplierError,
} from "../../suppliers";

/**
 * Controller for GET /supplierA/hotels
 */
export async function getSupplierAHotels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { city, checkIn, checkOut, behavior } = req.query;

    const validation = validateSupplierParams(city, checkIn, checkOut);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const response = await executeSupplierA({
      city: String(city),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      behavior,
    });

    res.status(200).json(response);
  } catch (err) {
    if (err instanceof SupplierError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
}

/**
 * Controller for GET /supplierB/hotels
 */
export async function getSupplierBHotels(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { city, checkIn, checkOut, behavior } = req.query;

    const validation = validateSupplierParams(city, checkIn, checkOut);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const response = await executeSupplierB({
      city: String(city),
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      behavior,
    });

    res.status(200).json(response);
  } catch (err) {
    if (err instanceof SupplierError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
}
