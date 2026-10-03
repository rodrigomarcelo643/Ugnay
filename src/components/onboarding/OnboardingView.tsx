import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface OnboardingSlide {
  id: number;
  tag: string;
  title: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  icon: React.ReactNode;
  description: string;
  points: string[];
}

export const OnboardingView: React.FC = () => {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const slides: OnboardingSlide[] = [
    {
      id: 1,
      tag: '01. VOICE HANDOFF',
      title: 'Voice-First Emergency Response',
      badge: 'SPEECH ENGINE',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
      badgeText: '#38BDF8',
      iconBg: 'rgba(56, 189, 248, 0.1)',
      icon: <Mic size={44} color="#38BDF8" />,
      description: 'Speak naturally in your dialect during emergencies. No slow form filling or typing required when every second counts.',
      points: [
        'Automatic voice capture & dialect comprehension',
        'Instant speech-to-text live feed',
        'Zero manual input needed in panic situations',
      ],
    },
    {
      id: 2,
      tag: '02. REALTIME AI',
      title: 'AI Triaging & Fact Structuring',
      badge: 'SMART TRIAGING',
      badgeBg: 'rgba(251, 191, 36, 0.15)',
      badgeText: '#FBBF24',
      iconBg: 'rgba(251, 191, 36, 0.1)',
      icon: <Cpu size={44} color="#FBBF24" />,
      description: 'UGNAY AI listens to your voice, extracts critical facts (person trapped, situation, floor, landmarks), and assigns emergency priority.',
      points: [
        'Extracts missing details (e.g. location, floor, victims)',
        'Classifies emergency category & priority level',
        'Generates concise AI briefs for dispatchers',
      ],
    },
    {
      id: 3,
      tag: '03. COMMUNITY DISPATCH',
      title: 'Direct Local Responder Dispatch',
      badge: 'INSTANT CONNECT',
      badgeBg: 'rgba(52, 211, 153, 0.15)',
      badgeText: '#34D399',
      iconBg: 'rgba(52, 211, 153, 0.1)',
      icon: <ShieldCheck size={44} color="#34D399" />,
      description: 'Your structured incident is immediately routed to nearby barangay volunteers, rescue teams, and emergency personnel.',
      points: [
        'Live voice channel with matched responder',
        'Continuous real-time AI updates during call',
        'Human → AI → Human seamless handoff',
      ],
    },
  ];

  const currentSlide = slides[currentSlideIndex];

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else {
      completeOnboarding();
      router.push('/login');
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  const handleSkipToLogin = () => {
    completeOnboarding();
    router.push('/login');
  };

  return (
    <ScrollView contentContainerClassName="flex-grow justify-center items-center bg-[#09090B] px-4 py-12">
      <View style={styles.mainContainer}>
        {/* Slide Instructions View - Sleek Dark Card */}
        <View style={styles.cardContainer}>
          {/* Central Hero Graphic & Badge */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconBadge, { backgroundColor: currentSlide.iconBg }]}>
              {currentSlide.icon}
            </View>

            <View
              style={[
                styles.badgePill,
                { backgroundColor: currentSlide.badgeBg },
              ]}
            >
              <Sparkles size={13} color={currentSlide.badgeText} />
              <Text style={[styles.badgeText, { color: currentSlide.badgeText }]}>
                {currentSlide.badge}
              </Text>
            </View>

            <Text style={styles.slideTitle}>{currentSlide.title}</Text>

            <Text style={styles.slideDescription}>
              {currentSlide.description}
            </Text>
          </View>

          {/* Key Points Card */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresHeader}>How it protects you</Text>
            {currentSlide.points.map((pt, idx) => (
              <View key={idx} style={styles.featureItemRow}>
                <CheckCircle2 size={18} color="#10B981" style={{ marginTop: 2 }} />
                <Text style={styles.featureItemText}>{pt}</Text>
              </View>
            ))}
          </View>

          {/* Navigation Dots */}
          <View style={styles.dotsRow}>
            {slides.map((_, idx) => (
              <Pressable
                key={idx}
                onPress={() => setCurrentSlideIndex(idx)}
                style={[
                  styles.dot,
                  currentSlideIndex === idx ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <View style={styles.btnRow}>
              {currentSlideIndex > 0 && (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Back"
                    variant="outline"
                    size="md"
                    icon={<ArrowLeft size={18} color="#A1A1AA" />}
                    onPress={handlePrevSlide}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Button
                  title={
                    currentSlideIndex === slides.length - 1
                      ? 'Get Started'
                      : 'Next'
                  }
                  variant="primary"
                  size="md"
                  icon={<ArrowRight size={18} color="#FFFFFF" />}
                  onPress={handleNextSlide}
                />
              </View>
            </View>

            <Pressable
              onPress={handleSkipToLogin}
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>Skip to Login</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          UGNAY AI Emergency Handoff Network • Dark Theme Edition
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    width: '100%',
    maxWidth: 640,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#3F3F46',
    padding: 20,
    gap: 18,
    overflow: 'hidden',
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 10,
  },
  heroIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#3F3F46',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slideDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 500,
  },
  featuresCard: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#3F3F46',
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  featuresHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E4E4E7',
    flex: 1,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#2563EB',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#27272A',
  },
  actionButtonsContainer: {
    gap: 10,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#52525B',
    marginTop: 18,
    textAlign: 'center',
  },
});

