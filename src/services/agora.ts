/**
 * Agora RTC Service Integration.
 * Consumes EXPO_PUBLIC_AGORA_APP_ID and EXPO_PUBLIC_AGORA_APP_CERTIFICATE.
 * Manages real-time voice & video calling channels for UGNAY Emergency Response.
 */

import { Buffer } from 'buffer';

function polyfillUtilInherits(target: any) {
  if (!target) return;
  if (!target.util) target.util = {};
  if (typeof target.util.inherits !== 'function') {
    target.util.inherits = function (ctor: any, superCtor: any) {
      if (superCtor) {
        ctor.super_ = superCtor;
        Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
      }
    };
  }
}

if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  if (!g.process) g.process = {};
  if (!g.process.version) g.process.version = 'v18.0.0';
  if (g.process.browser === undefined) g.process.browser = true;
  g.Buffer = g.Buffer || Buffer;
  polyfillUtilInherits(g);
}
if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.process) w.process = {};
  if (!w.process.version) w.process.version = 'v18.0.0';
  if (w.process.browser === undefined) w.process.browser = true;
  w.Buffer = w.Buffer || Buffer;
  polyfillUtilInherits(w);
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '2822105ce1f1473e9140b1e77ef55393';
const AGORA_APP_CERTIFICATE = process.env.EXPO_PUBLIC_AGORA_APP_CERTIFICATE || '8947d8e360c0493e95291ba75ce6c9f0';

export interface AgoraTokenResponse {
  token: string | null;
  token006?: string | null;
  channelName: string;
  uid: number;
  appId: string;
}

