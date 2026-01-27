/**
 * Meta API Service
 *
 * Handles Facebook, Instagram, WhatsApp Business, and Ads Manager integrations.
 *
 * Features:
 * - OAuth flow and token management
 * - Facebook Pages & Instagram accounts
 * - Lead Ads capture and sync
 * - WhatsApp Business messaging
 * - Ads Manager campaigns
 */

import { supabase } from '@/integrations/supabase/client';

// =====================================================
// CONFIGURATION
// =====================================================

const META_API_VERSION = 'v18.0';
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// OAuth Scopes for different features
// NOTE: Most scopes require App Review for production
// In development mode, only basic scopes work without review
export const META_SCOPES = {
  // Core - always available
  basic: ['public_profile'],

  // Pages - minimal scopes for development
  pages: [
    'pages_show_list',
    'pages_read_engagement',
  ],

  // Lead Ads - requires App Review
  leads: [
    'leads_retrieval',
  ],

  // WhatsApp - requires App Review
  whatsapp: [
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ],

  // Ads Manager - requires App Review
  ads: [
    'ads_read',
    'business_management',
  ],
};

// =====================================================
// TYPES
// =====================================================

export interface MetaIntegration {
  id: string;
  user_id: string;
  workspace_id: string;
  app_id: string;
  access_token: string | null;
  token_expires_at: string | null;
  facebook_user_id: string | null;
  facebook_user_name: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
  connection_error: string | null;
}

export interface MetaPage {
  id: string;
  integration_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  page_category: string | null;
  page_picture_url: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  has_lead_access: boolean;
  has_messaging_access: boolean;
  has_posting_access: boolean;
  has_ads_access: boolean;
  is_active: boolean;
}

export interface MetaAdAccount {
  id: string;
  integration_id: string;
  ad_account_id: string;
  account_name: string | null;
  account_status: number;
  currency: string;
  business_name: string | null;
  amount_spent: number;
  is_active: boolean;
}

export interface MetaLeadForm {
  id: string;
  page_id: string;
  form_id: string;
  form_name: string;
  status: string;
  leads_count: number;
  auto_import_leads: boolean;
  field_mapping: Record<string, string>;
}

export interface FacebookLead {
  id: string;
  created_time: string;
  field_data: Array<{ name: string; values: string[] }>;
}

export interface MetaWhatsAppAccount {
  id: string;
  integration_id: string;
  waba_id: string;
  waba_name: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  messaging_limit: string | null;
  is_active: boolean;
}

// =====================================================
// OAUTH & TOKEN MANAGEMENT
// =====================================================

/**
 * Generate OAuth URL for Meta Login
 */
export function getMetaOAuthUrl(
  appId: string,
  redirectUri: string,
  features: ('pages' | 'leads' | 'whatsapp' | 'ads')[] = ['pages']
): string {
  // Combine all required scopes
  const scopes = new Set<string>(META_SCOPES.basic);
  features.forEach(feature => {
    META_SCOPES[feature].forEach(scope => scopes.add(scope));
  });

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: Array.from(scopes).join(','),
    response_type: 'code',
    state: crypto.randomUUID(), // CSRF protection
  });

  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(
      `${META_GRAPH_URL}/oauth/access_token?${params}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta token exchange error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return null;
  }
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${META_GRAPH_URL}/oauth/access_token?${params}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta long-lived token error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting long-lived token:', error);
    return null;
  }
}

/**
 * Get current user info from Meta
 */
export async function getMetaUser(accessToken: string): Promise<{
  id: string;
  name: string;
  email?: string;
} | null> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/me?fields=id,name,email&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta user fetch error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Meta user:', error);
    return null;
  }
}

// =====================================================
// PAGES & INSTAGRAM
// =====================================================

/**
 * Get all Facebook Pages the user manages
 */
export async function getUserPages(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  access_token: string;
  category: string;
  picture: { data: { url: string } };
  instagram_business_account?: { id: string; username: string };
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/me/accounts?fields=id,name,access_token,category,picture,instagram_business_account{id,username}&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta pages fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
}

/**
 * Post to Facebook Page
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  message: string,
  link?: string,
  imageUrl?: string
): Promise<{ id: string } | null> {
  try {
    const body: Record<string, string> = { message };
    if (link) body.link = link;
    if (imageUrl) body.url = imageUrl;

    const endpoint = imageUrl ? `${pageId}/photos` : `${pageId}/feed`;

    const response = await fetch(
      `${META_GRAPH_URL}/${endpoint}?access_token=${pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Meta post error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error posting to Facebook:', error);
    return null;
  }
}

