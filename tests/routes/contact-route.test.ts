import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/contact/route";

describe("POST /api/contact", () => {
  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid submission" });
  });
});