export const AgoraService = {
  getAppId(): string {
    return AGORA_APP_ID;
  },

  getAppCertificate(): string {
    return AGORA_APP_CERTIFICATE;
  },

  async requestChannelToken(channelName: string, uid: number, customToken?: string): Promise<AgoraTokenResponse> {
    if (customToken && customToken.trim().length > 0) {
      return {
        token: customToken.trim(),
        token006: customToken.trim(),
        channelName,
        uid,
        appId: AGORA_APP_ID,
      };
    }

    try {
      if (AGORA_APP_ID && AGORA_APP_CERTIFICATE) {
        let tokenV2: string | null = null;
        let token006: string | null = null;

        // Try AccessToken2 token generation
        try {
          const { RtcTokenBuilder, RtcRole } = require('agora-token');
          const expirationInSeconds = 3600 * 24; // 24 hours validity
          tokenV2 = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channelName,
            uid,
            RtcRole.PUBLISHER,
            expirationInSeconds,
            expirationInSeconds
          );
        } catch (v2Err) {
          console.warn('[AgoraService] AccessToken2 generation warning:', v2Err);
        }

        // Try AccessToken006 token generation
        try {
          const { RtcTokenBuilder: RtcTokenBuilder006, Role: Role006 } = require('agora-token/src/RtcTokenBuilder');
          const expireTimestamp = Math.floor(Date.now() / 1000) + 3600 * 24;
          token006 = RtcTokenBuilder006.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channelName,
            uid,
            Role006.PUBLISHER,
            expireTimestamp
          );
        } catch (v006Err) {
          console.warn('[AgoraService] AccessToken006 generation warning:', v006Err);
        }

        console.log(
          '[AgoraService] AppID:', AGORA_APP_ID,
          'Cert:', AGORA_APP_CERTIFICATE ? `${AGORA_APP_CERTIFICATE.slice(0, 6)}...` : 'MISSING',
          'TokenV2:', tokenV2 ? `${tokenV2.slice(0, 15)}...` : 'NONE',
          'Token006:', token006 ? `${token006.slice(0, 15)}...` : 'NONE'
        );

        return {
          token: tokenV2 || token006,
          token006: token006 || tokenV2,
          channelName,
          uid,
          appId: AGORA_APP_ID,
        };
      }
    } catch (error) {
      console.error('[AgoraService] Detailed Token generation error:', error);
    }

    return {
      token: null,
      token006: null,
      channelName,
      uid,
      appId: AGORA_APP_ID,
    };
  },

  createEmergencyChannelName(incidentId: string): string {
    return `ugnay_emergency_${incidentId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  },

  /**
   * Starts Agora Cloud Real-Time Speech-to-Text (RTT) on the active emergency channel.
   * Requires Agora REST API credentials (Customer Key & Customer Secret).
   */
  async startRealTimeTranscription(
    channelName: string,
    languages: string[] = ['fil-PH', 'en-US']
  ): Promise<{ taskId: string; builderToken: string } | null> {
    const customerKey =
      process.env.EXPO_PUBLIC_AGORA_CUSTOMER_KEY ||
      process.env.EXPO_PUBLIC_AGORA_CUSTOMER_ID ||
      '';
    const customerSecret =
      process.env.EXPO_PUBLIC_AGORA_CUSTOMER_SECRET ||
      '';

    if (!customerKey || !customerSecret || !AGORA_APP_ID) {
      console.log(
        '[AgoraService] Agora REST API credentials not configured yet. Live streaming Web Speech active.'
      );
      return null;
    }

    try {
      const authRaw = `${customerKey}:${customerSecret}`;
      const basicAuth =
        typeof btoa !== 'undefined'
          ? btoa(authRaw)
          : typeof Buffer !== 'undefined'
          ? Buffer.from(authRaw).toString('base64')
          : '';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      };

      // Step 1: Acquire builder token
      const acquireRes = await fetch(
        `https://api.agora.io/api/speech-to-text/v1/projects/${AGORA_APP_ID}/acquire`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ instanceId: channelName }),
        }
      );

      if (!acquireRes.ok) {
        const errJson = await acquireRes.json().catch(() => ({}));
        console.warn('[Agora RTT] Acquire failed:', acquireRes.status, errJson);
        return null;
      }

      const acquireData = await acquireRes.json();
      const builderToken = acquireData.tokenName;
      if (!builderToken) return null;

      // Step 2: Start transcription task
      const botUid = 9999;
      const botTokenRes = await this.requestChannelToken(channelName, botUid);
      const startRes = await fetch(
        `https://api.agora.io/api/speech-to-text/v1/projects/${AGORA_APP_ID}/tasks?builderToken=${encodeURIComponent(builderToken)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            audio: {
              subscribeConfig: {
                subscribeMode: 'CHANNEL_MODE',
              },
              maxIdleTime: 60,
            },
            rtcConfig: {
              channelName,
              subBotUid: `${botUid}`,
              token: botTokenRes.token || undefined,
            },
            captionConfig: {
              languages,
            },
          }),
        }
      );

      if (startRes.ok) {
        const startData = await startRes.json();
        const taskId = startData.taskId || startData.id;
        console.log('[Agora RTT] Transcription successfully started! TaskId:', taskId);
        return { taskId, builderToken };
      } else {
        const errJson = await startRes.json().catch(() => ({}));
        console.warn('[Agora RTT] Start task warning:', startRes.status, errJson);
      }
    } catch (e) {
      console.warn('[Agora RTT] Start transcription error:', e);
    }
    return null;
  },

  /**
   * Parse Agora Real-Time Speech-to-Text stream data packets received via WebRTC data channel
   */
  parseStreamMessage(data: Uint8Array | any): { text: string; uid?: number; isFinal?: boolean } | null {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        return {
          text: parsed.text || parsed.transcript || data,
          uid: parsed.uid,
          isFinal: parsed.isFinal ?? true,
        };
      }

      if (data instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
        const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
        const decoded = decoder ? decoder.decode(data) : Buffer.from(data).toString('utf-8');

        // Check if JSON
        if (decoded.trim().startsWith('{')) {
          const parsed = JSON.parse(decoded);
          const words = parsed.words || parsed.text || '';
          return {
            text: typeof words === 'string' ? words : JSON.stringify(words),
            uid: parsed.uid,
            isFinal: parsed.isFinal ?? true,
          };
        }

        // Plain string fallback
        if (decoded && decoded.trim().length > 0) {
          // Strip non-printable protobuf binary control characters if present
          const clean = decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
          if (clean.length > 1) {
            return { text: clean, isFinal: true };
          }
        }
      }
    } catch (e) {
      // Binary packet decode fallback
    }
    return null;
  },
};