/**
 * Post to Instagram
 */
export async function postToInstagram(
  igAccountId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string } | null> {
  try {
    // Step 1: Create media container
    const containerResponse = await fetch(
      `${META_GRAPH_URL}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${pageAccessToken}`,
      { method: 'POST' }
    );

    if (!containerResponse.ok) {
      const error = await containerResponse.json();
      console.error('Instagram container error:', error);
      return null;
    }

    const { id: containerId } = await containerResponse.json();

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `${META_GRAPH_URL}/${igAccountId}/media_publish?creation_id=${containerId}&access_token=${pageAccessToken}`,
      { method: 'POST' }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      console.error('Instagram publish error:', error);
      return null;
    }

    return await publishResponse.json();
  } catch (error) {
    console.error('Error posting to Instagram:', error);
    return null;
  }
}

// =====================================================
// LEAD ADS
// =====================================================

/**
 * Get Lead Forms for a Page
 */
export async function getPageLeadForms(
  pageId: string,
  pageAccessToken: string
): Promise<Array<{
  id: string;
  name: string;
  status: string;
  leads_count: number;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${pageId}/leadgen_forms?fields=id,name,status,leads_count&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Lead forms fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching lead forms:', error);
    return [];
  }
}

/**
 * Get Leads from a Form
 */
export async function getFormLeads(
  formId: string,
  pageAccessToken: string,
  limit: number = 50
): Promise<FacebookLead[]> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${formId}/leads?fields=id,created_time,field_data&limit=${limit}&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Leads fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
}

/**
 * Convert Facebook Lead to CRM Lead format
 */
export function convertFacebookLeadToCRM(
  fbLead: FacebookLead,
  fieldMapping: Record<string, string> = {}
): {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: string;
  metadata: Record<string, any>;
} {
  const data: Record<string, string> = {};

  // Parse field data
  fbLead.field_data.forEach(field => {
    const value = field.values[0] || '';
    const mappedField = fieldMapping[field.name] || field.name;
    data[mappedField] = value;
  });

  return {
    name: data.full_name || data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown',
    email: data.email || '',
    phone: data.phone_number || data.phone || null,
    company: data.company_name || data.company || null,
    source: 'Facebook Lead Ad',
    metadata: {
      facebook_lead_id: fbLead.id,
      created_time: fbLead.created_time,
      raw_fields: fbLead.field_data,
    },
  };
}

// =====================================================
// WHATSAPP BUSINESS
// =====================================================

/**
 * Get WhatsApp Business Accounts
 */
export async function getWhatsAppAccounts(
  businessId: string,
  accessToken: string
): Promise<Array<{
  id: string;
  name: string;
  currency: string;
  timezone_id: string;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${businessId}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp accounts fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error);
    return [];
  }
}

/**
 * Get WhatsApp Phone Numbers
 */
export async function getWhatsAppPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<Array<{
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp phone numbers fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching WhatsApp phone numbers:', error);
    return [];
  }
}

/**
 * Send WhatsApp Template Message
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  components?: any[]
): Promise<{ messages: Array<{ id: string }> } | null> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp send error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return null;
  }
}

/**
 * Send WhatsApp Text Message
 */
export async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<{ messages: Array<{ id: string }> } | null> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp text send error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp text:', error);
    return null;
  }
}

