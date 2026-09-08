/**
 * packages/contracts — the keystone.
 *
 * One source of truth for every schema in the system. React and Node import
 * these directly; apps/brain mirrors them as pydantic v2 models and a contract
 * test fails the build when the two drift.
 *
 * Read `provenance.ts` first. Everything else depends on the Quantity envelope
 * defined there.
 */

export * from './provenance';
export * from './enums';
export * from './limits';
export * from './common';
export * from './catalog';
export * from './graph';
export * from './signals';
export * from './reliability';
export * from './cascade';
export * from './logistics';
export * from './logistics-decision';
export * from './scenarios';
export * from './events';
export * from './auth';
