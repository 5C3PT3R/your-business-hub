import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hireregent.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const { source, data } = await req.json();

    // Validate required fields
    if (!data.email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing contact by email (deduplication)
    const { data: existingContacts } = await supabaseClient
      .from('contacts')
      .select('id, name, email')
      .eq('email', data.email.toLowerCase())
      .limit(1);

    let contactId: string;

    if (existingContacts && existingContacts.length > 0) {
      // Update existing contact - append source to history
      contactId = existingContacts[0].id;

      await supabaseClient
        .from('contacts')
        .update({
          // Update fields but don't overwrite existing data
          company: data.company || existingContacts[0].company,
          phone: data.phone || existingContacts[0].phone,
          position: data.position || existingContacts[0].position,
          // Add note about source
          notes: `Lead captured from ${source} on ${new Date().toISOString()}`,
        })
        .eq('id', contactId);

      console.log(`Updated existing contact ${contactId} from ${source}`);
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabaseClient
        .from('contacts')
        .insert([
          {
            name: data.name || data.first_name + ' ' + data.last_name || 'Unknown',
            first_name: data.first_name || null,
            last_name: data.last_name || null,
            email: data.email.toLowerCase(),
            phone: data.phone || null,
            company: data.company || null,
            position: data.position || data.job_title || null,
            lifecycle_stage: 'lead',
            lead_score: 0,
            status: 'active',
            notes: `Lead captured from ${source} on ${new Date().toISOString()}`,
            // Get workspace_id from auth context or default
            workspace_id: data.workspace_id || null,
          },
        ])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      contactId = newContact.id;
      console.log(`Created new contact ${contactId} from ${source}`);
    }

    // TODO: Trigger SDR Agent for qualification
    // This would invoke the agent execution logic

    // TODO: Trigger lead scoring calculation
    // This would invoke the lead-scoring edge function

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contactId,
        message: `Lead captured successfully from ${source}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error capturing lead:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
