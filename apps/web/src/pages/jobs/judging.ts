// Jobs judged at once: enough to be quick, few enough to stay inside provider rate limits
export const JUDGE_CONCURRENCY = 3;

// Runs `judge` over `items`, a few at a time. Failures are collected, not thrown, so one bad
// job doesn't stop the rest; `onProgress` gets the count finished so far.
export const judgeInBatches = async <T>(
  items: T[],
  judge: (item: T) => Promise<void>,
  onProgress: (done: number) => void,
  concurrency = JUDGE_CONCURRENCY,
): Promise<{ failed: { item: T; error: unknown }[] }> => {
  const failed: { item: T; error: unknown }[] = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await judge(item);
      } catch (error) {
        failed.push({ item, error });
      }
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { failed };
};
