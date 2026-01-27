import { supabase } from '@/integrations/supabase/client';

let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastPingTime = 0;
const MIN_PING_INTERVAL = 30000; // Minimum 30 seconds between pings

/**
 * Pings Supabase to keep the database warm and prevent cold starts.
 * Free tier databases go to sleep after inactivity, causing 4+ second delays.
 */
async function ping(force = false) {
  const now = Date.now();

  // Debounce: Don't ping if we pinged recently (unless forced)
  if (!force && now - lastPingTime < MIN_PING_INTERVAL) {
    return;
  }

  lastPingTime = now;

  try {
    const start = Date.now();
    // Simple lightweight query - just check if we can connect
    await supabase.from('profiles').select('id').limit(1);
    console.log(`[KeepAlive] Ping successful (${Date.now() - start}ms)`);
  } catch (error) {
    console.warn('[KeepAlive] Ping failed:', error);
  }
}

/**
 * Starts the keep-alive interval.
 * Pings Supabase every 4 minutes to prevent cold starts.
 */
export function startKeepAlive() {
  if (isRunning) return;

  isRunning = true;
  console.log('[KeepAlive] Starting keep-alive (every 4 minutes)');

  // Initial ping to warm up the database
  ping();

  // Ping every 4 minutes (240000ms)
  keepAliveInterval = setInterval(ping, 4 * 60 * 1000);

  // Also ping when the tab becomes visible again (user returns)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Stops the keep-alive interval.
 */
export function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  isRunning = false;
  console.log('[KeepAlive] Stopped');
}

/**
 * Handles tab visibility changes.
 * Pings when user returns to the tab after being away.
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    console.log('[KeepAlive] Tab visible - warming up database');
    ping();
  }
}
