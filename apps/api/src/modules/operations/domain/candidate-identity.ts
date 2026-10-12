import type { ProductCandidate } from '@vitalink/contracts';

/** A product NDC can occur on multiple SPL listings; selection by NDC must be unambiguous. */
export function flagDuplicateCandidates(candidates: ProductCandidate[]): ProductCandidate[] {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.productNdc, (counts.get(candidate.productNdc) ?? 0) + 1);
  }
  return candidates.map((candidate) =>
    (counts.get(candidate.productNdc) ?? 0) > 1
      ? {
          ...candidate,
          exclusions: [
            ...candidate.exclusions,
            'Multiple retrieved listings share this product NDC; listing identity needs verification.',
          ],
        }
      : candidate,
  );
}
