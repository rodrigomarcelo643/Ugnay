import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MessageSquare, Send, Sparkles, User, ShieldCheck, Mic, Volume2 } from 'lucide-react-native';
import { supabaseService } from '@/services/supabase';
import { CallMessage } from '@/types/incident';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { sanitizeTranscript, AIService } from '@/services/ai';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { useIncidentStore } from '@/store/incidentStore';

interface LiveCallTranscriptProps {
  incidentId: string;
  role: 'CALLER' | 'RESPONDER';
  senderName: string;
  otherPartyName?: string;
  departmentName?: string;
  incidentType?: string;
  location?: string;
  initialReport?: string;
}

export const LiveCallTranscript: React.FC<LiveCallTranscriptProps> = ({
  incidentId,
  role,
  senderName,
  otherPartyName,
  departmentName = 'Emergency Response Unit',
  incidentType = 'EMERGENCY',
  location,
  initialReport,
}) => {
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveSpokenText, setLiveSpokenText] = useState<string>('');
  const lastSpokenRef = useRef<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const autoReplyTimerRef = useRef<any>(null);
  const { selectedLanguage } = useIncidentStore();

  const callerDisplayName = role === 'CALLER' ? senderName : (otherPartyName || 'Citizen Caller');
  const responderDisplayName = role === 'RESPONDER' ? senderName : (otherPartyName || departmentName || 'Officer Marcelo Santos');

  // Trigger conversational response from the other party if on single device
  const triggerCounterpartResponse = useCallback(
    (promptText: string, originatingRole: 'CALLER' | 'RESPONDER') => {
      if (autoReplyTimerRef.current) {
        clearTimeout(autoReplyTimerRef.current);
      }

      autoReplyTimerRef.current = setTimeout(async () => {
        if (!incidentId) return;

        try {
          if (originatingRole === 'CALLER') {
            // Caller spoke -> Responder replies
            const responderReply = await AIService.generateResponderReply(
              promptText,
              {
                type: incidentType,
                departmentName,
                location,
                responderName: responderDisplayName,
              },
              selectedLanguage
            );

            if (responderReply) {
              const respMsg = await supabaseService.sendMessage(
                incidentId,
                responderDisplayName,
                responderReply,
                'RESPONDER_SPEECH'
              );
              setMessages((prev) => [...prev.filter((m) => m.id !== respMsg.id), respMsg]);
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

              // If caller is listening, voice the responder's reply over audio
              if (role === 'CALLER') {
                AIService.speakGreeting(responderReply, selectedLanguage);
              }
            }
          } else {
            // Responder spoke -> Caller confirms
            const callerReply = await AIService.generateCallerReply(
              promptText,
              {
                type: incidentType,
                location,
                callerName: callerDisplayName,
              },
              selectedLanguage
            );

            if (callerReply) {
              const callMsg = await supabaseService.sendMessage(
                incidentId,
                callerDisplayName,
                callerReply,
                'CALLER_SPEECH'
              );
              setMessages((prev) => [...prev.filter((m) => m.id !== callMsg.id), callMsg]);
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

              // If responder is listening, voice the caller's reply over audio
              if (role === 'RESPONDER') {
                AIService.speakGreeting(callerReply, selectedLanguage);
              }
            }
          }
        } catch (e) {
          console.warn('Live dialogue counterpart error:', e);
        }
      }, 2400);
    },
    [incidentId, incidentType, departmentName, location, responderDisplayName, callerDisplayName, role, selectedLanguage]
  );

  // Auto speech-to-text callback during live call
  const handleLiveSpeechChunk = useCallback(
    async (liveText: string) => {
      const cleanText = sanitizeTranscript(liveText);
      if (!cleanText || !incidentId || cleanText === lastSpokenRef.current || cleanText.length < 3) return;

      lastSpokenRef.current = cleanText;
      setLiveSpokenText(cleanText);

      const msgType = role === 'CALLER' ? 'CALLER_SPEECH' : 'RESPONDER_SPEECH';
      try {
        const newMsg = await supabaseService.sendMessage(incidentId, senderName, cleanText, msgType);
        setMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        // Advance two-person conversation
        triggerCounterpartResponse(cleanText, role);
      } catch (err) {
        console.warn('Auto live transcript send warning:', err);
      }
    },
    [incidentId, role, senderName, triggerCounterpartResponse]
  );

  const { isListening, interimTranscript, audioLevel, startListening, stopListening } =
    useLiveSpeech(handleLiveSpeechChunk);

  useEffect(() => {
    // Start microphone speech recognition during call
    startListening();

    return () => {
      stopListening();
      if (autoReplyTimerRef.current) {
        clearTimeout(autoReplyTimerRef.current);
      }
    };
  }, [startListening, stopListening]);

  // Initial fetch and automatic conversation dialogue seeding
  useEffect(() => {
    if (!incidentId) return;

    let isMounted = true;

    const initConversation = async () => {
      const initialMsgs = await supabaseService.fetchMessages(incidentId);
      if (!isMounted) return;

      if (initialMsgs.length > 0) {
        setMessages(initialMsgs);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
      } else {
        // Seed the natural opening exchange between the two people
        try {
          const isBisaya = (selectedLanguage || '').includes('Cebuano') || (selectedLanguage || '').includes('Bisaya');
          const isTagalog = (selectedLanguage || '').includes('Tagalog') || (selectedLanguage || '').includes('Filipino');

          const callerOpening = initialReport || (
            isBisaya
              ? `Emergency kini sa ${location || 'Arthaland Century Pacific Tower, BGC'}. Nagkinahanglan mi og dinalian nga rescue.`
              : isTagalog
              ? `Emergency po dito sa ${location || 'Arthaland Century Pacific Tower, BGC'}. Kailangan po namin ng agarang tulong.`
              : `Emergency situation at ${location || 'Arthaland Century Pacific Tower, BGC'}. Immediate assistance requested.`
          );

          const responderOpening = isBisaya
            ? `Nadawat namo ang report, kini ang ${departmentName}. Naka-lock na ang inyong GPS coordinates ug nagdali na ang among unit padulong diha. Luwas ba mo sa inyong pwesto karon?`
            : isTagalog
            ? `Nakatanggap po kami ng inyong tawag, ito ang ${departmentName}. Naka-lock na ang GPS coordinates at papunta na ang aming unit. Ligtas po ba ang inyong kinaroroonan ngayon?`
            : `This is ${departmentName}. We have your GPS coordinates locked and emergency response units are actively en route. Are you in a safe position right now?`;

          const m1 = await supabaseService.sendMessage(incidentId, callerDisplayName, callerOpening, 'CALLER_SPEECH');
          const m2 = await supabaseService.sendMessage(incidentId, responderDisplayName, responderOpening, 'RESPONDER_SPEECH');

          if (isMounted) {
            setMessages([m1, m2]);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          }
        } catch (e) {
          console.warn('Initial dialogue seed error:', e);
        }
      }
    };

    initConversation();

    // Real-time subscription for live transcripts between caller and responder
    const channel = supabaseService.subscribeToMessages(incidentId, (updatedMsgs) => {
      if (isMounted) {
        setMessages(updatedMsgs);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      isMounted = false;
      if (channel) channel.unsubscribe();
    };
  }, [incidentId, selectedLanguage, initialReport, location, departmentName, callerDisplayName, responderDisplayName]);

  const handleSendMessage = async (textToSendOverride?: string) => {
    const textToSend = (textToSendOverride || inputText).trim();
    if (!textToSend || isSubmitting || !incidentId) return;

    if (!textToSendOverride) setInputText('');
    setIsSubmitting(true);

    const msgType = role === 'CALLER' ? 'CALLER_SPEECH' : 'RESPONDER_SPEECH';
    try {
      const newMsg = await supabaseService.sendMessage(incidentId, senderName, textToSend, msgType);
      setMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      // Trigger counterpart reply to continue natural conversation flow
      triggerCounterpartResponse(textToSend, role);
    } catch (e) {
      console.warn('Error sending live transcript message:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick contextual conversation suggestions
  const quickSuggestions =
    role === 'CALLER'
      ? [
          'Nandito kami naghihintay',
          'May sugat po at nagdurugo',
          'Ligtas na po ang pwesto namin',
          'Gaano pa katagal ang team?',
        ]
      : [
          'Paparating na ang team, 2 mins',
          'Huwag galawin ang sugatang parte',
          'Manatili sa ligtas na lugar',
          'May kasama ba kayong bata o matanda?',
        ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MessageSquare size={16} color="#38BDF8" />
          <Text style={styles.headerTitle}>LIVE 2-WAY EMERGENCY CONVERSATION</Text>
        </View>
        <View style={styles.syncBadge}>
          <Sparkles size={11} color="#10B981" />
          <Text style={styles.syncText}>LIVE CALL TRANSCRIPTION</Text>
        </View>
      </View>

      {/* Live Mic Speech Listening Status Bar */}
      <View style={styles.liveMicBar}>
        <View style={styles.micLeftGroup}>
          <Mic size={14} color={isListening ? '#10B981' : '#FBBF24'} />
          <Text style={styles.micStatusText}>
            {isListening ? 'MICROPHONE ACTIVE • SPEAK FREELY' : 'MIC STANDBY'}
          </Text>
        </View>
        {audioLevel > 0 && (
          <View style={styles.audioLevelBadge}>
            <Volume2 size={12} color="#38BDF8" />
            <Text style={styles.audioLevelText}>{audioLevel}%</Text>
          </View>
        )}
      </View>

      {/* Interim / Spoken Speech Banner */}
      {(interimTranscript || liveSpokenText) ? (
        <View style={styles.interimBox}>
          <Text style={styles.interimLabel}>HEARING YOUR LIVE SPEECH:</Text>
          <TypewriterText
            key={interimTranscript || liveSpokenText}
            text={`"${interimTranscript || liveSpokenText}"`}
            speed={25}
            className="text-xs font-bold text-sky-300 italic"
          />
        </View>
      ) : null}

      {/* Categorized Transcript Log Container */}
      <View style={styles.transcriptBox}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Connecting two-way voice channel. Speak directly into your microphone during the call.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => {
              const isCaller =
                msg.type === 'CALLER_SPEECH' ||
                msg.sender_name?.toLowerCase().includes('caller') ||
                msg.sender_name?.toLowerCase().includes('citizen');

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgBubble,
                    isCaller ? styles.callerBubble : styles.responderBubble,
                  ]}
                >
                  <View style={styles.msgHeader}>
                    <View style={styles.senderInfo}>
                      {isCaller ? (
                        <User size={12} color="#38BDF8" />
                      ) : (
                        <ShieldCheck size={12} color="#10B981" />
                      )}
                      <Text
                        style={[
                          styles.senderNameText,
                          { color: isCaller ? '#38BDF8' : '#10B981' },
                        ]}
                      >
                        {isCaller ? 'CITIZEN CALLER' : 'RESPONDER UNIT'} • {msg.sender_name || (isCaller ? 'Caller' : 'Responder')}
                      </Text>
                    </View>
                    <Text style={styles.timeText}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View style={styles.msgBodyContainer}>
                    <TypewriterText
                      key={msg.id}
                      text={msg.text}
                      speed={20}
                      className="text-xs font-semibold text-white leading-relaxed"
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Quick One-Tap Suggestions */}
      <View style={styles.suggestionsRow}>
        {quickSuggestions.map((sug, idx) => (
          <Pressable
            key={idx}
            onPress={() => handleSendMessage(sug)}
            style={styles.suggestionChip}
          >
            <Text style={styles.suggestionText}>{sug}</Text>
          </Pressable>
        ))}
      </View>

      {/* Input Box to Speak/Type Live Transcripts */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            role === 'CALLER'
              ? 'Speak into mic or type message to responder...'
              : 'Speak into mic or type response to caller...'
          }
          placeholderTextColor="#71717A"
          onSubmitEditing={() => handleSendMessage()}
        />
        <Pressable
          onPress={() => handleSendMessage()}
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          disabled={!inputText.trim() || isSubmitting}
        >
          <Send size={15} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  syncText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#10B981',
  },
  liveMicBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  micLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4D4D8',
    letterSpacing: 0.3,
  },
  audioLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  audioLevelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  interimBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    padding: 8,
    gap: 2,
  },
  interimLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  transcriptBox: {
    height: 220,
    backgroundColor: '#09090B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 16,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
    gap: 8,
  },
  msgBubble: {
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    gap: 4,
  },
  callerBubble: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignSelf: 'flex-start',
    width: '88%',
  },
  responderBubble: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignSelf: 'flex-end',
    width: '88%',
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderNameText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 8,
    color: '#71717A',
    fontWeight: '600',
  },
  msgBodyContainer: {
    marginTop: 2,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  suggestionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 11,
    color: '#FFFFFF',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#27272A',
    opacity: 0.5,
  },
});
