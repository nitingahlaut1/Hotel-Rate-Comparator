import { Connection, Client } from "@temporalio/client";
import { config } from "../config/env";

let clientInstance: Client | null = null;

/**
 * Creates a fresh Temporal Client connected using the configured address and namespace.
 */
export async function createTemporalClient(overrides?: {
  address?: string;
  namespace?: string;
}): Promise<Client> {
  const address = overrides?.address || config.temporal.address;
  const namespace = overrides?.namespace || config.temporal.namespace;

  const connection = await Connection.connect({
    address,
  });

  return new Client({
    connection,
    namespace,
  });
}

/**
 * Retrieves the singleton Temporal Client instance.
 */
export async function getTemporalClient(): Promise<Client> {
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = await createTemporalClient();
  return clientInstance;
}

/**
 * Allows overriding or resetting the singleton Temporal Client instance (e.g. for testing).
 */
export function setTemporalClient(client: Client | null): void {
  clientInstance = client;
}

/**
 * Default Temporal Task Queue name from configuration.
 */
export const TEMPORAL_TASK_QUEUE = config.temporal.taskQueue;
