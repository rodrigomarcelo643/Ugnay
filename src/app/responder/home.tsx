import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { AnimatedVoiceOrb } from '@/components/ui/AnimatedVoiceOrb';
import { LocationDisplay } from '@/components/ui/LocationDisplay';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import {
  Users,
  MessageSquare,
  AlertTriangle,
  Mic,
  MapPin,
  ArrowRight,
  Wifi,
  Radio,
  MoreHorizontal,
  Camera,
} from 'lucide-react-native';

import { supabaseService } from '@/services/supabase';
import { useIncidentStore } from '@/store/incidentStore';
import { doesResponderMatchIncident } from '@/services/department-service';

export default function ResponderHome() {
  const router = useRouter();
  const { user, isAvailable, toggleAvailability } = useAuth();
  const { locationString } = useDeviceLocation();
  const { setActiveIncident } = useIncidentStore();

  const [incidents, setIncidents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const effectiveUser = user
      ? { ...user, availability: isAvailable ? ('AVAILABLE' as const) : ('BUSY' as const) }
      : null;

    // Initial fetch of active incidents matching this responder's department
    supabaseService.fetchActiveIncidents().then((data) => {
      const matching = data.filter((i) => doesResponderMatchIncident(effectiveUser, i));
      setIncidents(matching);
    });

    // Realtime subscription for incoming emergency calls
    const channel = supabaseService.subscribeToIncidents((updated) => {
      const active = updated.filter((i) => i.status !== 'RESOLVED');
      const matching = active.filter((i) => doesResponderMatchIncident(effectiveUser, i));
      setIncidents(matching);

      // ONLY trigger incoming call screen if there is an active dispatch MATCHING this responder's department!
      const latestDispatch = matching.find(
        (i) => i.status === 'DISPATCHING' || i.status === 'NEEDS_RESPONSE'
      );
      if (latestDispatch && isAvailable) {
        setActiveIncident(latestDispatch);
        router.push('/responder/incoming');
      }
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [user?.department, user?.role, user?.station_name, isAvailable]);

  const handleRespondToIncident = (incident: any) => {
    const effectiveUser = user
      ? { ...user, availability: isAvailable ? ('AVAILABLE' as const) : ('BUSY' as const) }
      : null;
    if (!doesResponderMatchIncident(effectiveUser, incident)) {
      return;
    }
    setActiveIncident(incident);
    supabaseService.acceptIncident(incident.id, user?.name || user?.department_name || 'Emergency Responder');
    router.push('/responder/live');
  };

  const handleViewIncoming = () => {
    const matchingPending = incidents.find(
      (i) => i.status === 'DISPATCHING' || i.status === 'NEEDS_RESPONSE'
    );
    if (matchingPending) {
      handleRespondToIncident(matchingPending);
    } else if (incidents.length > 0) {
      handleRespondToIncident(incidents[0]);
    } else {
      router.push('/responder/incoming');
    }
  };

  return (
    <View style={styles.webWrapper}>
      <ScrollView style={styles.scrollStyle} contentContainerStyle={styles.container}>
        {/* Top Channel Bar (Matching Reference Image 2 Top Bar) */}
        <View style={styles.topChannelBar}>
          <View style={styles.channelLeftGroup}>
            <View style={styles.channelIconBox}>
              <Users size={18} color="#94A3B8" />
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.channelTextGroup}>
              <Text style={styles.channelName}>{user?.department_name || user?.station_name || user?.name || 'UGNAY Emergency Channel'}</Text>
              <Text style={styles.channelSubtext}>{isAvailable ? 'Responder Active • Online' : 'Responder Offline'}</Text>
            </View>
          </View>

          <Pressable style={styles.moreIconBtn}>
            <MoreHorizontal size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Action Header Controls (Matching Reference Image 2: [ Camera ] [ ⚠️ Emergency ]) */}
        <View style={styles.actionHeaderRow}>
          <Pressable style={styles.actionBtn}>
            <Camera size={18} color="#FFFFFF" />
          </Pressable>

          <View style={styles.emergencyBadge}>
            <AlertTriangle size={14} color="#E11D48" />
            <Text style={styles.emergencyBadgeText}>Emergency</Text>
          </View>

          <Pressable style={styles.actionBtn}>
            <MessageSquare size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Large Center PTT Animated Voice Orb with Glowing Wave Rings & Equalizer */}
        <View style={styles.pttSection}>
          <AnimatedVoiceOrb
            onPress={handleViewIncoming}
            size={180}
            ringColor="#F97316"
          />
        </View>

        {/* Active Incident Alert Feed */}
        <View style={styles.queueHeaderRow}>
          <Text style={styles.queueTitle}>ACTIVE DISPATCH ALERTS</Text>
          <Text style={styles.queueBadge}>
            {incidents.length > 0 ? `${incidents.length} Incident(s) Pending` : 'No Pending Dispatches'}
          </Text>
        </View>

        {incidents.length > 0 ? (
          incidents.map((incident) => (
            <Pressable key={incident.id} onPress={() => handleRespondToIncident(incident)} style={styles.incidentCard}>
              <View style={styles.cardHeaderRow}>
                <PriorityBadge priority={incident.priority || 'HIGH'} size="sm" />
                <Text style={styles.cardTimeText}>Live Stream</Text>
              </View>

              <View style={styles.cardBodyGroup}>
                <Text style={styles.incidentTitle}>{incident.incident_type || incident.type || 'Emergency'} Rescue</Text>
                <LocationDisplay label={incident.location || 'Caller GPS Location'} />
                <Text style={styles.incidentDesc}>{incident.summary || incident.description || 'Emergency assistance requested.'}</Text>
                <View style={{ backgroundColor: '#09090B', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#27272A', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#38BDF8' }}>
                    Station: {incident.station_name || incident.department_name || 'Nearest Local Station'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#A1A1AA', marginTop: 2 }}>
                    Distance: {incident.distance_km ? `${incident.distance_km} km` : '0.8 km'} • ETA: {incident.eta_minutes || 3} mins
                  </Text>
                </View>
              </View>

              <View style={styles.cardActionRow}>
                <View style={styles.actionPillBtn}>
                  <Text style={styles.actionPillText}>RESPOND TO INCIDENT</Text>
                  <ArrowRight size={14} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.incidentCard}>
            <View style={styles.cardBodyGroup}>
              <Text style={styles.incidentTitle}>Listening for Calls...</Text>
              <Text style={styles.incidentDesc}>No active emergency calls at this moment. You will be alerted automatically when a citizen calls.</Text>
            </View>
          </View>
        )}

        {/* Bottom Status & Signal Bar (Matching Reference Image 2 Bottom Bar: [ Available ] Signal Icons) */}
        <View style={styles.bottomStatusBar}>
          <View style={styles.bottomIconGroup}>
            <Radio size={16} color="#71717A" />
            <RotateHistoryIcon />
          </View>

          <Pressable
            onPress={toggleAvailability}
            style={[
              styles.availabilityPill,
              isAvailable ? styles.availableTrue : styles.availableFalse,
            ]}
          >
            <View
              style={[
                styles.availDot,
                { backgroundColor: isAvailable ? '#34D399' : '#F43F5E' },
              ]}
            />
            <Text
              style={[
                styles.availText,
                { color: isAvailable ? '#34D399' : '#F43F5E' },
              ]}
            >
              {isAvailable ? 'Available' : 'Busy'}
            </Text>
          </Pressable>

          <Wifi size={16} color="#71717A" />
        </View>
      </ScrollView>
    </View>
  );
}

function RotateHistoryIcon() {
  return <Text style={{ color: '#71717A', fontSize: 14 }}>↺</Text>;
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
    gap: 24,
  },
  topChannelBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  channelLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#09090B',
  },
  channelTextGroup: {
    gap: 2,
  },
  channelName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  channelSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  moreIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2A0A10',
    borderWidth: 1.5,
    borderColor: '#E11D48',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  emergencyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E11D48',
  },
  pttSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pttOuterRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#09090B',
    borderWidth: 4,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  pttInnerCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  queueTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 1,
  },
  queueBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F43F5E',
  },
  incidentCard: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E11D48',
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  cardBodyGroup: {
    gap: 4,
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
  },
  incidentDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  cardActionRow: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomStatusBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  bottomIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availabilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
  },
  availableTrue: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  availableFalse: {
    backgroundColor: '#4C0519',
    borderColor: '#E11D48',
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
