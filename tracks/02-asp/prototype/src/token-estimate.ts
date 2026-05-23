/**
 * Coarse token estimator. Spec Section 3.6 allows server-defined granularity.
 *
 * Rule of thumb: 1 token ≈ 4 characters for English text, ≈ 3 for code.
 * We use a conservative 3.5 chars/token to slightly over-count, which keeps
 * server-side truncation safe.
 */
const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
