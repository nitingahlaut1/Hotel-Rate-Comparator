import request from "supertest";
import { Server } from "http";
import { AddressInfo } from "net";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import app from "../../src/app";
import { setTemporalClient } from "../../src/temporal/client";
import { config } from "../../src/config/env";
import { hotelSearchWorkflow } from "../../src/workflows/hotelSearch.workflow";
import * as activities from "../../src/activities";
import { resetFailTwiceCounters } from "../../src/suppliers/mockSupplier";

describe("Hotel Search API (POST /api/search-hotels)", () => {
  let server: Server;
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerPromise: Promise<void>;

  beforeAll(async () => {
    // 1. Start live Express server on ephemeral port for activity calls
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        process.env["SUPPLIER_A_URL"] = `http://localhost:${port}/supplierA/hotels`;
        process.env["SUPPLIER_B_URL"] = `http://localhost:${port}/supplierB/hotels`;
        resolve();
      });
    });

    // 2. Start Temporal TestWorkflowEnvironment
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    // 3. Inject Temporal client into Express search controller
    setTemporalClient(testEnv.client);

    // 4. Start Worker listening on the configured task queue
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: config.temporal.taskQueue,
      workflowsPath: require.resolve("../../src/workflows"),
      activities: {
        searchSupplierA: activities.searchSupplierA,
        searchSupplierB: activities.searchSupplierB,
      },
    });

    // Run worker in background and keep promise
    workerPromise = worker.run();
  }, 40000);

  afterAll(async () => {
    // Shutdown worker, server, and testEnv cleanly
    if (worker) {
      worker.shutdown();
      try {
        await workerPromise;
      } catch {
        // Ignored on shutdown
      }
    }
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (testEnv) {
      await testEnv.teardown();
    }
    setTemporalClient(null);
  });

  beforeEach(() => {
    resetFailTwiceCounters();
  });

  describe("Validation", () => {
    it("should return 400 if city is missing", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({ checkIn: "2026-10-10", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'city' is required");
    });

    it("should return 400 if checkIn is missing", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({ city: "Dubai", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'checkIn' is required");
    });

    it("should return 400 if checkIn format is invalid", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({ city: "Dubai", checkIn: "10-10-2026", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'checkIn' is required in YYYY-MM-DD format");
    });

    it("should return 400 if checkOut is missing", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({ city: "Dubai", checkIn: "2026-10-10" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'checkOut' is required");
    });

    it("should return 400 if checkOut is not strictly after checkIn", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({ city: "Dubai", checkIn: "2026-10-12", checkOut: "2026-10-12" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("'checkOut' must be strictly after 'checkIn'");
    });
  });

  describe("Search Scenarios", () => {
    it("1. Normal Search: should return 200 with cheapest hotel and workflowId", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Paris",
          checkIn: "2026-10-10",
          checkOut: "2026-10-15",
        });

      expect(res.status).toBe(200);
      expect(res.body.workflowId).toMatch(/^hotel-search-/);
      expect(res.body.hotelId).toBeDefined();
      expect(res.body.name).toBeDefined();
      expect(typeof res.body.price).toBe("number");
      expect(["A", "B"]).toContain(res.body.supplier);
      expect(res.body.status).toBe("SUCCESS");
    }, 20000);

    it("2. Supplier A Cheaper: in Paris A=160 vs B=165, should return Supplier A", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Paris",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
        });

      expect(res.status).toBe(200);
      expect(res.body.supplier).toBe("A");
      expect(res.body.price).toBe(160);
    }, 20000);

    it("3. Supplier B Cheaper: in Dubai B=115 vs A=120, should return Supplier B", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
        });

      expect(res.status).toBe(200);
      expect(res.body.supplier).toBe("B");
      expect(res.body.price).toBe(115);
    }, 20000);

    it("4. Supplier Failure (Partial Failure): Supplier A fails, Supplier B returns results", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "error",
          supplierBBehavior: "success",
        });

      expect(res.status).toBe(200);
      expect(res.body.supplier).toBe("B");
      expect(res.body.status).toBe("PARTIAL_SUCCESS");
    }, 20000);

    it("5. Empty Results: Supplier A empty, Supplier B returns results", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "empty",
          supplierBBehavior: "success",
        });

      expect(res.status).toBe(200);
      expect(res.body.supplier).toBe("B");
    }, 20000);

    it("6. Both Suppliers Empty: should return 404 No hotels found", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "empty",
          supplierBBehavior: "empty",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("No hotels found");
    }, 20000);

    it("7. Both Suppliers Fail: should return 502 Bad Gateway", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "error",
          supplierBBehavior: "error",
        });

      expect(res.status).toBe(502);
      expect(res.body.error).toContain("Both suppliers failed to provide hotel rates");
    }, 20000);

    it("8. Slow Supplier: Supplier A is slow (>5s timeout), Supplier B succeeds", async () => {
      const res = await request(app)
        .post("/api/search-hotels")
        .send({
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "slow",
          supplierBBehavior: "success",
        });

      expect(res.status).toBe(200);
      expect(res.body.supplier).toBe("B");
      expect(res.body.status).toBe("PARTIAL_SUCCESS");
    }, 30000);
  });

  describe("Cancellation Endpoint", () => {
    it("should return 200 and request cancellation for an active workflow", async () => {
      const cancelWorkflowId = "hotel-search-cancel-test-123";

      // Start an in-flight workflow using the Temporal client
      await testEnv.client.workflow.start(hotelSearchWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId: cancelWorkflowId,
        args: [
          {
            city: "Tokyo",
            checkIn: "2026-10-10",
            checkOut: "2026-10-12",
            behavior: "slow",
          },
        ],
      });

      // Request cancellation through API
      const cancelRes = await request(app)
        .post(`/api/search-hotels/${cancelWorkflowId}/cancel`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.message).toContain("Workflow cancellation requested");
      expect(cancelRes.body.workflowId).toBe(cancelWorkflowId);
    }, 20000);

    it("should return 404 if workflow does not exist", async () => {
      const res = await request(app)
        .post("/api/search-hotels/non-existent-workflow-id-999/cancel");

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });
  });
});
