import { describe, expect, it } from 'vitest';
import { asyncPool } from './asyncPool';

describe('asyncPool', () => {
  it('returns empty array for empty input', async () => {
    const result = await asyncPool([], 4, async (n) => n);
    expect(result).toEqual([]);
  });

  it('preserves order with concurrency > 1', async () => {
    const started: number[] = [];
    const result = await asyncPool([1, 2, 3, 4, 5], 2, async (n) => {
      started.push(n);
      await new Promise((r) => setTimeout(r, 20 - n * 3));
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(started).toHaveLength(5);
  });

  it('caps concurrency to item count', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await asyncPool([1, 2, 3], 10, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return n;
    });
    expect(maxInFlight).toBe(3);
  });

  it('respects concurrency limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await asyncPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return n;
    });
    expect(maxInFlight).toBe(2);
  });
});
