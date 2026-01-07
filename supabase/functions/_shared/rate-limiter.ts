/**
 * Rate limiting middleware for API endpoints
 * Prevents abuse and ensures fair usage
 *
 * Default: 100 requests per minute per user
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMinutes: number; // Time window in minutes
  blockDurationMinutes?: number; // How long to block after limit exceeded
}

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'gmail-oauth': { maxRequests: 10, windowMinutes: 60 }, // OAuth attempts
  'gmail-webhook': { maxRequests: 1000, windowMinutes: 1 }, // High volume expected
  'gmail-send': { maxRequests: 100, windowMinutes: 60 }, // Email sending
  'default': { maxRequests: 100, windowMinutes: 1 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry allowed
}

/**
 * Check if user is within rate limits
 * @param supabase - Supabase client
 * @param userId - User ID to check
 * @param endpoint - Endpoint name (e.g., 'gmail-oauth')
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const limitConfig = config || DEFAULT_RATE_LIMITS[endpoint] || DEFAULT_RATE_LIMITS.default;

  try {
    // Check if user is currently blocked
    const { data: blockedCheck } = await supabase
      .from('rate_limits')
      .select('blocked_until')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .single();

    if (blockedCheck?.blocked_until) {
      const blockedUntil = new Date(blockedCheck.blocked_until);
      if (blockedUntil > new Date()) {
        const retryAfter = Math.ceil((blockedUntil.getTime() - Date.now()) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedUntil,
          retryAfter,
        };
      }
    }

    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - limitConfig.windowMinutes);

    // Get or create rate limit entry
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (!existing) {
      // First request in this window
      await supabase.from('rate_limits').insert({
        user_id: userId,
        endpoint: endpoint,
        request_count: 1,
        window_start: new Date().toISOString(),
        last_request_at: new Date().toISOString(),
      });

      const resetAt = new Date();
      resetAt.setMinutes(resetAt.getMinutes() + limitConfig.windowMinutes);

      return {
        allowed: true,
        remaining: limitConfig.maxRequests - 1,
        resetAt,
      };
    }

    // Check if limit exceeded
    if (existing.request_count >= limitConfig.maxRequests) {
      // Block user if configured
      if (limitConfig.blockDurationMinutes) {
        const blockedUntil = new Date();
        blockedUntil.setMinutes(blockedUntil.getMinutes() + limitConfig.blockDurationMinutes);

        await supabase
          .from('rate_limits')
          .update({ blocked_until: blockedUntil.toISOString() })
          .eq('user_id', userId)
          .eq('endpoint', endpoint);

        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedUntil,
          retryAfter: limitConfig.blockDurationMinutes * 60,
        };
      }

      const resetAt = new Date(existing.window_start);
      resetAt.setMinutes(resetAt.getMinutes() + limitConfig.windowMinutes);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
      };
    }

    // Increment counter
    await supabase
      .from('rate_limits')
      .update({
        request_count: existing.request_count + 1,
        last_request_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('window_start', existing.window_start);

    const resetAt = new Date(existing.window_start);
    resetAt.setMinutes(resetAt.getMinutes() + limitConfig.windowMinutes);

    return {
      allowed: true,
      remaining: limitConfig.maxRequests - (existing.request_count + 1),
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limiting system is down
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(),
    };
  }
}

/**
 * Middleware to enforce rate limits and return appropriate headers
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param endpoint - Endpoint name
 * @param config - Optional rate limit config
 * @returns Response if blocked, null if allowed
 */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  config?: RateLimitConfig
): Promise<Response | null> {
  const result = await checkRateLimit(supabase, userId, endpoint, config);

  const headers = new Headers({
    'X-RateLimit-Limit': String(config?.maxRequests || 100),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
  });

  if (!result.allowed) {
    headers.set('Retry-After', String(result.retryAfter || 60));

    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        resetAt: result.resetAt.toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(headers),
        },
      }
    );
  }

  return null; // Allowed - caller should add headers to success response
}

/**
 * Clean up old rate limit entries (run periodically)
 */
export async function cleanupOldRateLimits(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24); // Keep 24 hours of history

  await supabase
    .from('rate_limits')
    .delete()
    .lt('window_start', cutoff.toISOString())
    .is('blocked_until', null);

  // Clean up expired blocks
  await supabase
    .from('rate_limits')
    .update({ blocked_until: null })
    .lt('blocked_until', new Date().toISOString());
}
