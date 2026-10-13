import { describe, expect, it, vi } from "vitest";
import { judgeInBatches } from "./judging";

describe("judgeInBatches", () => {
  it("runs at most `concurrency` at once and reports progress", async () => {
    let running = 0;
    let peak = 0;
    const progress = vi.fn();
    await judgeInBatches(
      [1, 2, 3, 4, 5],
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
      progress,
      2,
    );
    expect(peak).toBe(2);
    expect(progress.mock.calls.map(([done]) => done)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collects failures and keeps going", async () => {
    const judged: number[] = [];
    const { failed } = await judgeInBatches(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("rate limited");
        judged.push(n);
      },
      () => {},
    );
    expect(judged.sort()).toEqual([1, 3]);
    expect(failed).toEqual([{ item: 2, error: new Error("rate limited") }]);
  });

  it("does nothing for no items", async () => {
    const judge = vi.fn();
    expect(await judgeInBatches([], judge, () => {})).toEqual({ failed: [] });
    expect(judge).not.toHaveBeenCalled();
  });
});
