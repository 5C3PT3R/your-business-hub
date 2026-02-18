import https from 'https';

const sql = `CREATE OR REPLACE FUNCTION save_knight_whatsapp_message(
  p_workspace_id UUID,
  p_phone TEXT,
  p_customer_name TEXT,
  p_message TEXT,
  p_sender_type TEXT DEFAULT 'user',
  p_business_id TEXT DEFAULT NULL
) RETURNS JSONB AS $func$
DECLARE
  v_ticket_id UUID;
  v_message_id UUID;
BEGIN
  SELECT id INTO v_ticket_id
  FROM public.tickets
  WHERE source_handle = p_phone
    AND status != 'resolved'
    AND workspace_id = p_workspace_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ticket_id IS NULL THEN
    INSERT INTO public.tickets (workspace_id, source_channel, source_handle, status, priority, summary, metadata)
    VALUES (p_workspace_id, 'whatsapp', p_phone, 'open', 'medium', LEFT(p_message, 200),
            jsonb_build_object('customer_name', p_customer_name, 'business_id', p_business_id))
    RETURNING id INTO v_ticket_id;
  END IF;

  INSERT INTO public.ticket_messages (ticket_id, sender_type, content, metadata)
  VALUES (v_ticket_id, p_sender_type, p_message, jsonb_build_object('source', 'n8n'))
  RETURNING id INTO v_message_id;

  UPDATE public.tickets SET updated_at = now() WHERE id = v_ticket_id;

  RETURN jsonb_build_object('ticket_id', v_ticket_id, 'message_id', v_message_id);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/pesqbkgfsfkqdquhilsv/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_d6e14ff3605f1b67d11daa92c63002efd37e2e28',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.write(body);
req.end();
