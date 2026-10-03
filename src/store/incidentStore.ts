import { create } from 'zustand';
import { Incident, IncidentStatus, Priority, IncidentType } from '@/types/incident';
import { isValidEmergencyDetail } from '@/services/ai';

interface IncidentState {
  activeIncident: Incident | null;
  speechTranscript: string;
  isListening: boolean;
  activeCallDuration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  selectedLanguage: string;

  setSpeechTranscript: (transcript: string) => void;
  setIsListening: (listening: boolean) => void;
  setActiveIncident: (incident: Incident | null) => void;
  setSelectedLanguage: (lang: string) => void;
  updateIncidentStatus: (status: IncidentStatus) => void;
  updateLocation: (location: string, landmark?: string) => void;
  provideMissingDetail: (detailText: string) => void;
  resolveAllMissingInfo: () => void;
  acceptIncident: (responderName: string) => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setCallDuration: (duration: number) => void;
  resetIncident: () => void;
}

function getStoredLanguage(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ugnay_selected_language') || sessionStorage.getItem('ugnay_selected_language');
      if (saved) return saved;
    } catch (e) {}
  }
  return 'Cebuano / Bisaya';
}

export const useIncidentStore = create<IncidentState>((set) => ({
  activeIncident: null,
  speechTranscript: '',
  isListening: false,
  activeCallDuration: 0,
  isMuted: false,
  isSpeakerOn: true,
  selectedLanguage: getStoredLanguage(),

  setSpeechTranscript: (speechTranscript) => set({ speechTranscript }),
  setIsListening: (isListening) => set({ isListening }),
  setActiveIncident: (activeIncident) => set({ activeIncident }),
  setSelectedLanguage: (selectedLanguage: string) => {
    set({ selectedLanguage });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ugnay_selected_language', selectedLanguage);
        sessionStorage.setItem('ugnay_selected_language', selectedLanguage);
      } catch (e) {}
    }
  },

  updateIncidentStatus: (status) =>
    set((state) => ({
      activeIncident: state.activeIncident
        ? { ...state.activeIncident, status }
        : null,
    })),

  updateLocation: (location: string, landmark?: string) =>
    set((state) => ({
      activeIncident: state.activeIncident
        ? {
            ...state.activeIncident,
            location,
            landmark,
            missing_information: state.activeIncident.missing_information?.filter(
              (info) => !info.toLowerCase().includes('location')
            ),
          }
        : null,
    })),

  provideMissingDetail: (detailText: string) =>
    set((state) => {
      if (!state.activeIncident) return {};
      const validation = isValidEmergencyDetail(detailText);
      if (!validation.isValid) {
        return {}; // Reject random words or gibberish input
      }
      const currentMissing = state.activeIncident.missing_information || [];
      const updatedMissing = currentMissing.slice(1);
      const cleanFactText = detailText.startsWith('Added:') ? detailText.replace(/^Added:\s*/, '') : detailText;
      const updatedFacts = [...(state.activeIncident.known_facts || []), cleanFactText];
      
      const isLocationText = /street|brgy|barangay|purok|near|hall|avenue|road|st\.|ave\.|location/i.test(detailText);
      const updatedLocation = isLocationText ? detailText : (state.activeIncident.location || 'GPS Pinpoint Shared');

      return {
        activeIncident: {
          ...state.activeIncident,
          known_facts: updatedFacts,
          missing_information: updatedMissing,
          location: updatedLocation,
        },
      };
    }),

  resolveAllMissingInfo: () =>
    set((state) => {
      if (!state.activeIncident) return {};
      return {
        activeIncident: {
          ...state.activeIncident,
          missing_information: [],
          known_facts: [
            ...(state.activeIncident.known_facts || []),
            'All missing info verified by caller',
          ],
        },
      };
    }),

  acceptIncident: (responderName: string) =>
    set((state) => ({
      activeIncident: state.activeIncident
        ? {
            ...state.activeIncident,
            responder_name: responderName,
            status: 'RESPONDER_FOUND',
          }
        : null,
    })),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleSpeaker: () => set((state) => ({ isSpeakerOn: !state.isSpeakerOn })),
  setCallDuration: (activeCallDuration) => set({ activeCallDuration }),
  resetIncident: () =>
    set({
      activeIncident: null,
      speechTranscript: '',
      isListening: false,
      activeCallDuration: 0,
    }),
}));
