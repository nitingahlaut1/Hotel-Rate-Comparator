import { compareSupplierResults } from "../../src/services/comparison.service";
import { SupplierExecutionResult, Hotel } from "../../src/types/hotel";

describe("Deterministic Price Comparison & Tie-Breaker", () => {
  const hotelA1: Hotel = { hotelId: "a1", name: "Grand Hotel", price: 100, supplier: "A" };
  const hotelA2: Hotel = { hotelId: "a2", name: "Budget Inn", price: 150, supplier: "A" };
  const hotelB1: Hotel = { hotelId: "b1", name: "Plaza Suites", price: 120, supplier: "B" };
  const hotelB2: Hotel = { hotelId: "b2", name: "Resort Stay", price: 100, supplier: "B" };
  const hotelB3: Hotel = { hotelId: "b3", name: "Luxury Bay", price: 90, supplier: "B" };

  describe("Basic Price Comparisons", () => {
    it("should choose Supplier A when Supplier A is cheaper (A=$100, B=$120)", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [hotelA1] };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [hotelB1] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelA1);
      expect(result.cheapestHotel?.supplier).toBe("A");
      expect(result.cheapestHotel?.price).toBe(100);
      expect(result.status).toBe("SUCCESS");
    });

    it("should choose Supplier B when Supplier B is cheaper (A=$120, B=$90)", () => {
      const supplierA: SupplierExecutionResult = {
        success: true,
        hotels: [{ hotelId: "a1", name: "Hotel A", price: 120, supplier: "A" }],
      };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [hotelB3] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelB3);
      expect(result.cheapestHotel?.supplier).toBe("B");
      expect(result.cheapestHotel?.price).toBe(90);
      expect(result.status).toBe("SUCCESS");
    });

    it("should choose Supplier A as deterministic tie-breaker when prices are equal (A=$100, B=$100)", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [hotelA1] }; // price: 100
      const supplierB: SupplierExecutionResult = { success: true, hotels: [hotelB2] }; // price: 100

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelA1);
      expect(result.cheapestHotel?.supplier).toBe("A");
      expect(result.cheapestHotel?.price).toBe(100);
      expect(result.status).toBe("SUCCESS");
    });
  });

  describe("Multiple Hotels per Supplier", () => {
    it("should find the cheapest hotel across multiple hotels (A: [150, 100], B: [120, 110] -> A: 100)", () => {
      const supplierA: SupplierExecutionResult = {
        success: true,
        hotels: [
          { hotelId: "a-1", name: "Hotel 1", price: 150, supplier: "A" },
          { hotelId: "a-2", name: "Hotel 2", price: 100, supplier: "A" },
        ],
      };
      const supplierB: SupplierExecutionResult = {
        success: true,
        hotels: [
          { hotelId: "b-1", name: "Hotel 1", price: 120, supplier: "B" },
          { hotelId: "b-2", name: "Hotel 2", price: 110, supplier: "B" },
        ],
      };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel?.hotelId).toBe("a-2");
      expect(result.cheapestHotel?.price).toBe(100);
      expect(result.cheapestHotel?.supplier).toBe("A");
      expect(result.status).toBe("SUCCESS");
    });

    it("should select Supplier B when B has the cheapest among multiple hotels", () => {
      const supplierA: SupplierExecutionResult = {
        success: true,
        hotels: [
          { hotelId: "a-1", name: "Hotel 1", price: 150, supplier: "A" },
          { hotelId: "a-2", name: "Hotel 2", price: 130, supplier: "A" },
        ],
      };
      const supplierB: SupplierExecutionResult = {
        success: true,
        hotels: [
          { hotelId: "b-1", name: "Hotel 1", price: 140, supplier: "B" },
          { hotelId: "b-2", name: "Hotel 2", price: 95, supplier: "B" },
        ],
      };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel?.hotelId).toBe("b-2");
      expect(result.cheapestHotel?.price).toBe(95);
      expect(result.cheapestHotel?.supplier).toBe("B");
      expect(result.status).toBe("SUCCESS");
    });
  });

  describe("Partial Supplier Failures & Empty Responses", () => {
    it("should return Supplier B results when Supplier A fails (PARTIAL_SUCCESS)", () => {
      const supplierA: SupplierExecutionResult = {
        success: false,
        error: "Activity timeout after 5000ms",
      };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [hotelB1] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelB1);
      expect(result.status).toBe("PARTIAL_SUCCESS");
    });

    it("should return Supplier A results when Supplier B fails (PARTIAL_SUCCESS)", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [hotelA2] };
      const supplierB: SupplierExecutionResult = {
        success: false,
        error: "Connection refused",
      };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelA2);
      expect(result.status).toBe("PARTIAL_SUCCESS");
    });

    it("should choose Supplier B when Supplier A returns empty array", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [] };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [hotelB1] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelB1);
      expect(result.cheapestHotel?.supplier).toBe("B");
      expect(result.status).toBe("SUCCESS");
    });

    it("should choose Supplier A when Supplier B returns empty array", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [hotelA1] };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toEqual(hotelA1);
      expect(result.cheapestHotel?.supplier).toBe("A");
      expect(result.status).toBe("SUCCESS");
    });

    it("should return NO_HOTELS_FOUND when both suppliers return empty arrays", () => {
      const supplierA: SupplierExecutionResult = { success: true, hotels: [] };
      const supplierB: SupplierExecutionResult = { success: true, hotels: [] };

      const result = compareSupplierResults({ supplierA, supplierB });

      expect(result.cheapestHotel).toBeNull();
      expect(result.status).toBe("NO_HOTELS_FOUND");
    });

    it("should throw an error when both suppliers fail", () => {
      const supplierA: SupplierExecutionResult = {
        success: false,
        error: "Supplier A 500 Internal Server Error",
      };
      const supplierB: SupplierExecutionResult = {
        success: false,
        error: "Supplier B Gateway Timeout",
      };

      expect(() => compareSupplierResults({ supplierA, supplierB })).toThrow(
        /Both suppliers failed to provide hotel rates/i,
      );
    });
  });
});