// =====================================================
// ADS MANAGER
// =====================================================

/**
 * Get Ad Accounts
 */
export async function getAdAccounts(accessToken: string): Promise<Array<{
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business_name: string;
  amount_spent: string;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,business_name,amount_spent&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Ad accounts fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    return [];
  }
}

/**
 * Get Campaigns for an Ad Account
 */
export async function getCampaigns(
  adAccountId: string,
  accessToken: string
): Promise<Array<{
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: string;
  lifetime_budget: string;
  start_time: string;
  stop_time: string;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Campaigns fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
}

/**
 * Get Ad Insights (Performance Data)
 */
export async function getAdInsights(
  adAccountId: string,
  accessToken: string,
  datePreset: string = 'last_30d'
): Promise<Array<{
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
}>> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${adAccountId}/insights?fields=impressions,clicks,spend,reach,cpc,cpm,ctr&date_preset=${datePreset}&access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Ad insights fetch error:', error);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching ad insights:', error);
    return [];
  }
}

// =====================================================
// DATABASE HELPERS
// =====================================================

/**
 * Save or update Meta integration
 */
export async function saveMetaIntegration(
  userId: string,
  workspaceId: string,
  data: {
    app_id: string;
    access_token: string;
    token_expires_at?: Date;
    facebook_user_id: string;
    facebook_user_name: string;
  }
): Promise<MetaIntegration | null> {
  const { data: integration, error } = await supabase
    .from('meta_integrations')
    .upsert({
      user_id: userId,
      workspace_id: workspaceId,
      app_id: data.app_id,
      access_token: data.access_token,
      token_expires_at: data.token_expires_at?.toISOString(),
      facebook_user_id: data.facebook_user_id,
      facebook_user_name: data.facebook_user_name,
      is_connected: true,
      last_synced_at: new Date().toISOString(),
      connection_error: null,
    }, {
      onConflict: 'workspace_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving Meta integration:', error);
    return null;
  }

  return integration as MetaIntegration;
}

/**
 * Get Meta integration for workspace
 */
export async function getMetaIntegration(
  workspaceId: string
): Promise<MetaIntegration | null> {
  const { data, error } = await supabase
    .from('meta_integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching Meta integration:', error);
    }
    return null;
  }

  return data as MetaIntegration;
}

/**
 * Disconnect Meta integration
 */
export async function disconnectMetaIntegration(
  workspaceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('meta_integrations')
    .update({
      access_token: null,
      is_connected: false,
      connection_error: 'Disconnected by user',
    })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error disconnecting Meta:', error);
    return false;
  }

  return true;
}

/**
 * Save connected pages
 */
export async function saveMetaPages(
  integrationId: string,
  userId: string,
  pages: Array<{
    id: string;
    name: string;
    access_token: string;
    category: string;
    picture: { data: { url: string } };
    instagram_business_account?: { id: string; username: string };
  }>
): Promise<boolean> {
  const pageRecords = pages.map(page => ({
    integration_id: integrationId,
    user_id: userId,
    page_id: page.id,
    page_name: page.name,
    page_access_token: page.access_token,
    page_category: page.category,
    page_picture_url: page.picture?.data?.url,
    instagram_account_id: page.instagram_business_account?.id || null,
    instagram_username: page.instagram_business_account?.username || null,
    has_posting_access: true,
    is_active: true,
  }));

  const { error } = await supabase
    .from('meta_pages')
    .upsert(pageRecords, {
      onConflict: 'integration_id,page_id',
    });

  if (error) {
    console.error('Error saving Meta pages:', error);
    return false;
  }

  return true;
}

/**
 * Get connected pages for integration
 */
export async function getMetaPages(
  integrationId: string
): Promise<MetaPage[]> {
  const { data, error } = await supabase
    .from('meta_pages')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching Meta pages:', error);
    return [];
  }

  return (data || []) as MetaPage[];
}
