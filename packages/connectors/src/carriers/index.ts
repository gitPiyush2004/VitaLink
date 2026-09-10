/**
 * Carrier adapters. Every carrier-specific line of code in the system lives here.
 *
 * The recommendation engine imports nothing from this directory except the
 * `CarrierAdapter` type and the registry — it never sees a carrier name. Read
 * `carrier-adapter.ts` first for why, then `dsv.adapter.ts` as the reference
 * implementation.
 */

export * from './carrier-adapter';
export * from './carrier-registry';
export * from './dsv.adapter';
export * from './mock-carrier.adapter';
export * from './unavailable-carrier.adapter';
