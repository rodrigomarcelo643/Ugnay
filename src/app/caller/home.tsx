import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useIncidentStore } from '@/store/incidentStore';
import { AnimatedVoiceOrb } from '@/components/ui/AnimatedVoiceOrb';
import { LocationDisplay } from '@/components/ui/LocationDisplay';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { supabaseService } from '@/services/supabase';
import { LiveCallTranscript } from '@/components/ui/LiveCallTranscript';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import {
  Mic,
  Globe,
  ChevronDown,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  MapPin,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react-native';

const LANGUAGE_OPTIONS = [
  {
    name: 'Cebuano / Bisaya',
    desc: 'Visayas & Mindanao regional dialect (Cebu, Davao, Bohol, CDO)',
  },
  {
    name: 'Tagalog / Filipino',
    desc: 'National language for Manila & Luzon regions',
  },
  {
    name: 'English',
    desc: 'Global standard English voice & recognition',
  },
  {
    name: 'Auto-Detect',
    desc: 'Multilingual speech engine (Auto-detects dialect)',
  },
];

export default function CallerHome() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    setIsListening,
    resetIncident,
    selectedLanguage,
    setSelectedLanguage,
  } = useIncidentStore();
  const { locationString, refetch: refetchLocation } = useDeviceLocation();
  const [activeTab, setActiveTab] = useState<'SOS' | 'TRANSCRIPT'>('SOS');
  const [showLangModal, setShowLangModal] = useState(false);
  const [dbIncidents, setDbIncidents] = useState<any[]>([]);

  React.useEffect(() => {
    // Fetch initial active incidents from Supabase
    supabaseService.fetchIncidents().then(setDbIncidents);

    // Subscribe to real-time incident changes
    const channel = supabaseService.subscribeToIncidents((updated) => {
      setDbIncidents(updated);
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  const handleSelectLanguage = (langName: string) => {
    setSelectedLanguage(langName);
    setShowLangModal(false);
  };

  const handleStartVoice = () => {
    resetIncident();
    setIsListening(true);
    router.push('/caller/voice');
  };

  return (
    <View style={styles.webWrapper}>
      <ScrollView style={styles.scrollStyle} contentContainerStyle={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Logo size={36} />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF' }}>UGNAY</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#38BDF8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                CITIZEN RESCUE
              </Text>
            </View>
          </View>
          <ConnectionStatus status="LIVE" />
        </View>

        {/* AI Voice Assistant Launch Button */}
        <Pressable
          onPress={handleStartVoice}
          style={[
            styles.listeningBadgeBtn,
            styles.listeningActiveBadge,
          ]}
        >
          <Mic size={15} color="#38BDF8" />
          <Text style={styles.listeningBadgeText}>
            TAP TO TALK WITH AI VOICE ASSISTANT
          </Text>
          <Sparkles size={14} color="#38BDF8" />
        </Pressable>

        {/* Central Animated Voice Orb with Moving Wave */}
        <View style={styles.orbSection}>
          <AnimatedVoiceOrb
            onPress={handleStartVoice}
            size={140}
          />
          <Text style={styles.orbSubtext}>Tap circle or button to speak dynamically</Text>
        </View>

        {/* Language Selection Pill */}
        <Pressable
          onPress={() => setShowLangModal(true)}
          style={styles.languagePill}
        >
          <Globe size={15} color="#38BDF8" />
          <Text style={styles.languageLabel}>Main Language</Text>
          <Text style={styles.languageValue}>{selectedLanguage}</Text>
          <ChevronDown size={14} color="#64748B" />
        </Pressable>

        {/* Pill Tabs: [ Emergency SOS ]  [ Call Transcript ] */}
        <View style={styles.pillTabsContainer}>
          <Pressable
            onPress={() => setActiveTab('SOS')}
            style={[
              styles.pillTab,
              activeTab === 'SOS' ? styles.pillTabActive : styles.pillTabInactive,
            ]}
          >
            <AlertTriangle size={15} color={activeTab === 'SOS' ? '#FFFFFF' : '#94A3B8'} />
            <Text
              style={[
                styles.pillTabText,
                activeTab === 'SOS' ? styles.pillTabTextActive : styles.pillTabTextInactive,
              ]}
            >
              Emergency SOS
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('TRANSCRIPT')}
            style={[
              styles.pillTab,
              activeTab === 'TRANSCRIPT' ? styles.pillTabActive : styles.pillTabInactive,
            ]}
          >
            <MessageSquare size={15} color={activeTab === 'TRANSCRIPT' ? '#FFFFFF' : '#94A3B8'} />
            <Text
              style={[
                styles.pillTabText,
                activeTab === 'TRANSCRIPT' ? styles.pillTabTextActive : styles.pillTabTextInactive,
              ]}
            >
              Call Transcript
            </Text>
          </Pressable>
        </View>

        {/* Voice-First Interface Notice */}
        <View style={styles.voiceFirstBanner}>
          <Mic size={16} color="#38BDF8" />
          <Text style={styles.voiceFirstBannerText}>
            Voice-First Interface: Speak directly in Bisaya, Tagalog, or English. Agora Voice AI listens and triages in real time.
          </Text>
        </View>

        {/* Location & Active Feed / Call Transcript Tab */}
        {activeTab === 'SOS' ? (
          <View style={styles.feedCard}>
            <LocationDisplay label="Caller Device GPS Location" />
            <Text style={styles.feedDesc}>
              Simplify emergency triaging. Speak naturally to be connected with local responders.
            </Text>
          </View>
        ) : (
          <View style={{ width: '100%', gap: 14 }}>
            {/* Active Incident & Responder Details Header Card */}
            {dbIncidents.length > 0 || useIncidentStore.getState().activeIncident?.id ? (
              <View style={styles.feedCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#27272A', paddingBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#38BDF8" />
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#38BDF8', letterSpacing: 0.5 }}>INCIDENT ID</Text>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>
                        {useIncidentStore.getState().activeIncident?.id || dbIncidents[0]?.id || 'UGNAY-2026-CEBU-101'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>
                      {useIncidentStore.getState().activeIncident?.status || dbIncidents[0]?.status || 'DISPATCHING'}
                    </Text>
                  </View>
                </View>

                {/* Assigned Responder Info Box */}
                <View style={{ backgroundColor: '#09090B', borderRadius: 14, borderWidth: 1, borderColor: '#27272A', padding: 12, gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 }}>
                    ASSIGNED RESPONDER UNIT
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                    {useIncidentStore.getState().activeIncident?.responder_name || dbIncidents[0]?.responder_name || 'Officer Marcelo Santos'}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#38BDF8' }}>
                    {useIncidentStore.getState().activeIncident?.department_name || dbIncidents[0]?.department_name || 'MDRRMO Flood Rescue Unit'}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '500', color: '#A1A1AA' }}>
                    Station: {useIncidentStore.getState().activeIncident?.station_name || dbIncidents[0]?.station_name || 'Barangay DRRMO Command Post'}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#FBBF24', marginTop: 2 }}>
                    Distance: {dbIncidents[0]?.distance_km || 0.9} km • ETA: ~{dbIncidents[0]?.eta_minutes || 3} mins
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Live Transcript Stream Component */}
            <LiveCallTranscript
              incidentId={useIncidentStore.getState().activeIncident?.id || dbIncidents[0]?.id || 'UGNAY-2026-CEBU-101'}
              role="CALLER"
              senderName={user?.name || 'Citizen User'}
            />
          </View>
        )}

        {/* Floating Bottom Voice Bar */}
        <View style={styles.bottomBarWrapper}>
          <Pressable onPress={() => handleStartVoice()} style={styles.bottomVoicePill}>
            <Text style={styles.bottomVoicePlaceholder}>Continue conversation...</Text>
            <Mic size={18} color="#94A3B8" />
          </Pressable>
        </View>
      </ScrollView>

      {/* Interactive AI Language Selection Modal */}
      <Modal
        visible={showLangModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Globe size={22} color="#38BDF8" />
                <Text style={styles.modalTitle}>AI Voice Language</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowLangModal(false)}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select your preferred language. The AI engine will speak and process real-time voice responses in this dialect.
            </Text>

            <View style={styles.langListContainer}>
              {LANGUAGE_OPTIONS.map((item) => {
                const isSelected = selectedLanguage === item.name;
                return (
                  <Pressable
                    key={item.name}
                    onPress={() => handleSelectLanguage(item.name)}
                    style={[
                      styles.langOptionCard,
                      isSelected && styles.langOptionSelected,
                    ]}
                  >
                    <View style={styles.langOptionLeft}>
                      <View style={styles.langOptionTitleRow}>
                        <Text style={[styles.langOptionTitle, isSelected && styles.langOptionTitleActive]}>
                          {item.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.activeTag}>
                            <Text style={styles.activeTagText}>SELECTED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.langOptionDesc}>{item.desc}</Text>
                    </View>
                    <CheckCircle2 size={20} color={isSelected ? '#38BDF8' : '#3F3F46'} />
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    gap: 24,
  },
  headerBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  orbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 12,
    gap: 12,
  },
  orbSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 8,
  },
  languageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  languageValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pillTabsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 4,
  },
  pillTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  pillTabActive: {
    backgroundColor: '#2563EB',
  },
  pillTabInactive: {
    backgroundColor: 'transparent',
  },
  pillTabText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginLeft: 6,
  },
  pillTabTextActive: {
    color: '#FFFFFF',
  },
  pillTabTextInactive: {
    color: '#A1A1AA',
  },
  voiceFirstBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  voiceFirstBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#BAE6FD',
    lineHeight: 16,
  },
  feedCard: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 8,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A1A1AA',
    lineHeight: 18,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  transcriptQuote: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  aiResponseText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34D399',
  },
  bottomBarWrapper: {
    width: '100%',
    marginTop: 8,
  },
  bottomVoicePill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bottomVoicePlaceholder: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  listeningBadgeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  listeningActiveBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  listeningInactiveBadge: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
  },
  listeningBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#27272A',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A1A1AA',
    lineHeight: 18,
  },
  langListContainer: {
    gap: 10,
    marginTop: 4,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 16,
    gap: 12,
  },
  langOptionSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: '#38BDF8',
  },
  langOptionLeft: {
    flex: 1,
    gap: 4,
  },
  langOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E4E4E7',
  },
  langOptionTitleActive: {
    color: '#38BDF8',
  },
  activeTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  langOptionDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
    lineHeight: 16,
  },
});
