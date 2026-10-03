import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  Mic,
  FileText,
  PhoneCall,
  User,
  ShieldAlert,
  BellRing,
} from 'lucide-react-native';

export default function AppTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, isLoggedIn } = useAuth();

  // "theres no tab on the public the tab only displays when each role logins etc and has differnt tab contennts"
  if (!isLoggedIn || role === 'PUBLIC') {
    return null;
  }

  const callerTabs = [
    { name: 'SOS Home', href: '/caller/home', icon: Home },
    { name: 'Voice AI', href: '/caller/voice', icon: Mic },
    { name: 'Incident Brief', href: '/caller/incident', icon: FileText },
    { name: 'Live Call', href: '/caller/live', icon: PhoneCall },
    { name: 'Profile', href: '/caller/profile', icon: User },
  ];

  const responderTabs = [
    { name: 'Dispatch Board', href: '/responder/home', icon: ShieldAlert },
    { name: 'Incoming Alert', href: '/responder/incoming', icon: BellRing },
    { name: 'Live Call', href: '/responder/live', icon: PhoneCall },
    { name: 'Profile', href: '/responder/profile', icon: User },
  ];

  const activeTabs = role === 'RESPONDER' ? responderTabs : callerTabs;

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabContainer}>
        {activeTabs.map((tab) => {
          const isActive = pathname === tab.href;
          const IconComponent = tab.icon;
          const iconColor = isActive ? '#FFFFFF' : '#71717A';

          return (
            <Pressable
              key={tab.href}
              onPress={() => router.push(tab.href as any)}
              style={({ pressed }) => [
                styles.tabItem,
                isActive && styles.tabItemActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.iconContainer}>
                <IconComponent size={18} color={iconColor} />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 12,
    zIndex: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#18181B',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#27272A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 16,
  },
  tabItemActive: {
    backgroundColor: '#2563EB',
  },
  iconContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  tabLabel: {
    width: '100%',
    fontSize: 9,
    fontWeight: '700',
    color: '#71717A',
    textAlign: 'center',
    textAlignVertical: 'center',
    alignSelf: 'center',
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
