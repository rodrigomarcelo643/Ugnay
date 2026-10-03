import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions } from 'react-native';
import { MessageSquare, Send, Sparkles, User, ShieldCheck, Mic, Volume2 } from 'lucide-react-native';
import { supabaseService } from '@/services/supabase';
import { CallMessage } from '@/types/incident';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { sanitizeTranscript } from '@/services/ai';
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
  agoraTranscript?: { text: string; uid?: number; isFinal?: boolean } | null;
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
  agoraTranscript,
}) => {
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveSpokenText, setLiveSpokenText] = useState<string>('');
  const lastSpokenRef = useRef<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  // Filter out any stale static canned strings from previous test runs
  const isCannedStaticSeed = (text: string) => {
    const lower = (text || '').toLowerCase();
    return (
      lower.includes('arthaland century pacific') ||
      lower.includes('nagkinahanglan mi og dinalian nga rescue') ||
      lower.includes('kailangan po namin ng agarang tulong') ||
      lower.includes('immediate assistance requested') ||
      lower.includes('nadawat namo ang report') ||
      lower.includes('nakatanggap po kami ng inyong tawag') ||
      lower.includes('we have your gps coordinates locked')
    );
  };

  // Auto speech-to-text callback during live call: captures genuine spoken speech from mic or Agora RTT
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
      } catch (err) {
        console.warn('Live transcript send warning:', err);
      }
    },
    [incidentId, role, senderName]
  );

  // Consume live streaming transcripts directly from Agora RTT
  useEffect(() => {
    if (!agoraTranscript || !agoraTranscript.text) return;
    const clean = sanitizeTranscript(agoraTranscript.text);
    if (!clean || clean.length < 2) return;

    // Check if packet belongs to this user or general channel
    const isThisUser =
      agoraTranscript.uid === undefined ||
      (role === 'CALLER' && agoraTranscript.uid === 1001) ||
      (role === 'RESPONDER' && agoraTranscript.uid === 2002);

    if (agoraTranscript.isFinal === false) {
      if (isThisUser) {
        setLiveSpokenText(clean);
      }
    } else {
      if (isThisUser) {
        handleLiveSpeechChunk(clean);
      }
    }
  }, [agoraTranscript, handleLiveSpeechChunk, role]);

  const { isListening, interimTranscript, audioLevel, startListening, stopListening } =
    useLiveSpeech(handleLiveSpeechChunk);

  useEffect(() => {
    // Start microphone speech recognition during call
    startListening();

    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  // Fetch genuine messages and listen in real-time to both caller and responder on the call
  useEffect(() => {
    if (!incidentId) return;

    let isMounted = true;

    const initConversation = async () => {
      const fetched = await supabaseService.fetchMessages(incidentId);
      if (!isMounted) return;

      // Filter out any stale static canned test messages
      const genuine = fetched.filter((m) => !isCannedStaticSeed(m.text));
      setMessages(genuine);
      if (genuine.length > 0) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
      }
    };

    initConversation();

    // Real-time subscription: when either person on the call speaks, their log displays immediately
    const channel = supabaseService.subscribeToMessages(incidentId, (updatedMsgs) => {
      if (isMounted) {
        const genuine = updatedMsgs.filter((m) => !isCannedStaticSeed(m.text));
        setMessages(genuine);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      isMounted = false;
      if (channel) channel.unsubscribe();
    };
  }, [incidentId]);

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

  const { width: windowWidth } = useWindowDimensions();
  const isSmall = windowWidth < 360;
  const isMedium = windowWidth >= 360 && windowWidth < 768;

  return (
    <View style={[styles.container, { padding: isSmall ? 10 : 14 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.headerLeft, { flex: 1, minWidth: 0 }]}>
          <MessageSquare size={isSmall ? 14 : 16} color="#38BDF8" style={{ flexShrink: 0 }} />
          <Text style={[styles.headerTitle, { fontSize: isSmall ? 9 : 10 }]} numberOfLines={1}>
            {isSmall ? 'LIVE 2-WAY TRANSCRIPT' : 'LIVE 2-WAY EMERGENCY CONVERSATION'}
          </Text>
        </View>
        <View style={[styles.syncBadge, { flexShrink: 0 }]}>
          <Sparkles size={10} color="#10B981" />
          <Text style={[styles.syncText, { fontSize: isSmall ? 7.5 : 8 }]}>
            {isSmall ? 'LIVE TRANSCRIPT' : 'LIVE TRANSCRIPTION'}
          </Text>
        </View>
      </View>

      {/* Live Mic Speech Listening Status Bar */}
      <View style={styles.liveMicBar}>
        <View style={[styles.micLeftGroup, { flex: 1, minWidth: 0 }]}>
          <Mic size={isSmall ? 12 : 14} color={isListening ? '#10B981' : '#FBBF24'} style={{ flexShrink: 0 }} />
          <Text style={[styles.micStatusText, { fontSize: isSmall ? 9 : 10 }]} numberOfLines={1}>
            {isListening
              ? (isSmall ? 'MIC ACTIVE • SPEAKING' : 'MICROPHONE ACTIVE • SPEAK FREELY')
              : 'MIC STANDBY'}
          </Text>
        </View>
        {audioLevel > 0 && (
          <View style={[styles.audioLevelBadge, { flexShrink: 0 }]}>
            <Volume2 size={12} color="#38BDF8" />
            <Text style={styles.audioLevelText}>{audioLevel}%</Text>
          </View>
        )}
      </View>

      {/* Interim / Spoken Speech Banner */}
      {(() => {
        const displayText = sanitizeTranscript(interimTranscript || liveSpokenText);
        if (!displayText) return null;
        return (
          <View style={styles.interimBox}>
            <Text style={styles.interimLabel}>HEARING YOUR LIVE SPEECH:</Text>
            <TypewriterText
              key={displayText}
              text={`"${displayText}"`}
              speed={25}
              className="text-[11px] sm:text-xs font-bold text-sky-300 italic"
            />
          </View>
        );
      })()}

      {/* Categorized Transcript Log Container */}
      <View style={[styles.transcriptBox, { height: isSmall ? 180 : isMedium ? 210 : 230 }]}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { fontSize: isSmall ? 10 : 11 }]}>
              Live call audio connected. As you and the other person speak on the call, your spoken conversation will appear here in real time.
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

              const bubbleWidth = isSmall ? '94%' : isMedium ? '88%' : '82%';

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgBubble,
                    isCaller ? styles.callerBubble : styles.responderBubble,
                    { width: bubbleWidth },
                  ]}
                >
                  <View style={styles.msgHeader}>
                    <View style={[styles.senderInfo, { flex: 1, minWidth: 0 }]}>
                      {isCaller ? (
                        <User size={11} color="#38BDF8" style={{ flexShrink: 0 }} />
                      ) : (
                        <ShieldCheck size={11} color="#10B981" style={{ flexShrink: 0 }} />
                      )}
                      <Text
                        style={[
                          styles.senderNameText,
                          { color: isCaller ? '#38BDF8' : '#10B981', fontSize: isSmall ? 8.5 : 9 },
                        ]}
                        numberOfLines={1}
                      >
                        {isCaller ? 'CITIZEN' : 'RESPONDER'} • {msg.sender_name || (isCaller ? 'Caller' : 'Responder')}
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
                      className="text-[11px] sm:text-xs font-semibold text-white leading-relaxed"
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
            style={[styles.suggestionChip, { paddingHorizontal: isSmall ? 6 : 8, paddingVertical: isSmall ? 3 : 4 }]}
          >
            <Text style={[styles.suggestionText, { fontSize: isSmall ? 9 : 10 }]}>{sug}</Text>
          </Pressable>
        ))}
      </View>

      {/* Input Box to Speak/Type Live Transcripts */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.textInput, { fontSize: isSmall ? 10 : 11, paddingVertical: isSmall ? 6 : 8 }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            isSmall
              ? (role === 'CALLER' ? 'Speak or type message...' : 'Speak or type reply...')
              : (role === 'CALLER' ? 'Speak into mic or type message...' : 'Speak into mic or type response...')
          }
          placeholderTextColor="#71717A"
          onSubmitEditing={() => handleSendMessage()}
        />
        <Pressable
          onPress={() => handleSendMessage()}
          style={[
            styles.sendBtn,
            { width: isSmall ? 30 : 34, height: isSmall ? 30 : 34 },
            !inputText.trim() && styles.sendBtnDisabled,
          ]}
          disabled={!inputText.trim() || isSubmitting}
        >
          <Send size={isSmall ? 13 : 15} color="#FFFFFF" />
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
