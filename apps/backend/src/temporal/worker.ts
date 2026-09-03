import { NativeConnection, Worker } from "@temporalio/worker";
import { config } from "../config/env";
import * as activities from "../activities";

export interface WorkerOptionsOverride {
  address?: string;
  namespace?: string;
  taskQueue?: string;
  connection?: NativeConnection;
}

/**
 * Creates and configures a Temporal Worker with registered workflows and activities.
 * Task Queue: hotel-search (from config or override)
 */
export async function createWorker(overrides?: WorkerOptionsOverride): Promise<Worker> {
  const address = overrides?.address || config.temporal.address;
  const namespace = overrides?.namespace || config.temporal.namespace;
  const taskQueue = overrides?.taskQueue || config.temporal.taskQueue;

  const connection =
    overrides?.connection ||
    (await NativeConnection.connect({
      address,
    }));

  return Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: require.resolve("../workflows"),
    activities: {
      searchSupplierA: activities.searchSupplierA,
      searchSupplierB: activities.searchSupplierB,
    },
  });
}

/**
 * Worker startup entry point.
 */
export async function runWorker(): Promise<void> {
  console.log(`Connecting Temporal Worker to ${config.temporal.address}...`);
  const worker = await createWorker();
  console.log(`Temporal Worker registered for task queue: ${config.temporal.taskQueue}`);
  console.log("Registered Activities: searchSupplierA, searchSupplierB");
  console.log("Registered Workflows: hotelSearchWorkflow");

  await worker.run();
}

if (require.main === module) {
  runWorker().catch((err: unknown) => {
    console.error("Temporal worker failed to start:", err);
    process.exit(1);
  });
}
