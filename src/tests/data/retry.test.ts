import { describe, it, expect } from "vitest";
import { backoffDelayMs, isRetryable, withRetries, MAX_ATTEMPTS } from "@/lib/data/retry";

describe("retry policy", () => {
  it("retries transient gateway failures", () => {
    expect(isRetryable(new Error("Rate limit reached — try this run again in a moment."))).toBe(true);
    expect(isRetryable(new Error("AI gateway error (503): upstream"))).toBe(true);
    expect(isRetryable(new Error("fetch failed"))).toBe(true);
  });

  it("fails fast on deterministic failures", () => {
    expect(isRetryable(new Error("AI credits exhausted for this workspace."))).toBe(false);
    expect(isRetryable(new Error("AI gateway is not configured for this project."))).toBe(false);
    expect(isRetryable(new Error("AI gateway error (400): bad request"))).toBe(false);
  });

  it("grows the backoff window and stays jittered within bounds", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(200);
    expect(backoffDelayMs(1, () => 1)).toBe(400);
    expect(backoffDelayMs(3, () => 1)).toBe(1600);
    expect(backoffDelayMs(20, () => 1)).toBe(5000);
  });

  it("succeeds after a transient failure and reports the attempt count", async () => {
    let calls = 0;
    const { value, attempts } = await withRetries(
      async () => {
        calls++;
        if (calls < 2) throw new Error("AI gateway error (502): boom");
        return "ok";
      },
      { sleep: async () => {} },
    );
    expect(value).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("stops after the attempt budget", async () => {
    let calls = 0;
    await expect(
      withRetries(
        async () => {
          calls++;
          throw new Error("AI gateway error (500): nope");
        },
        { sleep: async () => {} },
      ),
    ).rejects.toThrow(/500/);
    expect(calls).toBe(MAX_ATTEMPTS);
  });

  it("does not retry non-transient failures", async () => {
    let calls = 0;
    await expect(
      withRetries(async () => {
        calls++;
        throw new Error("AI credits exhausted for this workspace.");
      }),
    ).rejects.toThrow(/credits/);
    expect(calls).toBe(1);
  });
});
