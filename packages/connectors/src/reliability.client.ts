import { drugReliabilitySchema, type DrugReliability } from '@vitalink/contracts';

export type ReliabilityRequest = {
  drug_id: string;
  recall_count: number;
  observation_window_years: number;
  resolved_shortage_durations_days: number[];
  z_api: number;
  z_plant: number;
  z_line: number;
};
/** Internal compute request, with a bounded timeout and response validation. */
export class ReliabilityClient {
  constructor(
    private readonly baseUrl: string,
    private readonly secret: string,
  ) {}
  async fit(input: ReliabilityRequest, fetchedAt: string): Promise<DrugReliability> {
    const timeoutMs = 20_000;
    const response = await fetch(new URL('/reliability/fit', this.baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'X-Vitalink-Secret': this.secret,
        'X-Vitalink-Fetched-At': fetchedAt,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`Reliability service returned HTTP ${String(response.status)}.`);
    }
    return drugReliabilitySchema.parse(await response.json());
  }
}
