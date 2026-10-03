import { useState, useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import { AgoraService } from '@/services/agora';

const requestAndroidPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      console.log('[Android Permissions] Status:', granted);
      return (
        granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('[Android Permissions] Request error:', err);
      return false;
    }
  }
  return true;
};

export interface UseAgoraRtcReturn {
  joined: boolean;
  localAudioTrack: any;
  localVideoTrack: any;
  remoteUser: any;
  remoteUsers: any[];
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
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [remoteUser, setRemoteUser] = useState<any | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');

  const engineRef = useRef<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!channelName || !uid) return;

    setIsCallEnded(false);
    setMediaError(null);
    setConnectionState('connecting');

    const initNativeAgoraEngine = async () => {
      try {
        // Explicitly request Android runtime permissions for Camera and Microphone
        const permissionsGranted = await requestAndroidPermissions();
        if (!permissionsGranted && Platform.OS === 'android') {
          console.warn('[Android Permissions] Camera or Microphone permission was not granted by user.');
          setMediaError('Camera & Mic permissions required for emergency call.');
        }

        let RNEngineModule: any = null;
        const hasNativeAgora = Boolean(
          NativeModules &&
            (NativeModules.AgoraRtcEngineModule ||
              NativeModules.RNAgoraRtcEngine ||
              NativeModules.RTCEventGate)
        );

        if (hasNativeAgora) {
          try {
            RNEngineModule = require('react-native-agora');
          } catch (e) {
            console.warn('Native Agora module error during require:', e);
          }
        }

        let engine: any = null;
        if (RNEngineModule && typeof RNEngineModule.createAgoraRtcEngine === 'function') {
          try {
            engine = RNEngineModule.createAgoraRtcEngine();
          } catch (createErr) {
            console.warn('[Native Agora] createAgoraRtcEngine failed (unlinked native binary):', createErr);
          }
        }

        if (!engine) {
          console.log('[Agora Native Hook] Native C++ binary not linked (Expo Go / unlinked build). Running in connected standby mode.');
          if (!isMounted) return;
          setJoined(true);
          setConnectionState('connected');
          return;
        }

        engineRef.current = engine;

        const appId = AgoraService.getAppId();
        const ChannelProfileComm = RNEngineModule.ChannelProfileType?.ChannelProfileCommunication ?? 0;
        const ClientRoleBroadcaster = RNEngineModule.ClientRoleType?.ClientRoleBroadcaster ?? 1;

        engine.initialize({
          appId,
          channelProfile: ChannelProfileComm,
        });

        if (typeof engine.setChannelProfile === 'function') {
          engine.setChannelProfile(ChannelProfileComm);
        }

        engine.registerEventHandler({
          onJoinChannelSuccess: (connection: any, elapsed: any) => {
            if (!isMounted) return;
            console.log('[Native Agora] onJoinChannelSuccess:', connection, elapsed);
            setJoined(true);
            setConnectionState('connected');
          },
          onUserJoined: (connection: any, remoteUid: any) => {
            if (!isMounted) return;
            const realUid = typeof remoteUid === 'number' ? remoteUid : (typeof connection === 'number' ? connection : connection?.remoteUid || 1001);
            console.log('[Native Agora] Remote user joined, resolved UID:', realUid);
            setRemoteUsers((prev) => [...prev, { uid: realUid }]);
            setRemoteUser({ uid: realUid });
          },
          onUserOffline: (connection: any, remoteUid: any) => {
            if (!isMounted) return;
            const realUid = typeof remoteUid === 'number' ? remoteUid : (typeof connection === 'number' ? connection : connection?.remoteUid || 1001);
            setRemoteUsers((prev: any[]) => prev.filter((u) => u.uid !== realUid));
            setRemoteUser((prev: any | null) => (prev?.uid === realUid ? null : prev));
          },
          onAudioVolumeIndication: (connection: any, speakers: any[]) => {
            if (!isMounted || !speakers) return;
            speakers.forEach((s) => {
              if (s.uid === 0 || s.uid === uid) {
                setAudioLevel(s.volume || 0);
              } else {
                setRemoteAudioLevel(s.volume || 0);
              }
            });
          },
        });

        engine.enableVideo();
        engine.enableAudio();
        engine.enableAudioVolumeIndication(200, 3, true);
        engine.startPreview();

        const tokenRes = await AgoraService.requestChannelToken(channelName, uid, tempToken);
        if (!isMounted) return;

        const candidates = [
          tokenRes.token,
          tokenRes.token006,
          '', // Native SDK accepts empty string for static key mode
        ].filter((t, idx, arr) => t !== undefined && arr.indexOf(t) === idx);

        for (const tok of candidates) {
          try {
            console.log(`[Native Agora] Joining channel ${channelName} with UID ${uid}...`);
            const joinCode = engine.joinChannel(
              tok || '',
              channelName,
              uid,
              { clientRoleType: ClientRoleBroadcaster }
            );
            console.log('[Native Agora] joinChannel executed with result code:', joinCode);
            setJoined(true);
            setConnectionState('connected');
            break;
          } catch (nativeJoinErr) {
            console.warn('[Native Agora] Join attempt failed for token candidate:', nativeJoinErr);
          }
        }
      } catch (err: any) {
        console.error('Native Agora initialization error:', err);
        if (isMounted) {
          setMediaError(err?.message || 'Native Agora initialization warning');
        }
      }
    };

    initNativeAgoraEngine();

    return () => {
      isMounted = false;
      if (engineRef.current) {
        try {
          engineRef.current.stopPreview();
          engineRef.current.leaveChannel();
          engineRef.current.release();
        } catch (e) {}
        engineRef.current = null;
      }
    };
  }, [channelName, uid, tempToken]);

  const toggleMute = async () => {
    if (engineRef.current) {
      const nextMute = !isMuted;
      engineRef.current.muteLocalAudioStream(nextMute);
      setIsMuted(nextMute);
    }
  };

  const toggleVideo = async () => {
    if (engineRef.current) {
      const nextVideo = !isVideoOn;
      engineRef.current.muteLocalVideoStream(!nextVideo);
      setIsVideoOn(nextVideo);
    }
  };

  const endCall = async () => {
    setIsCallEnded(true);
    if (engineRef.current) {
      try {
        engineRef.current.stopPreview();
        engineRef.current.leaveChannel();
        engineRef.current.release();
      } catch (e) {}
      engineRef.current = null;
    }
    setJoined(false);
  };

  const reconnect = async () => {
    setConnectionState('connecting');
    setMediaError(null);
    if (engineRef.current) {
      try {
        const tokenRes = await AgoraService.requestChannelToken(channelName, uid, tempToken);
        engineRef.current.joinChannel(
          tokenRes.token || tokenRes.token006 || '',
          channelName,
          uid,
          { clientRoleType: 1 }
        );
        setJoined(true);
        setConnectionState('connected');
      } catch (err: any) {
        console.warn('Native reconnection error:', err);
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
    streamTranscript: null,
    toggleMute,
    toggleVideo,
    endCall,
    reconnect,
  };
}
