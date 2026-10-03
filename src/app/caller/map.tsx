import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, PanResponder, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { LiveMapView } from '@/components/ui/LiveMapView';
import { LiveVideoBox } from '@/components/ui/LiveVideoBox';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { useAgoraRtc } from '@/hooks/useAgoraRtc';
import { supabaseService } from '@/services/supabase';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  PhoneOff,
  Video,
  Mic,
  GripVertical,
} from 'lucide-react-native';

export default function CallerMapScreen() {
  const router = useRouter();
  const { activeIncident, setActiveIncident, resetIncident } = useIncidentStore();

  const [tempToken, setTempToken] = useState<string>('');
  const [isPipMinimized, setIsPipMinimized] = useState<boolean>(false);
  const [seconds, setSeconds] = useState(0);

  // Smooth 60fps Draggable Overlay State using PanResponder
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const channelName = activeIncident?.channel_name || `ugnay_emergency_${activeIncident?.id || 'demo'}`;
  const CALLER_UID = 1001;

  const {
    joined,
    localVideoTrack,
    remoteUser,
    audioLevel,
    remoteAudioLevel,
    isMuted,
    isVideoOn,
    isCallEnded,
    mediaError,
    connectionState,
    toggleMute,
    toggleVideo,
    endCall,
  } = useAgoraRtc(channelName, CALLER_UID, tempToken);

  useEffect(() => {
    if (isCallEnded) {
      resetIncident();
      router.push('/caller/home');
    }
  }, [isCallEnded]);

  useEffect(() => {
    // Subscribe to realtime updates to cut call on both lines when resolved
    const channel = supabaseService.subscribeToIncidents((incidents) => {
      const currentActiveId = useIncidentStore.getState().activeIncident?.id;
      if (!currentActiveId) return;

      const matched = incidents.find((i) => i.id === currentActiveId);

      if (!matched || matched.status === 'RESOLVED') {
        endCall();
        resetIncident();
        router.push('/caller/home');
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeIncident || activeIncident.status === 'RESOLVED') return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIncident]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    await endCall();
    if (activeIncident?.id) {
      await supabaseService.updateIncidentStatus(activeIncident.id, 'RESOLVED');
    }
    resetIncident();
    router.push('/caller/home');
  };

  if (!activeIncident || !activeIncident.id || activeIncident.status === 'RESOLVED') {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.emptyContainer}>
          <Logo size={40} />
          <Text style={styles.emptyTitle}>NO ACTIVE CALL FOR MAP TRACKING</Text>
          <Text style={styles.emptySubtitle}>Start an emergency call to track responder GPS location on map.</Text>
          <Button title="RETURN TO HOME" variant="primary" onPress={() => router.push('/caller/home')} className="mt-4" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.webWrapper}>
      <ScrollView style={styles.scrollStyle} contentContainerStyle={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.push('/caller/live')} style={styles.backBtn}>
            <ArrowLeft size={18} color="#FFFFFF" />
            <Text style={styles.backBtnText}>CALL LAYOUT</Text>
          </Pressable>

          <View style={styles.titleColumn}>
            <Text style={styles.headerBadgeText}>FULL MAP DISPLAY TRACKING</Text>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {activeIncident.id} • {activeIncident.type || 'RESCUE'}
            </Text>
          </View>

          <ConnectionStatus status={joined ? 'LIVE' : 'CONNECTING'} />
        </View>

        {/* TALL MAP DISPLAY FRAME WITH DRAGGABLE ACTIVE CALL PIP OVERLAY */}
        <View style={styles.tallMapCard}>
          {/* TALL MAP VIEW (Dynamic Map Height: 600px) */}
          <View style={styles.tallMapInner}>
            <LiveMapView
              callerLat={activeIncident.caller_latitude || 14.5518}
              callerLng={activeIncident.caller_longitude || 121.0478}
              callerAddress={activeIncident.caller_address || activeIncident.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig'}
              responderLat={activeIncident.responder_latitude || 14.5540}
              responderLng={activeIncident.responder_longitude || 121.0475}
              responderAddress={activeIncident.responder_address || "St. Luke's Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig"}
              departmentName={activeIncident.department_name || "St. Luke's Medical Center Global City EMS"}
              etaMinutes={activeIncident.eta_minutes || 1}
              distanceKm={activeIncident.distance_km || 0.3}
              role="CALLER"
              mapHeight={600}
            />
          </View>

          {/* DRAGGABLE ACTIVE CALL PIP OVERLAY (Draggable anywhere on screen) */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.pipOverlayContainer,
              isPipMinimized && styles.pipMinimizedContainer,
              {
                transform: pan.getTranslateTransform(),
              },
            ]}
          >
            {/* Drag Handle Top Bar */}
            <View style={styles.pipDragHeader}>
              <View style={styles.dragTitleRow}>
                <GripVertical size={14} color="#38BDF8" />
                <View style={styles.livePulseDot} />
                <Text style={styles.pipHeaderTitle}>LIVE AGORA CALL</Text>
                <Text style={styles.pipTimerText}>{formatTime(seconds)}</Text>
              </View>

              <Pressable onPress={() => setIsPipMinimized(!isPipMinimized)} style={styles.pipIconBtn}>
                {isPipMinimized ? <Maximize2 size={13} color="#FFFFFF" /> : <Minimize2 size={13} color="#FFFFFF" />}
              </Pressable>
            </View>

            {!isPipMinimized && (
              <View style={styles.pipBody}>
                {/* Live Video Feed Stream */}
                <View style={styles.pipVideoFrame}>
                  <LiveVideoBox
                    localVideoTrack={localVideoTrack}
                    remoteUser={remoteUser}
                    isVideoOn={isVideoOn}
                    isMuted={isMuted}
                    audioLevel={audioLevel}
                    remoteAudioLevel={remoteAudioLevel}
                    mediaError={mediaError}
                    connectionState={connectionState}
                    label={activeIncident.responder_name || 'Emergency Officer'}
                    sublabel={`${activeIncident.department_name || 'Rescue Unit'} • ${activeIncident.distance_km || 0.9}km`}
                    onToggleVideo={toggleVideo}
                    onToggleMute={toggleMute}
                    accentColor="#38BDF8"
                  />
                </View>

                {/* Quick Call Action Controls */}
                <View style={styles.pipControlRow}>
                  <Pressable onPress={toggleMute} style={[styles.controlCircleBtn, isMuted && styles.controlCircleActive]}>
                    <Mic size={16} color={isMuted ? '#EF4444' : '#FFFFFF'} />
                  </Pressable>

                  <Pressable onPress={toggleVideo} style={[styles.controlCircleBtn, !isVideoOn && styles.controlCircleActive]}>
                    <Video size={16} color={!isVideoOn ? '#EF4444' : '#FFFFFF'} />
                  </Pressable>

                  <Pressable onPress={handleEndCall} style={styles.endCallCircleBtn}>
                    <PhoneOff size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </View>

        {/* End Call Action Button */}
        <Button
          title="END RESPONSE & CALL"
          variant="danger"
          size="lg"
          icon={<PhoneOff size={20} color="#FFFFFF" />}
          onPress={handleEndCall}
          className="w-full py-4"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#09090B',
  },
  scrollStyle: {
    flex: 1,
    width: '100%',
  },
  container: {
    width: '100%',
    maxWidth: 672,
    alignSelf: 'center',
    minHeight: '100%',
    backgroundColor: '#09090B',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 110,
    gap: 20,
  },
  headerBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#09090B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  titleColumn: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  headerTitleText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tallMapCard: {
    width: '100%',
    height: 760,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#27272A',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181B',
  },
  tallMapInner: {
    width: '100%',
    height: '100%',
  },
  pipOverlayContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 340,
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: 10,
    gap: 8,
    zIndex: 99,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
    cursor: 'grab',
  },
  pipMinimizedContainer: {
    width: 210,
    padding: 8,
  },
  pipDragHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  dragTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  pipHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pipTimerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    marginLeft: 4,
  },
  pipIconBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#27272A',
  },
  pipBody: {
    gap: 8,
    marginTop: 4,
  },
  pipVideoFrame: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#09090B',
  },
  pipControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  controlCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  endCallCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    maxWidth: 672,
    alignSelf: 'center',
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A1A1AA',
    textAlign: 'center',
    maxWidth: 400,
  },
});
