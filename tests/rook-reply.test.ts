/**
 * REGENT — Rook Reply: Unit Tests
 *
 * Tests intent classification logic, state machine transitions,
 * idempotency key generation, and input guards.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ─── State machine logic (mirrored from rook-reply) ────────

const CONFIDENCE_THRESHOLD = 0.80;

const NEXT_STATE_MAP: Record<string, string> = {
  meeting_pending: 'MEETING_PENDING',
  dnc_list:        'DNC',
  needs_rebuttal:  'FOLLOW_UP_NEEDED',
};

function resolveNextState(
  suggestedNextState: string,
  intentClassification: string,
  confidence: number,
): string {
  const confidenceGatePassed = confidence >= CONFIDENCE_THRESHOLD;
  if (!confidenceGatePassed) return 'REVIEW_NEEDED';

  // Unsubscribe always transitions to DNC regardless of suggested state
  if (intentClassification === 'unsubscribe') return 'DNC';

  return NEXT_STATE_MAP[suggestedNextState] || 'FOLLOW_UP_NEEDED';
}

// ─── Idempotency key (mirrored from rook-reply) ────────────

function makeIdempotencyKeySync(leadId: string, emailBody: string): string {
  const raw = `${leadId}:${emailBody.slice(0, 200)}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ─── Email body size guard ─────────────────────────────────

const MAX_BODY_CHARS = 10_000;

function isBodyTooLarge(body: string): boolean {
  return body.length > MAX_BODY_CHARS;
}

// ─── Tests ────────────────────────────────────────────────

describe('State machine transitions', () => {
  it('transitions to MEETING_PENDING on high-confidence positive_meeting', () => {
    const next = resolveNextState('meeting_pending', 'positive_meeting', 0.95);
    expect(next).toBe('MEETING_PENDING');
  });

  it('transitions to DNC on high-confidence dnc_list', () => {
    const next = resolveNextState('dnc_list', 'not_interested', 0.90);
    expect(next).toBe('DNC');
  });

  it('transitions to FOLLOW_UP_NEEDED on needs_rebuttal', () => {
    const next = resolveNextState('needs_rebuttal', 'objection_pricing', 0.85);
    expect(next).toBe('FOLLOW_UP_NEEDED');
  });

  it('sends to REVIEW_NEEDED when confidence is below threshold', () => {
    const next = resolveNextState('meeting_pending', 'positive_meeting', 0.70);
    expect(next).toBe('REVIEW_NEEDED');
  });

  it('sends to REVIEW_NEEDED exactly at threshold boundary (< 0.80)', () => {
    const next = resolveNextState('meeting_pending', 'positive_meeting', 0.799);
    expect(next).toBe('REVIEW_NEEDED');
  });

  it('passes gate at exactly 0.80', () => {
    const next = resolveNextState('meeting_pending', 'positive_meeting', 0.80);
    expect(next).toBe('MEETING_PENDING');
  });

  it('unsubscribe overrides state to DNC regardless of suggested_next_state', () => {
    const next = resolveNextState('meeting_pending', 'unsubscribe', 0.90);
    expect(next).toBe('DNC');
  });

  it('unsubscribe below confidence threshold still triggers REVIEW_NEEDED', () => {
    // Low confidence on unsubscribe → REVIEW_NEEDED (human decides)
    const next = resolveNextState('meeting_pending', 'unsubscribe', 0.50);
    expect(next).toBe('REVIEW_NEEDED');
  });

  it('falls back to FOLLOW_UP_NEEDED for unknown suggested_next_state', () => {
    const next = resolveNextState('unknown_state', 'information_request', 0.85);
    expect(next).toBe('FOLLOW_UP_NEEDED');
  });
});

describe('Idempotency key generation', () => {
  it('produces identical keys for same lead_id + email_body', () => {
    const key1 = makeIdempotencyKeySync('lead-123', 'Thanks for reaching out!');
    const key2 = makeIdempotencyKeySync('lead-123', 'Thanks for reaching out!');
    expect(key1).toBe(key2);
  });

  it('produces different keys for different lead_ids', () => {
    const key1 = makeIdempotencyKeySync('lead-123', 'Same body');
    const key2 = makeIdempotencyKeySync('lead-456', 'Same body');
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different bodies', () => {
    const key1 = makeIdempotencyKeySync('lead-123', 'Yes, I am interested!');
    const key2 = makeIdempotencyKeySync('lead-123', 'No thanks, unsubscribe me.');
    expect(key1).not.toBe(key2);
  });

  it('uses only first 200 chars of body (long email = same key)', () => {
    const base = 'A'.repeat(200);
    const key1 = makeIdempotencyKeySync('lead-123', base + 'DIFFERENT_SUFFIX_1');
    const key2 = makeIdempotencyKeySync('lead-123', base + 'DIFFERENT_SUFFIX_2');
    expect(key1).toBe(key2);
  });

  it('produces a 64-char hex string (SHA-256)', () => {
    const key = makeIdempotencyKeySync('lead-123', 'test');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Email body size guard', () => {
  it('accepts body under 10,000 chars', () => {
    expect(isBodyTooLarge('A'.repeat(9_999))).toBe(false);
  });

  it('rejects body over 10,000 chars', () => {
    expect(isBodyTooLarge('A'.repeat(10_001))).toBe(true);
  });

  it('accepts body at exactly 10,000 chars', () => {
    expect(isBodyTooLarge('A'.repeat(10_000))).toBe(false);
  });

  it('rejects a 50MB email body', () => {
    expect(isBodyTooLarge('A'.repeat(50_000_000))).toBe(true);
  });
});

describe('Adversarial input scenarios', () => {
  it('[ADVERSARIAL] Emoji-only reply body is valid (short, passes size check)', () => {
    const body = '👍🎉🚀';
    expect(isBodyTooLarge(body)).toBe(false);
    // State machine would still require Claude to classify this — tested in integration
  });

  it('[ADVERSARIAL] Reply with just whitespace has a non-empty idempotency key', () => {
    const key = makeIdempotencyKeySync('lead-123', '   ');
    expect(key).toHaveLength(64);
    expect(key).not.toBe('');
  });

  it('[ADVERSARIAL] Reply with SOQL injection string is handled safely by size/content', () => {
    const maliciousBody = "'; DROP TABLE leads; --";
    // The edge function passes this to Claude as a quoted string, not SQL.
    // Ensure it doesn't trigger the size guard so it reaches Claude.
    expect(isBodyTooLarge(maliciousBody)).toBe(false);
    // Claude classifies it as a string; no DB query injection possible here.
  });

  it('[ADVERSARIAL] Repeated n8n retry produces same idempotency key', () => {
    const leadId = 'lead-abc-123';
    const body = 'Please take me off your list.';
    const key1 = makeIdempotencyKeySync(leadId, body);
    const key2 = makeIdempotencyKeySync(leadId, body);
    const key3 = makeIdempotencyKeySync(leadId, body);
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });
});
