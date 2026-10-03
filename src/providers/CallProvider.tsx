import React, { createContext, useContext, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Phone, Video, Maximize2 } from 'lucide-react-native';
import { useIncidentStore } from '@/store/incidentStore';

interface CallContextType {
  isCallActive: boolean;
  activeChannel: string | null;
  startCallSession: (channel: string) => void;
  endCallSession: () => void;
}

const CallContext = createContext<CallContextType>({
  isCallActive: false,
  activeChannel: null,
  startCallSession: () => {},
  endCallSession: () => {},
});

export const useCallContext = () => useContext(CallContext);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const activeIncident = useIncidentStore((state) => state.activeIncident);

  const [isCallActive, setIsCallActive] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const startCallSession = (channel: string) => {
    setIsCallActive(true);
    setActiveChannel(channel);
  };

  const endCallSession = () => {
    setIsCallActive(false);
    setActiveChannel(null);
  };

  const isLivePage = pathname?.includes('/live') || pathname?.includes('/map');
  const isCallAccepted = Boolean(
    activeIncident &&
    activeIncident.id &&
    (activeIncident.status === 'RESPONDER_FOUND' || activeIncident.status === 'EN_ROUTE' || activeIncident.status === 'LIVE')
  );
  const showFloatingBanner = Boolean(isCallAccepted && !isLivePage);

  const handleReturnToCall = () => {
    if (activeIncident?.responder_id) {
      router.push('/responder/live');
    } else {
      router.push('/caller/live');
    }
  };

  return (
    <CallContext.Provider
      value={{
        isCallActive,
        activeChannel,
        startCallSession,
        endCallSession,
      }}
    >
      <View style={styles.container}>
        {children}

        {/* Floating Persistent Call Bar across all screens (Matched to page width) */}
        {showFloatingBanner ? (
          <View style={styles.floatingBarWrapper}>
            <Pressable onPress={handleReturnToCall} style={styles.floatingBar}>
              <View style={styles.barLeft}>
                <View style={styles.livePulseDot} />
                <View style={styles.iconCircle}>
                  <Video size={14} color="#10B981" />
                </View>
                <View style={styles.textColumn}>
                  <Text style={styles.barTitle} numberOfLines={1}>
                    LIVE AGORA CALL IN PROGRESS
                  </Text>
                  <Text style={styles.barSub} numberOfLines={1}>
                    {activeIncident?.caller_address || activeIncident?.location || 'Katipunan Ave, Labangon, Cebu City'}
                  </Text>
                </View>
              </View>

              <View style={styles.barRight}>
                <Text style={styles.returnBtnText}>TAP TO VIEW</Text>
                <Maximize2 size={13} color="#10B981" />
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </CallContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingBarWrapper: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  floatingBar: {
    width: '100%',
    maxWidth: 672,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 9, 11, 0.95)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  barLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 1,
  },
  barTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  barSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  returnBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
});
