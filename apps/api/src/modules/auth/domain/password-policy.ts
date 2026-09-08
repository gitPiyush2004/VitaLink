/**
 * Pure password rules.
 *
 * This file is the template for every `domain/` file in the codebase: no I/O, no
 * clock, no randomness, no framework imports, and therefore no mocks needed to
 * test it. If a domain test ever needs a mock, the function is not pure and
 * should be refactored (PART 3A.10).
 *
 * Note that `assessPassword` returns a result rather than throwing. Domain
 * functions describe; the service decides what to do about it.
 */

import { MIN_PASSWORD_LENGTH } from '@config/constants';

const MIN_CHARACTER_CLASSES = 3;
/** Below this length an email local part is too generic to be worth matching on. */
const MIN_LOCAL_PART_TO_MATCH = 3;
/** An email address is exactly one local part and one domain. */
const EMAIL_PART_COUNT = 2;

export type PasswordProblem =
  'too_short' | 'too_few_character_classes' | 'contains_email_local_part';

export type PasswordAssessment = {
  isAcceptable: boolean;
  problems: PasswordProblem[];
};

function countCharacterClasses(password: string): number {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];
  return classes.filter((pattern) => pattern.test(password)).length;
}

/**
 * Checks a candidate password against the policy.
 *
 * The policy is deliberately modest: length first, then a character-class floor.
 * Length dominates entropy, and complexity rules pushed further than this are
 * well documented to make users pick worse passwords, not better ones.
 *
 * @param password the candidate, as typed
 * @param email the account's email, so a password containing the local part is rejected
 */
export function assessPassword(password: string, email: string): PasswordAssessment {
  const problems: PasswordProblem[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push('too_short');
  }

  if (countCharacterClasses(password) < MIN_CHARACTER_CLASSES) {
    problems.push('too_few_character_classes');
  }

  const localPart = email.split('@')[0]?.toLowerCase() ?? '';
  if (localPart.length >= MIN_LOCAL_PART_TO_MATCH && password.toLowerCase().includes(localPart)) {
    problems.push('contains_email_local_part');
  }

  return { isAcceptable: problems.length === 0, problems };
}

/**
 * Extracts the domain from an email address, lowercased.
 *
 * Used to map a Google sign-in onto an organisation. Returns null rather than
 * throwing for a malformed address, because the caller has a sensible fallback
 * (reject the sign-in) and an exception here would be noise.
 */
export function emailDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== EMAIL_PART_COUNT) return null;
  const domain = parts[1];
  return domain === undefined || domain.length === 0 ? null : domain;
}
