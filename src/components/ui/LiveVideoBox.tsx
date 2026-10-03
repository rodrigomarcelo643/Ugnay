import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Video, VideoOff, Mic, MicOff, Sparkles, Volume2, VolumeX, AlertTriangle } from 'lucide-react-native';
import type { ICameraVideoTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

interface LiveVideoBoxProps {
  localVideoTrack?: ICameraVideoTrack | null;
  remoteUser?: IAgoraRTCRemoteUser | null;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  isVideoOn: boolean;
  isMuted: boolean;
  audioLevel: number;
  remoteAudioLevel?: number;
  label?: string;
  sublabel?: string;
  mediaError?: string | null;
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'failed';
  tempToken?: string;
  onTempTokenChange?: (token: string) => void;
  onToggleVideo?: () => void;
  onToggleMute?: () => void;
  accentColor?: string;
}

export const LiveVideoBox: React.FC<LiveVideoBoxProps> = ({
  localVideoTrack,
  remoteUser,
  localStream,
  remoteStream,
  isVideoOn,
  isMuted,
  audioLevel,
  remoteAudioLevel = 0,
  label = 'Live Feed',
  sublabel = 'Connected',
  mediaError,
  connectionState = 'connecting',
  tempToken = '',
  onTempTokenChange,
  onToggleVideo,
  onToggleMute,
  accentColor = '#38BDF8',
}) => {
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const localVideoDivRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoDivRef = useRef<HTMLDivElement | null>(null);

  const isDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

  // Attach local video track to DOM container
  const setLocalDivRef = useCallback(
    (node: HTMLDivElement | null) => {
      localVideoDivRef.current = node;
      if (isDOM && node && localVideoTrack && isVideoOn) {
        node.innerHTML = '';
        try {
          localVideoTrack.play(node, { fit: 'cover' });
        } catch (e) {}
      }
    },
    [localVideoTrack, isVideoOn, isDOM]
  );

  // Attach remote video track to DOM container
  const setRemoteDivRef = useCallback(
    (node: HTMLDivElement | null) => {
      remoteVideoDivRef.current = node;
      if (isDOM && node && remoteUser?.videoTrack) {
        node.innerHTML = '';
        try {
          remoteUser.videoTrack.play(node, { fit: 'cover' });
        } catch (e) {}
      }
    },
    [remoteUser, isDOM]
  );

  useEffect(() => {
    if (isDOM && remoteVideoDivRef.current && remoteUser?.videoTrack) {
      remoteVideoDivRef.current.innerHTML = '';
      try {
        remoteUser.videoTrack.play(remoteVideoDivRef.current, { fit: 'cover' });
      } catch (e) {}
    }
  }, [remoteUser, isDOM]);

  useEffect(() => {
    if (isDOM && localVideoDivRef.current && localVideoTrack && isVideoOn) {
      localVideoDivRef.current.innerHTML = '';
      try {
        localVideoTrack.play(localVideoDivRef.current, { fit: 'cover' });
      } catch (e) {}
    }
  }, [localVideoTrack, isVideoOn, isDOM]);

  const activeLevel = Math.max(audioLevel, remoteAudioLevel);
  const isSpeaking = activeLevel > 10;
  const hasRemoteVideo = Boolean(remoteUser?.hasVideo && remoteUser?.videoTrack);

  return (
    <View style={styles.container}>
      {/* Media Warning Banner */}
      {Boolean(mediaError) ? (
        <View style={styles.mediaErrorBanner}>
          <AlertTriangle size={13} color="#F59E0B" />
          <Text style={styles.mediaErrorText} numberOfLines={1}>
            {mediaError}
          </Text>
        </View>
      ) : null}



      {/* Header Info Bar */}
      <View style={styles.topBadgeRow}>
        <View style={styles.labelGroup}>
          <View style={[styles.statusDot, { backgroundColor: isSpeaking ? '#10B981' : accentColor }]} />
          <Text style={styles.labelText}>{label}</Text>
        </View>
        {isSpeaking ? (
          <View style={styles.speakingPill}>
            <Sparkles size={11} color="#10B981" />
            <Text style={styles.speakingText}>
              {remoteAudioLevel > 10 ? 'REMOTE VOICE LIVE' : `MIC ACTIVE (${audioLevel}%)`}
            </Text>
          </View>
        ) : (
          <Text style={styles.standbyText}>
            {isMuted ? 'MIC MUTED' : remoteUser ? 'VOICE CONNECTED' : 'WAITING PEER'}
          </Text>
        )}
      </View>

      {/* MAIN UNIFIED VIDEO FRAME */}
      <View style={[styles.singleVideoFrame, { borderColor: isSpeaking ? '#10B981' : '#27272A' }]}>
        {/* Remote Peer Video Stream or Avatar Placeholder */}
        {isDOM && hasRemoteVideo ? (
          <div
            ref={setRemoteDivRef as any}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          />
        ) : (
          <View style={styles.placeholderBox}>
            <View style={[styles.avatarCircle, { backgroundColor: accentColor + '20', borderColor: accentColor }]}>
              <Text style={[styles.avatarText, { color: accentColor }]}>{label.charAt(0)}</Text>
            </View>
            <Text style={styles.placeholderTitle}>{label}</Text>
            <Text style={styles.placeholderSub}>
              {remoteUser ? 'Agora RTC Audio Connected' : 'Waiting for Remote Peer to Join...'}
            </Text>
          </View>
        )}

        {/* Local PIP Video Frame */}
        {isDOM && isVideoOn && localVideoTrack ? (
          <View style={styles.pipFrame}>
            <div
              ref={setLocalDivRef as any}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 10,
                transform: 'scaleX(-1)',
                overflow: 'hidden',
              }}
            />
            <View style={styles.pipBadge}>
              <Text style={styles.pipBadgeText}>YOU</Text>
            </View>
          </View>
        ) : null}

        {/* Bottom Audio Spectrum Equalizer */}
        <View style={styles.soundBarOverlay}>
          <View style={styles.eqRow}>
            {[0.4, 0.8, 1.2, 0.9, 0.6].map((multiplier, idx) => {
              const computedHeight = isMuted
                ? 4
                : Math.max(4, Math.min(24, Math.round(activeLevel * multiplier * 0.4)));
              return (
                <View
                  key={idx}
                  style={[
                    styles.eqBar,
                    {
                      height: computedHeight,
                      backgroundColor: isMuted ? '#71717A' : isSpeaking ? '#10B981' : accentColor,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.sublabel}>{sublabel}</Text>
        </View>
      </View>

      {/* Controls Bar */}
      <View style={styles.controlsRow}>
        {Boolean(onToggleVideo) ? (
          <Pressable
            onPress={onToggleVideo}
            style={[styles.controlBtn, isVideoOn ? styles.btnActive : styles.btnInactive]}
          >
            {isVideoOn ? <Video size={16} color="#FFFFFF" /> : <VideoOff size={16} color="#F43F5E" />}
            <Text style={styles.controlBtnText}>{isVideoOn ? 'Cam ON' : 'Cam OFF'}</Text>
          </Pressable>
        ) : null}

        {Boolean(onToggleMute) ? (
          <Pressable
            onPress={onToggleMute}
            style={[styles.controlBtn, !isMuted ? styles.btnActive : styles.btnInactive]}
          >
            {!isMuted ? <Mic size={16} color="#FFFFFF" /> : <MicOff size={16} color="#F43F5E" />}
            <Text style={styles.controlBtnText}>{!isMuted ? 'Mic ON' : 'Muted'}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setIsSpeakerMuted(!isSpeakerMuted)}
          style={[styles.controlBtn, !isSpeakerMuted ? styles.btnActive : styles.btnInactive]}
        >
          {!isSpeakerMuted ? <Volume2 size={16} color="#FFFFFF" /> : <VolumeX size={16} color="#F43F5E" />}
          <Text style={styles.controlBtnText}>{!isSpeakerMuted ? 'Speaker ON' : 'Speaker MUTED'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
  },
  mediaErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mediaErrorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    flex: 1,
  },
  tokenBox: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tokenHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  tokenDrawerBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 8,
  },
  tokenGuideText: {
    fontSize: 10,
    color: '#A1A1AA',
    lineHeight: 14,
  },
  tokenInput: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    color: '#FFFFFF',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speakingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  speakingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  standbyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
  },
  singleVideoFrame: {
    width: '100%',
    height: 420,
    borderRadius: 24,
    backgroundColor: '#18181B',
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  pipFrame: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 115,
    height: 155,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: '#09090B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  pipBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  pipBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  placeholderBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#18181B',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '900',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  placeholderSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  soundBarOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  eqBar: {
    width: 4,
    borderRadius: 2,
  },
  sublabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnActive: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
  },
  btnInactive: {
    backgroundColor: '#2A0A10',
    borderColor: '#E11D48',
  },
  controlBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
