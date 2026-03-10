/**
 * Shared auth helper for edge functions.
 * Validates the Bearer JWT and returns the authenticated user_id.
 * Returns null if the token is missing or invalid.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export async function getUserFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}
