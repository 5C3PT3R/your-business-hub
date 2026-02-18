-- RPC function for n8n to save messages to Supabase (WhatsApp, Instagram, etc.)
-- Handles find-or-create ticket logic in one call
-- p_channel defaults to 'whatsapp' for backward compatibility
CREATE OR REPLACE FUNCTION save_knight_whatsapp_message(
  p_workspace_id UUID,
  p_phone TEXT,
  p_customer_name TEXT,
  p_message TEXT,
  p_sender_type TEXT DEFAULT 'user',
  p_business_id TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'whatsapp'
) RETURNS JSONB AS $$
DECLARE
  v_ticket_id UUID;
  v_message_id UUID;
BEGIN
  -- Find existing open ticket for this handle
  SELECT id INTO v_ticket_id
  FROM public.tickets
  WHERE source_handle = p_phone
    AND status != 'resolved'
    AND workspace_id = p_workspace_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create new ticket if none found
  IF v_ticket_id IS NULL THEN
    INSERT INTO public.tickets (workspace_id, source_channel, source_handle, status, priority, summary, metadata)
    VALUES (p_workspace_id, p_channel, p_phone, 'open', 'medium', LEFT(p_message, 200),
            jsonb_build_object('customer_name', p_customer_name, 'business_id', p_business_id))
    RETURNING id INTO v_ticket_id;
  END IF;

  -- Save the message
  INSERT INTO public.ticket_messages (ticket_id, sender_type, content, metadata)
  VALUES (v_ticket_id, p_sender_type, p_message, jsonb_build_object('source', 'n8n'))
  RETURNING id INTO v_message_id;

  -- Update ticket timestamp
  UPDATE public.tickets SET updated_at = now() WHERE id = v_ticket_id;

  RETURN jsonb_build_object('ticket_id', v_ticket_id, 'message_id', v_message_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
