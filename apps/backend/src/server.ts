import app from "./app";
import { config } from "./config/env";
import { runWorker } from "./temporal/worker";
import { setTemporalClient } from "./temporal/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

const server = app.listen(config.port, async () => {
  console.log(`Backend server running on http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);

  try {
    await runWorker();
  } catch {
    console.log("External Temporal server unavailable. Initializing embedded Temporal server & worker...");
    try {
      const testEnv = await TestWorkflowEnvironment.createLocal();
      setTemporalClient(testEnv.client);
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: config.temporal.taskQueue,
        workflowsPath: require.resolve("./workflows"),
        activities: {
          searchSupplierA: activities.searchSupplierA,
          searchSupplierB: activities.searchSupplierB,
        },
      });
      void worker.run();
      console.log(`Embedded Temporal server & worker running on ${testEnv.address}`);
    } catch (embErr) {
      console.error("Failed to start embedded Temporal server:", embErr);
    }
  }
});

export default server;
