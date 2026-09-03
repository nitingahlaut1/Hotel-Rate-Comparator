import { bundleWorkflowCode } from "@temporalio/worker";
import path from "path";

describe("Temporal Workflow Bundle & Determinism", () => {
  it("should successfully bundle hotelSearchWorkflow without determinism violations", async () => {
    const workflowsPath = path.resolve(__dirname, "../../src/workflows");

    const bundle = await bundleWorkflowCode({
      workflowsPath,
    });

    expect(bundle.code).toBeDefined();
    expect(typeof bundle.code).toBe("string");
    expect(bundle.code.length).toBeGreaterThan(100);
  }, 20000);
});
