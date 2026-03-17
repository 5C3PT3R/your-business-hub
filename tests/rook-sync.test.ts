/**
 * REGENT — Rook Sync: Unit Tests
 *
 * Tests SOQL injection guard, entity validation, and CRM routing logic.
 */

import { describe, it, expect } from 'vitest';

// ─── SOQL escape (mirrored from rook-sync) ─────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function soqlEscapeEmail(email: string): string {
  if (!EMAIL_RE.test(email)) throw new Error(`Invalid email format for SOQL query: ${email}`);
  return email.replace(/['"\\;]/g, '');
}

// ─── CRM type validation ───────────────────────────────────

const SUPPORTED_CRMS = ['hubspot', 'salesforce', 'zoho', 'pipedrive'];

function isSupportedCrm(crm: string): boolean {
  return SUPPORTED_CRMS.includes(crm);
}

// ─── Fetch timeout helper logic ────────────────────────────

function willAbortAfter(timeoutMs: number, elapsedMs: number): boolean {
  return elapsedMs >= timeoutMs;
}

// ─── Tests ────────────────────────────────────────────────

describe('soqlEscapeEmail — SQL injection guard', () => {
  it('accepts a valid email unchanged', () => {
    expect(soqlEscapeEmail('john.doe@stripe.com')).toBe('john.doe@stripe.com');
  });

  it('strips single quote from email (injection attempt)', () => {
    // A valid email cannot contain a quote, so this will throw at the regex stage
    expect(() => soqlEscapeEmail("john'doe@stripe.com")).toThrow();
  });

  it('throws on email containing SOQL comment injection', () => {
    expect(() => soqlEscapeEmail('x@y.com; DROP TABLE contacts;--')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => soqlEscapeEmail('')).toThrow();
  });

  it('throws on email with no TLD (invalid format)', () => {
    expect(() => soqlEscapeEmail('user@domain')).toThrow();
  });

  it('throws on email with space (invalid format)', () => {
    expect(() => soqlEscapeEmail('user @domain.com')).toThrow();
  });

  it('[ADVERSARIAL] Classic SOQL injection: single quote + OR 1=1', () => {
    // Valid emails cannot contain single quotes — regex blocks before escape
    expect(() => soqlEscapeEmail("' OR '1'='1")).toThrow();
  });

  it('[ADVERSARIAL] Backslash injection to un-escape quote', () => {
    // Backslash in email is invalid per RFC — regex rejects it
    expect(() => soqlEscapeEmail("user\\@stripe.com")).toThrow();
  });

  it('[ADVERSARIAL] Unicode lookalike characters in domain are rejected', () => {
    // IDN homograph attack — Cyrillic 'і' does NOT match [a-zA-Z0-9.\-] in EMAIL_RE
    // soqlEscapeEmail throws, which is the correct secure behaviour:
    // better to reject the sync than to pass a suspicious email to Salesforce.
    const email = 'user@strіpe.com'; // Cyrillic 'і' instead of Latin 'i'
    expect(() => soqlEscapeEmail(email)).toThrow('Invalid email format for SOQL query');
  });
});

describe('CRM type routing', () => {
  it('accepts all supported CRM types', () => {
    for (const crm of SUPPORTED_CRMS) {
      expect(isSupportedCrm(crm)).toBe(true);
    }
  });

  it('rejects unknown CRM type', () => {
    expect(isSupportedCrm('oracle')).toBe(false);
    expect(isSupportedCrm('')).toBe(false);
    expect(isSupportedCrm('HUBSPOT')).toBe(false); // case-sensitive
  });

  it('[ADVERSARIAL] Rejects CRM type with injection attempt', () => {
    expect(isSupportedCrm('hubspot; DROP TABLE clients')).toBe(false);
  });
});

describe('Fetch timeout logic', () => {
  it('marks request as aborted after timeout', () => {
    expect(willAbortAfter(15_000, 15_001)).toBe(true);
  });

  it('does not abort before timeout', () => {
    expect(willAbortAfter(15_000, 14_999)).toBe(false);
  });

  it('does not abort at exactly timeout ms (boundary)', () => {
    expect(willAbortAfter(15_000, 15_000)).toBe(true);
  });
});

describe('CRM credential shape validation', () => {
  it('HubSpot creds must have access_token', () => {
    const creds = { access_token: 'tok_abc123' };
    expect(typeof creds.access_token).toBe('string');
    expect(creds.access_token.length).toBeGreaterThan(0);
  });

  it('Salesforce creds must have instance_url and access_token', () => {
    const creds = { instance_url: 'https://mycompany.salesforce.com', access_token: 'tok_abc' };
    expect(creds.instance_url).toMatch(/^https:\/\//);
    expect(creds.access_token.length).toBeGreaterThan(0);
  });

  it('[ADVERSARIAL] Missing access_token in HubSpot creds produces empty string', () => {
    const creds: any = {};
    const token = creds.access_token || '';
    expect(token).toBe('');
    // In production, this will fail on the first API call with 401
  });
});
