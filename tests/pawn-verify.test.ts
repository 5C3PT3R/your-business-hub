/**
 * REGENT — Pawn Verify: Unit Tests
 *
 * Tests the core validation logic extracted from the pawn-verify edge function.
 * Run with: npm test
 */

import { describe, it, expect } from 'vitest';

// ─── Inline the pure functions from pawn-verify ───────────
// (Edge functions can't be imported directly in Node; we test the logic here.)

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', '10minutemail.com', 'trashmail.com', 'fakeinbox.com',
  'sharklasers.com', 'maildrop.cc',
]);

const ROLE_PREFIXES = new Set([
  'info', 'contact', 'hello', 'support', 'admin', 'help', 'sales',
  'marketing', 'team', 'office', 'mail', 'email', 'noreply', 'no-reply',
]);

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return false;
  const domain = trimmed.split('@')[1];
  return !BLOCKED_DOMAINS.has(domain);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function scoreEmail(email: string): { confidence: number; status: string } {
  const local = email.split('@')[0].toLowerCase();
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (ROLE_PREFIXES.has(local)) return { confidence: 35, status: 'risky' };
  const hasName = /^[a-z]+[\.\-_][a-z]+$/.test(local);
  const hasSingleName = /^[a-z]{3,}$/.test(local);
  const isGenericTld = domain.endsWith('.com') || domain.endsWith('.io') || domain.endsWith('.co');
  if (hasName && isGenericTld) return { confidence: 78, status: 'valid' };
  if (hasSingleName && isGenericTld) return { confidence: 68, status: 'valid' };
  if (hasName) return { confidence: 65, status: 'valid' };
  return { confidence: 55, status: 'risky' };
}

// ─── Tests ────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts standard business email', () => {
    expect(isValidEmail('john.doe@stripe.com')).toBe(true);
  });

  it('accepts email with plus sign', () => {
    expect(isValidEmail('john+test@company.io')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });

  it('rejects malformed email (no @)', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('rejects malformed email (no TLD)', () => {
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('rejects disposable domain (mailinator)', () => {
    expect(isValidEmail('test@mailinator.com')).toBe(false);
  });

  it('rejects disposable domain (tempmail)', () => {
    expect(isValidEmail('x@tempmail.com')).toBe(false);
  });

  it('rejects disposable domain (10minutemail)', () => {
    expect(isValidEmail('x@10minutemail.com')).toBe(false);
  });

  it('accepts padded email — function trims internally before regex check', () => {
    // isValidEmail calls email.trim().toLowerCase() before testing — whitespace is normalized
    expect(isValidEmail(' john@company.com')).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('lowercases the email', () => {
    expect(normalizeEmail('John.Doe@Stripe.COM')).toBe('john.doe@stripe.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });
});

describe('scoreEmail', () => {
  it('gives high confidence to firstname.lastname@company.com pattern', () => {
    const result = scoreEmail('john.doe@stripe.com');
    expect(result.confidence).toBe(78);
    expect(result.status).toBe('valid');
  });

  it('marks role-based address as risky', () => {
    const result = scoreEmail('info@stripe.com');
    expect(result.confidence).toBe(35);
    expect(result.status).toBe('risky');
  });

  it('marks support@ as risky', () => {
    const result = scoreEmail('support@company.com');
    expect(result.status).toBe('risky');
  });

  it('gives moderate confidence to single-name@.com pattern', () => {
    const result = scoreEmail('john@company.com');
    expect(result.confidence).toBe(68);
    expect(result.status).toBe('valid');
  });
});

describe('Intra-batch deduplication logic', () => {
  it('deduplicates same email across two sources in one batch', () => {
    const leads = [
      { email: 'john@stripe.com', name: 'John', source: 'apollo' },
      { email: 'john@stripe.com', name: 'John Doe', source: 'hunter' }, // duplicate
      { email: 'jane@stripe.com', name: 'Jane', source: 'apollo' },
    ];

    const seenInBatch = new Set<string>();
    const clean: typeof leads = [];
    const duplicates: typeof leads = [];

    for (const lead of leads) {
      const email = normalizeEmail(lead.email);
      if (seenInBatch.has(email)) {
        duplicates.push(lead);
      } else {
        seenInBatch.add(email);
        clean.push(lead);
      }
    }

    expect(clean).toHaveLength(2);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].source).toBe('hunter');
  });

  it('handles case-insensitive dedup', () => {
    const emails = ['John@Stripe.COM', 'john@stripe.com'];
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const e of emails) {
      const normalized = normalizeEmail(e);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(normalized);
      }
    }

    expect(deduped).toHaveLength(1);
  });
});

describe('Lead format guard', () => {
  it('rejects non-object leads', () => {
    const invalidLeads = [null, undefined, 'string', 42, [], true];
    const invalid: any[] = [];

    for (const lead of invalidLeads) {
      if (!lead || typeof lead !== 'object' || Array.isArray(lead)) {
        invalid.push(lead);
      }
    }

    expect(invalid).toHaveLength(invalidLeads.length);
  });

  it('accepts a plain object lead', () => {
    const lead = { email: 'test@stripe.com', name: 'Test User' };
    const isValid = lead && typeof lead === 'object' && !Array.isArray(lead);
    expect(isValid).toBe(true);
  });
});
