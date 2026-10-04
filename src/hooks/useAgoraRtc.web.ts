import { useState, useEffect, useRef } from 'react';
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { AgoraService } from '@/services/agora';

export interface UseAgoraRtcReturn {
  joined: boolean;
  localAudioTrack: IMicrophoneAudioTrack | null;
  localVideoTrack: ICameraVideoTrack | null;
  remoteUser: IAgoraRTCRemoteUser | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  isMuted: boolean;
  isVideoOn: boolean;
  isCallEnded: boolean;
  audioLevel: number;
  remoteAudioLevel: number;
  mediaError: string | null;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  streamTranscript: { text: string; uid?: number; isFinal?: boolean } | null;
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  endCall: () => Promise<void>;
  reconnect: () => Promise<void>;
}

export function useAgoraRtc(
  channelName: string,
  uid: number,
  tempToken?: string
): UseAgoraRtcReturn {
  const [joined, setJoined] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [streamTranscript, setStreamTranscript] = useState<{ text: string; uid?: number; isFinal?: boolean } | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (typeof window === 'undefined' || !channelName || !uid) return;

    setIsCallEnded(false);
    setMediaError(null);
    setConnectionState('connecting');

    const initAgoraRtc = async () => {
      try {
        const AgoraRTCModule = await import('agora-rtc-sdk-ng');
        const AgoraRTC = AgoraRTCModule.default || AgoraRTCModule;
        try { AgoraRTC.setLogLevel(3); } catch (e) {}

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        let hasPublished = false;
        const publishTracksSafely = async () => {
          if (hasPublished || !clientRef.current || !isMounted) return;
          const c = clientRef.current;
          const tracks = [localAudioTrackRef.current, localVideoTrackRef.current].filter(Boolean) as any[];
          if (tracks.length === 0) return;

          if (c.connectionState === 'CONNECTED') {
            try {
              await c.publish(tracks);
              hasPublished = true;
              console.log('[Agora Web] Local audio/video tracks published successfully!');
            } catch (pubErr: any) {
              console.warn('[Agora Web] Failed to publish tracks:', pubErr?.message || pubErr);
            }
          }
        };

        client.on('user-published', async (user, mediaType) => {
          if (!isMounted) return;
          try {
            await client.subscribe(user, mediaType);
            setRemoteUsers((prev) => {
              const exists = prev.some((u) => u.uid === user.uid);
              return exists ? prev.map((u) => (u.uid === user.uid ? user : u)) : [...prev, user];
            });
            setRemoteUser(user);

            if (mediaType === 'audio' && user.audioTrack) {
              try {
                await user.audioTrack.play();
                console.log('[Agora Web] Remote audio track playing successfully!');
              } catch (playErr) {
                console.warn('[Agora Web] Remote audio play blocked by autoplay, attaching user gesture listener:', playErr);
                const unlock = () => {
                  try { user.audioTrack?.play(); } catch (e) {}
                  window.removeEventListener('click', unlock);
                  window.removeEventListener('touchstart', unlock);
                };
                window.addEventListener('click', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
              }
            }
          } catch (subErr) {
            console.warn('Error subscribing to remote Agora user:', subErr);
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (!isMounted) return;
          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.stop();
          }
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          setRemoteUser((prev) => (prev?.uid === user.uid ? null : prev));
        });

        client.on('user-left', (user) => {
          if (!isMounted) return;
          if (user.audioTrack) user.audioTrack.stop();
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          setRemoteUser((prev) => (prev?.uid === user.uid ? null : prev));
        });

        client.on('stream-message', (userUid, data) => {
          if (!isMounted) return;
          const parsed = AgoraService.parseStreamMessage(data);
          if (parsed && parsed.text) {
            setStreamTranscript({
              text: parsed.text,
              uid: Number(userUid) || 0,
              isFinal: parsed.isFinal ?? true,
            });
          }
        });

        client.on('connection-state-change', (curState) => {
          if (!isMounted) return;
          if (curState === 'CONNECTED') {
            setConnectionState('connected');
            publishTracksSafely();
          }
          else if (curState === 'CONNECTING' || curState === 'RECONNECTING') setConnectionState('connecting');
          else if (curState === 'DISCONNECTED') setConnectionState('disconnected');
          else setConnectionState('failed');
        });

        const tokenRes = await AgoraService.requestChannelToken(channelName, uid, tempToken);
        if (!isMounted) return;

        // Build list of candidate tokens to try sequentially
        const candidates = [
          tokenRes.token,
          tokenRes.token006,
          null, // Fallback for static AppID mode (No App Certificate)
        ].filter((t, idx, arr) => t !== undefined && arr.indexOf(t) === idx);

        let joinSuccess = false;
        let lastError: any = null;

        for (const candidateToken of candidates) {
          try {
            console.log(`[Agora Hook] Attempting join (Token: ${candidateToken ? `${candidateToken.slice(0, 15)}...` : 'NULL STATIC'}, Channel: ${channelName}, UID: ${uid})`);
            await client.join(tokenRes.appId, channelName, candidateToken || null, uid);
            joinSuccess = true;
            console.log('[Agora Hook] Successfully joined Agora RTC channel!');
            break;
          } catch (joinErr: any) {
            lastError = joinErr;
            const errMsg = joinErr?.message || String(joinErr);
            console.warn(`[Agora Hook] Join candidate failed (${candidateToken ? 'dynamic' : 'static'}):`, errMsg);
          }
        }

        if (!joinSuccess) {
          throw lastError || new Error('All Agora RTC join attempts failed.');
        }

        if (!isMounted) return;
        setJoined(true);
        setConnectionState('connected');

        // Automatically start Agora Real-Time Speech-to-Text if credentials configured
        AgoraService.startRealTimeTranscription(channelName).catch(() => {});

        // Create Microphone and Camera tracks with mobile-friendly fallbacks
        let micTrack: IMicrophoneAudioTrack | null = null;
        try {
          micTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
          });
        } catch (micErr) {
          console.warn('[Agora Web] Standard mic config failed, retrying default mic:', micErr);
          try {
            micTrack = await AgoraRTC.createMicrophoneAudioTrack();
          } catch (micFallbackErr) {
            console.warn('[Agora Web] Microphone capture failed:', micFallbackErr);
          }
        }

        if (micTrack) {
          localAudioTrackRef.current = micTrack;
          if (isMounted) setLocalAudioTrack(micTrack);
        }

        let camTrack: ICameraVideoTrack | null = null;
        try {
          camTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '360p_1',
            facingMode: 'user',
          });
        } catch (camErr) {
          console.warn('[Agora Web] 360p camera config failed, retrying default camera:', camErr);
          try {
            camTrack = await AgoraRTC.createCameraVideoTrack();
          } catch (camFallbackErr) {
            console.warn('[Agora Web] Camera capture failed:', camFallbackErr);
            if (isMounted) setMediaError('Camera unavailable — audio calling active');
          }
        }

        if (camTrack) {
          localVideoTrackRef.current = camTrack;
          if (isMounted) setLocalVideoTrack(camTrack);
        }

        if (!isMounted) return;

        // Safely publish tracks (or publish as soon as connection completes)
        await publishTracksSafely();
      } catch (err: any) {
        console.error('Agora client initialization error:', err);
        if (isMounted) {
          setConnectionState('failed');
          setMediaError(err?.message || 'Failed to connect to Agora RTC');
        }
      }
    };

    initAgoraRtc();

    return () => {
      isMounted = false;
      if (localAudioTrackRef.current) {
        try {
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current.close();
        } catch (e) {}
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        try {
          localVideoTrackRef.current.stop();
          localVideoTrackRef.current.close();
        } catch (e) {}
        localVideoTrackRef.current = null;
      }
      if (clientRef.current) {
        const c = clientRef.current;
        clientRef.current = null;
        try {
          if (c.connectionState === 'CONNECTED') {
            c.leave().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, [channelName, uid, tempToken]);

  // Dynamic Volume Level Monitor
  useEffect(() => {
    const interval = setInterval(() => {
      if (localAudioTrackRef.current) {
        const lvl = Math.round((localAudioTrackRef.current.getVolumeLevel() || 0) * 100);
        setAudioLevel(lvl);
      } else {
        setAudioLevel(0);
      }

      if (remoteUser?.audioTrack) {
        const rLvl = Math.round((remoteUser.audioTrack.getVolumeLevel() || 0) * 100);
        setRemoteAudioLevel(rLvl);
      } else {
        setRemoteAudioLevel(0);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [remoteUser]);

  const toggleMute = async () => {
    if (localAudioTrackRef.current) {
      const nextMute = !isMuted;
      await localAudioTrackRef.current.setEnabled(!nextMute);
      setIsMuted(nextMute);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrackRef.current) {
      const nextVideo = !isVideoOn;
      await localVideoTrackRef.current.setEnabled(nextVideo);
      setIsVideoOn(nextVideo);
    }
  };

  const endCall = async () => {
    setIsCallEnded(true);
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = null;
    }
    if (clientRef.current) {
      await clientRef.current.leave().catch(() => {});
      clientRef.current = null;
    }
    setJoined(false);
  };

  const reconnect = async () => {
    setConnectionState('connecting');
    setMediaError(null);
    if (clientRef.current) {
      try {
        const tokenRes = await AgoraService.requestChannelToken(channelName, uid, tempToken);
        const tok = tokenRes.token || tokenRes.token006 || null;
        await clientRef.current.join(tokenRes.appId, channelName, tok, uid);
        setJoined(true);
        setConnectionState('connected');
      } catch (err: any) {
        console.warn('Reconnection error:', err);
        setConnectionState('failed');
        setMediaError(err?.message || 'Failed to reconnect');
      }
    }
  };

  return {
    joined,
    localAudioTrack,
    localVideoTrack,
    remoteUser,
    remoteUsers,
    isMuted,
    isVideoOn,
    isCallEnded,
    audioLevel,
    remoteAudioLevel,
    mediaError,
    connectionState,
    streamTranscript,
    toggleMute,
    toggleVideo,
    endCall,
    reconnect,
  };
}
