import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };
}

export const config: AppConfig = {
  port: Number(process.env["PORT"]) || 8003,
  temporal: {
    address: process.env["TEMPORAL_ADDRESS"] || "localhost:7233",
    namespace: process.env["TEMPORAL_NAMESPACE"] || "default",
    taskQueue: process.env["TEMPORAL_TASK_QUEUE"] || "hotel-search",
  },
};
