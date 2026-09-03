import request from "supertest";
import app from "../../src/app";
import { resetFailTwiceCounters } from "../../src/suppliers/mockSupplier";

describe("Supplier Mock APIs Integration", () => {
  beforeEach(() => {
    resetFailTwiceCounters();
  });

  describe("Validation (Both Suppliers)", () => {
    it("should return 400 if city is missing", async () => {
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ checkIn: "2026-10-10", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing or invalid 'city'");
    });

    it("should return 400 if checkIn format is invalid", async () => {
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ city: "Dubai", checkIn: "invalid-date", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing or invalid 'checkIn'");
    });

    it("should return 400 if checkOut is before checkIn", async () => {
      const res = await request(app)
        .get("/supplierB/hotels")
        .query({ city: "Dubai", checkIn: "2026-10-15", checkOut: "2026-10-10" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'checkOut' date must be on or after 'checkIn' date");
    });
  });

  describe("Supplier A (/supplierA/hotels)", () => {
    const validParams = {
      city: "Dubai",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
    };

    it("behavior=success: should return normal hotel data with 200", async () => {
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "success" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.hotels)).toBe(true);
      expect(res.body.hotels.length).toBeGreaterThanOrEqual(2);
      expect(res.body.hotels[0].supplier).toBe("A");
      expect(res.body.hotels[0].hotelId).toBe("hotel-a-101");
      expect(res.body.hotels[0].name).toContain("Dubai");
      expect(typeof res.body.hotels[0].price).toBe("number");
    });

    it("behavior=empty: should return empty hotel array with 200", async () => {
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "empty" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hotels: [] });
    });

    it("behavior=error: should return HTTP 500", async () => {
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "error" });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Supplier A Internal Server Error");
    });

    it("behavior=delay: should delay approx 2 seconds and succeed", async () => {
      const start = Date.now();
      const res = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "delay" });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(1900);
      expect(Array.isArray(res.body.hotels)).toBe(true);
    }, 10000);

    it("behavior=fail-twice: first two calls return 500, third call returns 200", async () => {
      // Call 1 -> Fail
      const res1 = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res1.status).toBe(500);
      expect(res1.body.error).toContain("attempt 1 of 2");

      // Call 2 -> Fail
      const res2 = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res2.status).toBe(500);
      expect(res2.body.error).toContain("attempt 2 of 2");

      // Call 3 -> Succeed
      const res3 = await request(app)
        .get("/supplierA/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res3.status).toBe(200);
      expect(Array.isArray(res3.body.hotels)).toBe(true);
      expect(res3.body.hotels.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Supplier B (/supplierB/hotels)", () => {
    const validParams = {
      city: "Dubai",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
    };

    it("behavior=success: should return normal hotel data with 200", async () => {
      const res = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "success" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.hotels)).toBe(true);
      expect(res.body.hotels.length).toBeGreaterThanOrEqual(2);
      expect(res.body.hotels[0].supplier).toBe("B");
      expect(res.body.hotels[0].hotelId).toBe("hotel-b-101");
      expect(res.body.hotels[0].name).toContain("Dubai");
      expect(typeof res.body.hotels[0].price).toBe("number");
    });

    it("behavior=empty: should return empty hotel array with 200", async () => {
      const res = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "empty" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hotels: [] });
    });

    it("behavior=error: should return HTTP 500", async () => {
      const res = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "error" });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Supplier B Internal Server Error");
    });

    it("behavior=delay: should delay approx 2 seconds and succeed", async () => {
      const start = Date.now();
      const res = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "delay" });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeGreaterThanOrEqual(1900);
      expect(Array.isArray(res.body.hotels)).toBe(true);
    }, 10000);

    it("behavior=fail-twice: first two calls return 500, third call returns 200", async () => {
      // Call 1 -> Fail
      const res1 = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res1.status).toBe(500);
      expect(res1.body.error).toContain("attempt 1 of 2");

      // Call 2 -> Fail
      const res2 = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res2.status).toBe(500);
      expect(res2.body.error).toContain("attempt 2 of 2");

      // Call 3 -> Succeed
      const res3 = await request(app)
        .get("/supplierB/hotels")
        .query({ ...validParams, behavior: "fail-twice" });
      expect(res3.status).toBe(200);
      expect(Array.isArray(res3.body.hotels)).toBe(true);
      expect(res3.body.hotels.length).toBeGreaterThanOrEqual(2);
    });
  });
});
