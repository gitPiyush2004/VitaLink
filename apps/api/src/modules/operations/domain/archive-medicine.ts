import { createHash } from 'node:crypto';

export function printedMedicineKey(name: string): string {
  const value = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(value).digest('hex');
}
