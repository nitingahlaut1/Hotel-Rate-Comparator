import { MockActivityEnvironment } from "@temporalio/testing";
import { Server } from "http";
import { AddressInfo } from "net";
import app from "../../src/app";
import { searchSupplierA } from "../../src/activities/supplierA.activity";
import { searchSupplierB } from "../../src/activities/supplierB.activity";
import {
  HotelSearchRequest,
  SupplierResponse,
  Hotel,
  SupplierBehavior,
} from "../../src/types/hotel";
import { resetFailTwiceCounters } from "../../src/suppliers/mockSupplier";

describe("Supplier Activities", () => {
  let server: Server;
  const sampleRequest: HotelSearchRequest = {
    city: "Tokyo",
    checkIn: "2026-10-01",
    checkOut: "2026-10-05",
  };

  beforeAll((done) => {
    server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      process.env["SUPPLIER_A_URL"] = `http://localhost:${port}/supplierA/hotels`;
      process.env["SUPPLIER_B_URL"] = `http://localhost:${port}/supplierB/hotels`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.closeAllConnections?.();
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    resetFailTwiceCounters();
  });

  describe("searchSupplierA", () => {
    it("should return successful supplier A response matching contract", async () => {
      const env = new MockActivityEnvironment();
      const result = (await env.run(searchSupplierA, {
        ...sampleRequest,
        behavior: "success" as SupplierBehavior,
      })) as SupplierResponse;

      expect(result).toBeDefined();
      expect(Array.isArray(result.hotels)).toBe(true);
      expect(result.hotels.length).toBeGreaterThan(0);

      result.hotels.forEach((hotel: Hotel) => {
        expect(hotel.supplier).toBe("A");
        expect(typeof hotel.price).toBe("number");
        expect(typeof hotel.hotelId).toBe("string");
        expect(typeof hotel.name).toBe("string");
      });
    });

    it("should return empty response when supplier A returns no hotels", async () => {
      const env = new MockActivityEnvironment();
      const result = (await env.run(searchSupplierA, {
        ...sampleRequest,
        behavior: "empty" as SupplierBehavior,
      })) as SupplierResponse;

      expect(result).toBeDefined();
      expect(result.hotels).toEqual([]);
    });

    it("should throw error when supplier A returns HTTP 500", async () => {
      const env = new MockActivityEnvironment();
      await expect(
        env.run(searchSupplierA, {
          ...sampleRequest,
          behavior: "error" as SupplierBehavior,
        }),
      ).rejects.toThrow(/Supplier A returned HTTP 500/i);
    });

    it("should handle slow response cancellation when signal is aborted", async () => {
      const env = new MockActivityEnvironment();
      env.cancel();

      await expect(
        env.run(searchSupplierA, {
          ...sampleRequest,
          behavior: "slow" as SupplierBehavior,
        }),
      ).rejects.toThrow(/Activity cancelled before execution/i);
    });

    it("should handle fail-twice behavior (attempts 1 & 2 fail, attempt 3 succeeds)", async () => {
      const env = new MockActivityEnvironment();
      const request: HotelSearchRequest = {
        city: "Dubai",
        checkIn: "2026-11-01",
        checkOut: "2026-11-03",
        behavior: "fail-twice",
      };

      // Attempt 1: fails
      await expect(env.run(searchSupplierA, request)).rejects.toThrow(
        /Supplier A returned HTTP 500.*attempt 1/i,
      );

      // Attempt 2: fails
      await expect(env.run(searchSupplierA, request)).rejects.toThrow(
        /Supplier A returned HTTP 500.*attempt 2/i,
      );

      // Attempt 3: succeeds
      const result = (await env.run(searchSupplierA, request)) as SupplierResponse;
      expect(result.hotels.length).toBeGreaterThan(0);
      expect(result.hotels[0]?.supplier).toBe("A");
    });
  });

  describe("searchSupplierB", () => {
    it("should return successful supplier B response matching contract", async () => {
      const env = new MockActivityEnvironment();
      const result = (await env.run(searchSupplierB, {
        ...sampleRequest,
        behavior: "success" as SupplierBehavior,
      })) as SupplierResponse;

      expect(result).toBeDefined();
      expect(Array.isArray(result.hotels)).toBe(true);
      expect(result.hotels.length).toBeGreaterThan(0);

      result.hotels.forEach((hotel: Hotel) => {
        expect(hotel.supplier).toBe("B");
        expect(typeof hotel.price).toBe("number");
        expect(typeof hotel.hotelId).toBe("string");
        expect(typeof hotel.name).toBe("string");
      });
    });

    it("should return empty response when supplier B returns no hotels", async () => {
      const env = new MockActivityEnvironment();
      const result = (await env.run(searchSupplierB, {
        ...sampleRequest,
        behavior: "empty" as SupplierBehavior,
      })) as SupplierResponse;

      expect(result).toBeDefined();
      expect(result.hotels).toEqual([]);
    });

    it("should throw error when supplier B returns HTTP 500", async () => {
      const env = new MockActivityEnvironment();
      await expect(
        env.run(searchSupplierB, {
          ...sampleRequest,
          behavior: "error" as SupplierBehavior,
        }),
      ).rejects.toThrow(/Supplier B returned HTTP 500/i);
    });

    it("should handle slow response cancellation when signal is aborted", async () => {
      const env = new MockActivityEnvironment();
      env.cancel();

      await expect(
        env.run(searchSupplierB, {
          ...sampleRequest,
          behavior: "slow" as SupplierBehavior,
        }),
      ).rejects.toThrow(/Activity cancelled before execution/i);
    });

    it("should handle fail-twice behavior (attempts 1 & 2 fail, attempt 3 succeeds)", async () => {
      const env = new MockActivityEnvironment();
      const request: HotelSearchRequest = {
        city: "Dubai",
        checkIn: "2026-11-01",
        checkOut: "2026-11-03",
        behavior: "fail-twice",
      };

      // Attempt 1: fails
      await expect(env.run(searchSupplierB, request)).rejects.toThrow(
        /Supplier B returned HTTP 500.*attempt 1/i,
      );

      // Attempt 2: fails
      await expect(env.run(searchSupplierB, request)).rejects.toThrow(
        /Supplier B returned HTTP 500.*attempt 2/i,
      );

      // Attempt 3: succeeds
      const result = (await env.run(searchSupplierB, request)) as SupplierResponse;
      expect(result.hotels.length).toBeGreaterThan(0);
      expect(result.hotels[0]?.supplier).toBe("B");
    });
  });
});
