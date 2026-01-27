-- =============================================
-- RPC functions for meta_pages table
-- =============================================

-- Save a single Meta page
CREATE OR REPLACE FUNCTION save_meta_page(
  p_integration_id UUID,
  p_user_id UUID,
  p_page_id TEXT,
  p_page_name TEXT,
  p_page_access_token TEXT,
  p_page_category TEXT DEFAULT NULL,
  p_page_picture_url TEXT DEFAULT NULL,
  p_instagram_account_id TEXT DEFAULT NULL,
  p_instagram_username TEXT DEFAULT NULL
)
RETURNS SETOF meta_pages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.meta_pages (
    integration_id,
    user_id,
    page_id,
    page_name,
    page_access_token,
    page_category,
    page_picture_url,
    instagram_account_id,
    instagram_username,
    has_posting_access,
    is_active
  )
  VALUES (
    p_integration_id,
    p_user_id,
    p_page_id,
    p_page_name,
    p_page_access_token,
    p_page_category,
    p_page_picture_url,
    p_instagram_account_id,
    p_instagram_username,
    TRUE,
    TRUE
  )
  ON CONFLICT (integration_id, page_id) DO UPDATE SET
    page_name = EXCLUDED.page_name,
    page_access_token = EXCLUDED.page_access_token,
    page_category = EXCLUDED.page_category,
    page_picture_url = EXCLUDED.page_picture_url,
    instagram_account_id = EXCLUDED.instagram_account_id,
    instagram_username = EXCLUDED.instagram_username,
    is_active = TRUE
  RETURNING *;
END;
$$;

-- Get Meta pages for an integration
CREATE OR REPLACE FUNCTION get_meta_pages(
  p_integration_id UUID
)
RETURNS SETOF meta_pages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.meta_pages
  WHERE integration_id = p_integration_id
  AND is_active = TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_meta_page TO authenticated;
GRANT EXECUTE ON FUNCTION save_meta_page TO service_role;
GRANT EXECUTE ON FUNCTION get_meta_pages TO authenticated;
GRANT EXECUTE ON FUNCTION get_meta_pages TO service_role;
