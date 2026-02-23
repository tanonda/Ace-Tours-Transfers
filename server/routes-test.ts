import { Router } from "express";
export const testRouter = Router();
testRouter.get("/error", (req, res) => {
  throw new Error("Test error for Sentry");
});
