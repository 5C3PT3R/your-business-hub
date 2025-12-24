import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const recordingSid = formData.get('RecordingSid') as string;

    console.log('Twilio webhook received:', {
      callSid,
      callStatus,
      callDuration,
      recordingUrl,
      recordingSid,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update call log with status and recording
    if (callSid) {
      const updateData: Record<string, unknown> = {
        call_status: callStatus,
        updated_at: new Date().toISOString(),
      };

      if (callDuration) {
        updateData.duration_seconds = parseInt(callDuration, 10);
      }

      if (recordingUrl) {
        // Add .mp3 extension for downloadable recording
        updateData.recording_url = recordingUrl + '.mp3';
      }

      const { error } = await supabase
        .from('call_logs')
        .update(updateData)
        .eq('twilio_call_sid', callSid);

      if (error) {
        console.error('Error updating call log:', error);
      } else {
        console.log('Call log updated successfully');
      }
    }

    // Twilio expects a TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml' 
        } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', errorMessage);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml' 
        } 
      }
    );
  }
});
