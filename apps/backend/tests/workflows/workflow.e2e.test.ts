import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { WorkflowFailedError } from "@temporalio/client";
import { Server } from "http";
import { AddressInfo } from "net";
import app from "../../src/app";
import { hotelSearchWorkflow } from "../../src/workflows/hotelSearch.workflow";
import * as activities from "../../src/activities";
import { resetFailTwiceCounters } from "../../src/suppliers/mockSupplier";

describe("Temporal Workflow Tests (hotelSearchWorkflow) - All Assignment Scenarios", () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerPromise: Promise<void>;
  let server: Server;
  const taskQueue = "all-assignment-scenarios-queue";

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

    // 2. Start Temporal TestWorkflowEnvironment with time-skipping
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();

    // 3. Start Worker listening on taskQueue
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("../../src/workflows"),
      activities: {
        searchSupplierA: activities.searchSupplierA,
        searchSupplierB: activities.searchSupplierB,
      },
    });

    workerPromise = worker.run();
  }, 40000);

  afterAll(async () => {
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
  });

  beforeEach(() => {
    resetFailTwiceCounters();
  });

  it("Test 1: Supplier A cheaper -> returns Supplier A", async () => {
    // In Paris: Supplier A = $160, Supplier B = $165
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-1-supplier-a-cheaper",
      args: [
        {
          city: "Paris",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("A");
    expect(result.cheapestHotel?.price).toBe(160);
  });

  it("Test 2: Supplier B cheaper -> returns Supplier B", async () => {
    // In Dubai: Supplier A = $120, Supplier B = $115
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-2-supplier-b-cheaper",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("B");
    expect(result.cheapestHotel?.price).toBe(115);
  });

  it("Test 3: Both return same rate -> deterministic tie-breaker selects Supplier A", async () => {
    // In Tie / SameRate: both Supplier A and B return price $100
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-3-same-rate-tie-breaker",
      args: [
        {
          city: "Tie",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("A");
    expect(result.cheapestHotel?.price).toBe(100);
  });

  it("Test 4: Supplier A fails, Supplier B succeeds -> returns Supplier B", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-4-supplier-a-fails",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "error",
          supplierBBehavior: "success",
        },
      ],
    });

    expect(result.status).toBe("PARTIAL_SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("B");
    expect(result.supplierResults.supplierA.success).toBe(false);
    expect(result.supplierResults.supplierB.success).toBe(true);
  });

  it("Test 5: Supplier B fails, Supplier A succeeds -> returns Supplier A", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-5-supplier-b-fails",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "success",
          supplierBBehavior: "error",
        },
      ],
    });

    expect(result.status).toBe("PARTIAL_SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("A");
    expect(result.supplierResults.supplierA.success).toBe(true);
    expect(result.supplierResults.supplierB.success).toBe(false);
  });

  it("Test 6: Both suppliers fail -> throws Workflow / ApplicationFailure", async () => {
    let thrownError: unknown;
    try {
      await testEnv.client.workflow.execute(hotelSearchWorkflow, {
        taskQueue,
        workflowId: "test-6-both-suppliers-fail",
        args: [
          {
            city: "Dubai",
            checkIn: "2026-10-10",
            checkOut: "2026-10-12",
            supplierABehavior: "error",
            supplierBBehavior: "error",
          },
        ],
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(WorkflowFailedError);
    const workflowErr = thrownError as WorkflowFailedError;
    expect(workflowErr.cause?.message).toMatch(
      /Both suppliers failed to provide hotel rates/i,
    );
  });

  it("Test 7: Supplier A empty, Supplier B succeeds -> returns Supplier B", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-7-supplier-a-empty",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "empty",
          supplierBBehavior: "success",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("B");
  });

  it("Test 8: Supplier A succeeds, Supplier B empty -> returns Supplier A", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-8-supplier-b-empty",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "success",
          supplierBBehavior: "empty",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("A");
  });

  it("Test 9: Both suppliers empty -> returns NO_HOTELS_FOUND", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-9-both-empty",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "empty",
          supplierBBehavior: "empty",
        },
      ],
    });

    expect(result.status).toBe("NO_HOTELS_FOUND");
    expect(result.cheapestHotel).toBeNull();
  });

  it("Test 10: Supplier takes more than 5 seconds -> Activity times out, other supplier returned", async () => {
    // Supplier A is slow (>5s), Supplier B succeeds
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-10-slow-activity-timeout",
      args: [
        {
          city: "Dubai",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "slow",
          supplierBBehavior: "success",
        },
      ],
    });

    expect(result.status).toBe("PARTIAL_SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.cheapestHotel?.supplier).toBe("B");
    expect(result.supplierResults.supplierA.success).toBe(false);
    expect(result.supplierResults.supplierA.error).toBeDefined();
    expect(result.supplierResults.supplierB.success).toBe(true);
  }, 30000);

  it("Test 11: Supplier A fail-twice -> retried automatically, succeeds on Attempt 3", async () => {
    const result = await testEnv.client.workflow.execute(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-11-fail-twice-retry",
      args: [
        {
          city: "Paris",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          supplierABehavior: "fail-twice",
          supplierBBehavior: "fail-twice",
        },
      ],
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.cheapestHotel).not.toBeNull();
    expect(result.supplierResults.supplierA.success).toBe(true);
    expect(result.supplierResults.supplierB.success).toBe(true);
  });

  it("Test 12: Workflow cancellation -> terminates gracefully, not converted to success", async () => {
    const handle = await testEnv.client.workflow.start(hotelSearchWorkflow, {
      taskQueue,
      workflowId: "test-12-workflow-cancellation",
      args: [
        {
          city: "Tokyo",
          checkIn: "2026-10-10",
          checkOut: "2026-10-12",
          behavior: "delay",
        },
      ],
    });

    // Request cancellation while running
    await handle.cancel();

    // Awaiting result must reject with WorkflowFailedError caused by cancellation
    await expect(handle.result()).rejects.toThrow(WorkflowFailedError);
  });
});
