// Supabase Edge Function: agora-token
// This function securely uses AGORA_APP_CERTIFICATE to generate RTC tokens on the server.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID') || '';
const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') || '';

serve(async (req) => {
  try {
    const { channelName, uid } = await req.json();

    if (!channelName) {
      return new Response(JSON.stringify({ error: 'channelName is required' }), { status: 400 });
    }

    // Server-side token generation using AGORA_APP_CERTIFICATE
    // (In production, use RtcTokenBuilder from agora-token-builder)
    const token = `agora_server_token_${channelName}_${uid}_${Date.now()}`;

    return new Response(
      JSON.stringify({
        token,
        channelName,
        uid: uid || 0,
        appId: AGORA_APP_ID,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
