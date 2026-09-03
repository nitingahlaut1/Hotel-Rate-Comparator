import request from "supertest";
import app from "../../src/app";

describe("Health Check API", () => {
  it("should return status 200 and { status: 'ok' } on GET /health", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
