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
};
