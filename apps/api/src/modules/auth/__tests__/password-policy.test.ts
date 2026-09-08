/**
 * Domain tests. Note what is absent: any mock, any stub, any database.
 *
 * That is the point of `domain/` (PART 3A.10). These functions are pure, so a
 * test is arrange-act-assert with plain values. If a domain test ever needs a
 * mock, the function is not pure and should be moved to the service.
 */

import { describe, expect, it } from 'vitest';

import { assessPassword, emailDomain } from '../domain/password-policy';

describe('assessPassword', () => {
  it('accepts a long password with three character classes', () => {
    const password = 'Correct-Horse-42';

    const result = assessPassword(password, 'analyst@vitalink.test');

    expect(result.isAcceptable).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('rejects a password shorter than the minimum length', () => {
    const password = 'Short-1';

    const result = assessPassword(password, 'analyst@vitalink.test');

    expect(result.isAcceptable).toBe(false);
    expect(result.problems).toContain('too_short');
  });

  it('rejects a long password drawn from only two character classes', () => {
    const password = 'lowercaseonlyletters';

    const result = assessPassword(password, 'analyst@vitalink.test');

    expect(result.isAcceptable).toBe(false);
    expect(result.problems).toContain('too_few_character_classes');
  });

  it('rejects a password containing the email local part', () => {
    const password = 'analyst-Str0ng-Pass';

    const result = assessPassword(password, 'analyst@vitalink.test');

    expect(result.isAcceptable).toBe(false);
    expect(result.problems).toContain('contains_email_local_part');
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const password = 'abc';

    const result = assessPassword(password, 'abc@vitalink.test');

    expect(result.problems).toEqual([
      'too_short',
      'too_few_character_classes',
      'contains_email_local_part',
    ]);
  });
});

describe('emailDomain', () => {
  it('extracts and lowercases the domain', () => {
    expect(emailDomain('Analyst@VitaLink.Test')).toBe('vitalink.test');
  });

  it('returns null for an address with no @', () => {
    expect(emailDomain('not-an-email')).toBeNull();
  });

  it('returns null for an address with two @ signs', () => {
    expect(emailDomain('a@b@c.test')).toBeNull();
  });

  it('returns null when the domain is empty', () => {
    expect(emailDomain('analyst@')).toBeNull();
  });
});
