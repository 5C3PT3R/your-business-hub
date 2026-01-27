-- =============================================
-- RPC function to disconnect Meta integration
-- =============================================

CREATE OR REPLACE FUNCTION disconnect_meta_integration(
  p_workspace_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.meta_integrations
  SET
    access_token = NULL,
    is_connected = FALSE,
    connection_error = 'Disconnected by user'
  WHERE workspace_id = p_workspace_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION disconnect_meta_integration TO authenticated;
GRANT EXECUTE ON FUNCTION disconnect_meta_integration TO service_role;
