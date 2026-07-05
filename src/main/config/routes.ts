import { Express, Router } from "express";
import setupLoginRoutes from "../../main/routes/login/login-routes";
export const setupRoutes = async (app: Express): Promise<void> => {
  const router = Router();
  app.use("/api", router);
  setupLoginRoutes(router);
};
