import express, { Application } from "express";
import cors from "cors";
import apiRoutes from "./api/routes";
import { errorHandler } from "./api/middleware/error.middleware";

export const createApp = (): Application => {
  const app = express();

  // Core Middleware
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.use(apiRoutes);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
