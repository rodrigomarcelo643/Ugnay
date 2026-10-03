import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useIncidentStore } from '@/store/incidentStore';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserRole } from '@/types/incident';
import { supabase, supabaseService } from '@/services/supabase';
import { AnimatedVoiceOrb } from '@/components/ui/AnimatedVoiceOrb';
import {
  User,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Siren,
} from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoggedIn, role } = useAuth();
  const { setIsListening } = useIncidentStore();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 480;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isLoggedIn) {
      if (role === 'CALLER') router.replace('/caller/home');
      if (role === 'RESPONDER') router.replace('/responder/home');
    }
  }, [isLoggedIn, role]);

  const handleLogin = async () => {
    setErrorMsg(null);
    const u = username.trim().toLowerCase();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);

    try {
      // Securely authenticate against Supabase database profile & hashed password
      const authResult = await supabaseService.authenticateUser(u, p);

      if (!authResult.success || !authResult.profile) {
        setErrorMsg(authResult.error || 'Invalid credentials. Please verify your password.');
        setIsLoading(false);
        return;
      }

      const activeProfile = authResult.profile;
      const targetRole = activeProfile.role;
      const fullName = activeProfile.name;

      login(fullName, targetRole, activeProfile);
      router.replace(targetRole === 'RESPONDER' ? '/responder/home' : '/caller/home');
    } catch (err: any) {
      console.warn('Login error:', err);
      setErrorMsg('Login authentication error. Please try again.');
      setIsLoading(false);
    }
  };

  const handleAnonymousSOS = () => {
    login('Anonymous Public Caller', 'CALLER');
    setIsListening(true);
    router.replace('/caller/voice');
  };

  return (
    <ScrollView contentContainerClassName="flex-grow justify-center items-center bg-[#09090B] px-3 py-6 sm:px-6 sm:py-12">
      {/* Main Login Card - Sleek Dark Frame */}
      <View
        style={[
          styles.cardContainer,
          isSmallScreen && { paddingHorizontal: 16, paddingVertical: 20, borderRadius: 18 },
        ]}
      >
        {/* Header with Title & Subtitle */}
        <View style={[styles.cardHeader, isSmallScreen && { marginBottom: 16 }]}>
          <Text style={[styles.titleText, isSmallScreen && { fontSize: 24 }]}>Sign in</Text>
          <Text style={styles.subtitleText}>to continue to UGNAY Portal</Text>
        </View>

        {/* Form Inputs with Floating Labels */}
        <View style={styles.formContainer}>
          {errorMsg && (
            <View className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 mb-1">
              <Text className="text-xs font-bold text-rose-400">{errorMsg}</Text>
            </View>
          )}

          {/* Username Floating Input */}
          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="e.g. citizen123 or responder123"
            icon={<User size={20} color="#71717A" />}
          />

          {/* Password Floating Input with Eye Toggle */}
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="Password (e.g. Password123!)"
            icon={<Key size={20} color="#71717A" />}
            rightIcon={
              showPassword ? (
                <EyeOff size={20} color="#71717A" />
              ) : (
                <Eye size={20} color="#71717A" />
              )
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {/* Primary Sign In Button */}
          <Button
            title="Sign In"
            variant="primary"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            icon={!isLoading ? <ArrowRight size={18} color="#FFFFFF" /> : undefined}
            onPress={handleLogin}
            className="mt-4 py-4"
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>EMERGENCY PUBLIC ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Anonymous Emergency SOS Access - Rounded Voice Orb UI */}
          <View className="items-center gap-3 py-2">
            <AnimatedVoiceOrb
              onPress={handleAnonymousSOS}
              size={135}
              ringColor="#F43F5E"
            />
            <View className="items-center gap-1">
              <Text className="text-sm font-black text-rose-500 uppercase tracking-widest">
                DIRECT EMERGENCY SOS
              </Text>
              <Text className="text-xs font-semibold text-zinc-400">
                Tap circle to speak • No account required
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer Branding */}
      <Text style={styles.footerText}>
        UGNAY Emergency Network • Dark Theme Edition
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 32,
  },
  cardHeader: {
    marginBottom: 24,
    gap: 4,
  },
  titleText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  formContainer: {
    gap: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717A',
    textTransform: 'uppercase',
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  instructionLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
    marginTop: 28,
    textAlign: 'center',
  },
});
