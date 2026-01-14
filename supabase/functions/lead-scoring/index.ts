import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadScoreFactors {
  jobTitleScore: number;
  companySizeScore: number;
  engagementScore: number;
  dataCompletenessScore: number;
  verificationScore: number;
}

// Calculate lead score based on multiple factors
function calculateLeadScore(contact: any, activities: any[]): { score: number; factors: LeadScoreFactors } {
  const factors: LeadScoreFactors = {
    jobTitleScore: 0,
    companySizeScore: 0,
    engagementScore: 0,
    dataCompletenessScore: 0,
    verificationScore: 0,
  };

  // 1. Job Title Seniority Score (0-25 points)
  const position = (contact.position || '').toLowerCase();
  if (position.includes('ceo') || position.includes('founder') || position.includes('president')) {
    factors.jobTitleScore = 25;
  } else if (position.includes('vp') || position.includes('vice president') || position.includes('chief')) {
    factors.jobTitleScore = 20;
  } else if (position.includes('director') || position.includes('head of')) {
    factors.jobTitleScore = 15;
  } else if (position.includes('manager') || position.includes('lead')) {
    factors.jobTitleScore = 10;
  } else if (position) {
    factors.jobTitleScore = 5;
  }

  // 2. Company Size Score (0-20 points)
  // This would come from enrichment data - for now, check if company exists
  if (contact.company) {
    factors.companySizeScore = 15; // Default if company exists
  }

  // 3. Engagement Score (0-30 points)
  const recentActivities = activities.filter((a) => {
    const activityDate = new Date(a.created_at);
    const daysSince = (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  });

  // Points based on activity count and recency
  const emailOpens = recentActivities.filter((a) => a.type === 'email_open').length;
  const emailReplies = recentActivities.filter((a) => a.type === 'email_reply').length;
  const calls = recentActivities.filter((a) => a.type === 'call').length;
  const meetings = recentActivities.filter((a) => a.type === 'meeting').length;

  factors.engagementScore = Math.min(30,
    emailOpens * 2 +
    emailReplies * 5 +
    calls * 10 +
    meetings * 15
  );

  // 4. Data Completeness Score (0-15 points)
  let completedFields = 0;
  const requiredFields = ['name', 'email', 'phone', 'company', 'position'];
  requiredFields.forEach((field) => {
    if (contact[field]) completedFields++;
  });
  factors.dataCompletenessScore = (completedFields / requiredFields.length) * 15;

  // 5. Verification Score (0-10 points)
  if (contact.email_verified) factors.verificationScore += 5;
  if (contact.phone_valid) factors.verificationScore += 5;

  // Calculate total score
  const totalScore = Math.min(100,
    factors.jobTitleScore +
    factors.companySizeScore +
    factors.engagementScore +
    factors.dataCompletenessScore +
    factors.verificationScore
  );

  return { score: Math.round(totalScore), factors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contact_id, workspace_id } = await req.json();

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contact
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent activities for this contact
    const { data: activities } = await supabaseClient
      .from('activities')
      .select('*')
      .eq('related_contact_id', contact_id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate score
    const { score, factors } = calculateLeadScore(contact, activities || []);

    // Update contact with new score
    const { error: updateError } = await supabaseClient
      .from('contacts')
      .update({
        lead_score: score,
        data_completeness: Math.round(factors.dataCompletenessScore / 15 * 100),
      })
      .eq('id', contact_id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated lead score for ${contact_id}: ${score}`);

    return new Response(
      JSON.stringify({
        success: true,
        contact_id,
        lead_score: score,
        factors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error calculating lead score:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
