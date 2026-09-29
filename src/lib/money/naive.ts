/**
 * Deliberately naive floating-point money maths: what the engine is benchmarked against.
 * Amounts are major-unit JavaScript numbers. Not used by the app.
 */
export function roundTo(x: number, places: number): number {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}

export function naiveAllocate(major: number, weights: readonly number[], places: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => roundTo((major * w) / total, places));
}

export function naiveConvert(major: number, rate: number, places: number): number {
  return roundTo(major * rate, places);
}
