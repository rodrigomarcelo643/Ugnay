import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useIncidentStore } from '@/store/incidentStore';
import { AIService } from '@/services/ai';
import { supabaseService } from '@/services/supabase';
import { DepartmentService } from '@/services/department-service';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { Logo } from '@/components/ui/logo';
import { RoutingLoadingModal } from '@/components/ui/RoutingLoadingModal';

import { HeartHandshake } from 'lucide-react-native';

export default function CallerAnalyzing() {
  const router = useRouter();
  const { speechTranscript, setActiveIncident, selectedLanguage } = useIncidentStore();
  const { latitude: deviceLat, longitude: deviceLng, addressString } = useDeviceLocation();

  const [analysisResult, setAnalysisResult] = useState<{
    type: string;
    priority: string;
    departmentName: string;
    missingInfo: string[];
    categoryTags: string[];
  }>({ type: 'Emergency', priority: 'HIGH', departmentName: '', missingInfo: [], categoryTags: [] });

  const [showLoadingModal, setShowLoadingModal] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const callerLat = deviceLat || 14.5518;
    const callerLng = deviceLng || 121.0478;
    const callerAddress = addressString || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila';

    const dispatchAndRedirect = (analysis: any) => {
      const quickMatch = AIService.matchResponderCategory(speechTranscript);
      let incidentType = analysis.incident_type && analysis.incident_type !== 'UNMATCHED'
        ? analysis.incident_type
        : 'GENERAL';

      // If OpenAI returned GENERAL or UNMATCHED, but keyword match detected specific emergency, use it!
      if (incidentType === 'GENERAL' && quickMatch.isMatch && quickMatch.incidentType !== 'UNMATCHED') {
        incidentType = quickMatch.incidentType;
      }
      if (analysis.matched_responder === 'FIRE_DEPT') incidentType = 'FIRE';
      else if (analysis.matched_responder === 'EMS_AMBULANCE') incidentType = 'MEDICAL';
      else if (analysis.matched_responder === 'POLICE_DEPT') incidentType = 'SECURITY';
      else if (analysis.matched_responder === 'FLOOD_DRRMO') incidentType = 'FLOOD';

      const matchedDept = DepartmentService.getNearestDepartment(incidentType, callerLat, callerLng);

      setAnalysisResult({
        type: incidentType,
        priority: analysis.priority || (incidentType === 'FIRE' || incidentType === 'SECURITY' ? 'HIGH' : incidentType === 'MEDICAL' ? 'CRITICAL' : 'MEDIUM'),
        departmentName: matchedDept.name,
        missingInfo: analysis.missing_information || [],
        categoryTags: analysis.category_tags?.length > 0 ? analysis.category_tags : quickMatch.tags,
      });

      const incidentPayload = {
        id: `UGNAY-2026-${Math.floor(100 + Math.random() * 900)}`,
        caller_id: '10000000-0000-0000-0000-000000000001',
        type: incidentType,
        incident_type: incidentType,
        category_tags: analysis.category_tags || [],
        priority: analysis.priority || 'MEDIUM',
        description: analysis.summary || speechTranscript || 'Emergency intake via UGNAY AI Voice',
        summary: analysis.summary || speechTranscript || 'Emergency intake via UGNAY AI Voice',
        person: analysis.person || 'Unspecified',
        situation: analysis.situation || 'Emergency reported via voice interface',
        floor: analysis.floor,
        department: matchedDept.type,
        department_name: matchedDept.name,
        station_name: matchedDept.station_name,
        distance_km: matchedDept.distance_km,
        eta_minutes: matchedDept.eta_minutes,
        responder_latitude: matchedDept.latitude,
        responder_longitude: matchedDept.longitude,
        department_latitude: matchedDept.latitude,
        department_longitude: matchedDept.longitude,
        department_address: matchedDept.address,
        caller_latitude: callerLat,
        caller_longitude: callerLng,
        caller_address: callerAddress,
        location: callerAddress,
        status: 'DISPATCHING' as const,
        created_at: new Date().toISOString(),
        known_facts: analysis.known_facts && analysis.known_facts.length > 0
          ? analysis.known_facts
          : [speechTranscript || 'Emergency reported via voice interface'],
        missing_information: analysis.missing_information || [],
        transcript: speechTranscript,
        speech_transcript: speechTranscript,
      };

      setActiveIncident(incidentPayload);

      // In an emergency, immediately create incident in Supabase & dispatch to waiting screen
      supabaseService.createIncident(incidentPayload);
      setShowLoadingModal(false);

      if (!isCancelled) {
        router.push('/caller/waiting');
      }
    };

    AIService.analyzeSpeech(speechTranscript)
      .then((analysis) => {
        if (!isCancelled) {
          dispatchAndRedirect(analysis);
        }
      })
      .catch((err) => {
        console.warn('Analysis error, proceeding with General Emergency fallback to waiting:', err);
        if (!isCancelled) {
          const fallback = AIService.getFallbackAnalysis(speechTranscript);
          dispatchAndRedirect(fallback);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [speechTranscript]);

  const handleSendNow = () => {
    if (useIncidentStore.getState().activeIncident) {
      supabaseService.createIncident(useIncidentStore.getState().activeIncident!);
    }
    setShowLoadingModal(false);
    router.push('/caller/incident');
  };

  const handleCancel = () => {
    setShowLoadingModal(false);
    router.push('/caller/voice');
  };

  return (
    <View className="flex-1 items-center justify-between bg-[#09090B] px-6 py-8 pb-28">
      {/* Container Wrapper */}
      <View className="w-full max-w-2xl flex-1 items-center justify-between gap-6">
        {/* Top Header */}
        <View className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Logo size={36} />
            <Text className="text-lg font-black text-white">UGNAY AI</Text>
          </View>
          <ConnectionStatus status="LIVE" />
        </View>

        {/* Dynamic Progress Steps Checklist */}
        <View className="w-full gap-4 rounded-3xl bg-[#18181B] border border-[#27272A] p-6 shadow-sm">
          <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
            INCIDENT ANALYSIS & DISPATCH
          </Text>
          <Text className="text-xl font-black text-white">
            {analysisResult.type} RESCUE DISPATCH
          </Text>

          {/* OpenAI Enhanced Category Tags */}
          {analysisResult.categoryTags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5 pt-1">
              {analysisResult.categoryTags.map((tag, i) => (
                <View key={i} className="rounded-full bg-sky-500/15 border border-sky-500/40 px-2.5 py-0.5">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {Boolean(analysisResult.missingInfo.length > 0) ? (
            <View className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 gap-1">
              <Text className="text-xs font-black uppercase tracking-wider text-amber-400">
                VOICE AI PROMPT: MISSING DETAILS
              </Text>
              <Text className="text-xs text-amber-200 font-semibold">
                Please state: {analysisResult.missingInfo.join(', ')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Real-Time AI Emotional Support & Queuing Guidance */}
        <View className="w-full gap-2.5 rounded-3xl bg-sky-500/10 border border-sky-500/30 p-5 shadow-sm">
          <View className="flex-row items-center gap-2">
            <HeartHandshake size={18} color="#38BDF8" />
            <Text className="text-xs font-black uppercase tracking-wider text-sky-400">
              AI GUIDANCE & EMOTIONAL SUPPORT
            </Text>
          </View>
          <Text className="text-sm font-bold text-sky-100 leading-relaxed italic">
            "{selectedLanguage?.includes('Bisaya') || selectedLanguage?.includes('Cebuano')
              ? 'Nagsugod na ang pagpila sa responder. Kalma lang, ginhawa og lawom, ug pabilin sa linya. Tabang padulong na.'
              : selectedLanguage?.includes('Tagalog') || selectedLanguage?.includes('Filipino')
              ? 'Nagsisimula na ang pagpila ng responder. Huminahon po kayo, huminga nang malalim, at manatili sa linya. Papunta na ang tulong.'
              : 'Responder queuing has started. Please stay calm, take a slow deep breath, and remain on the line. Help is being coordinated.'}"
          </Text>
          <Text className="text-[11px] font-semibold text-sky-300/80">
            Keep this screen open • GPS tracking actively locking onto your coordinates
          </Text>
        </View>

        <Text className="text-xs text-zinc-500 font-semibold text-center">
          UGNAY AI Engine • Department Routing Pipeline
        </Text>
      </View>

      {/* Exact UI Loading Modal matching user screenshot without counting numbers */}
      <RoutingLoadingModal
        visible={showLoadingModal}
        departmentName={analysisResult.departmentName}
        onSendNow={handleSendNow}
        onCancel={handleCancel}
      />
    </View>
  );
}
