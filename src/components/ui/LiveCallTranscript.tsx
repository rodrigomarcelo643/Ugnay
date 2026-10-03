import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MessageSquare, Send, Sparkles, User, ShieldCheck, Mic, Volume2 } from 'lucide-react-native';
import { supabaseService } from '@/services/supabase';
import { CallMessage } from '@/types/incident';
import { useLiveSpeech } from '@/hooks/useLiveSpeech';
import { sanitizeTranscript } from '@/services/ai';
import { TypewriterText } from '@/components/ui/TypewriterText';

interface LiveCallTranscriptProps {
  incidentId: string;
  role: 'CALLER' | 'RESPONDER';
  senderName: string;
}

export const LiveCallTranscript: React.FC<LiveCallTranscriptProps> = ({
  incidentId,
  role,
  senderName,
}) => {
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveSpokenText, setLiveSpokenText] = useState<string>('');
  const lastSpokenRef = useRef<string>('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto speech-to-text callback during live video call
  const handleLiveSpeechChunk = useCallback(
    async (liveText: string) => {
      const cleanText = sanitizeTranscript(liveText);
      if (!cleanText || !incidentId || cleanText === lastSpokenRef.current) return;

      lastSpokenRef.current = cleanText;
      setLiveSpokenText(cleanText);

      const msgType = role === 'CALLER' ? 'CALLER_SPEECH' : 'RESPONDER_SPEECH';
      try {
        const newMsg = await supabaseService.sendMessage(incidentId, senderName, cleanText, msgType);
        setMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (err) {
        console.warn('Auto live transcript send warning:', err);
      }
    },
    [incidentId, role, senderName]
  );

  const { isListening, transcript, interimTranscript, audioLevel, startListening, stopListening } =
    useLiveSpeech(handleLiveSpeechChunk);

  useEffect(() => {
    // Start microphone speech recognition during call
    startListening();

    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  useEffect(() => {
    if (!incidentId) return;

    // Initial fetch
    supabaseService.fetchMessages(incidentId).then((initialMsgs) => {
      setMessages(initialMsgs);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
    });

    // Real-time subscription for live transcripts
    const channel = supabaseService.subscribeToMessages(incidentId, (updatedMsgs) => {
      setMessages(updatedMsgs);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [incidentId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSubmitting || !incidentId) return;

    const textToSend = inputText.trim();
    setInputText('');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MessageSquare size={16} color="#38BDF8" />
          <Text style={styles.headerTitle}>LIVE CALL SPEECH TRANSCRIPT</Text>
        </View>
        <View style={styles.syncBadge}>
          <Sparkles size={11} color="#10B981" />
          <Text style={styles.syncText}>REALTIME SPEECH SYNC</Text>
        </View>
      </View>

      {/* Live Mic Speech Listening Status Bar */}
      <View style={styles.liveMicBar}>
        <View style={styles.micLeftGroup}>
          <Mic size={14} color={isListening ? '#10B981' : '#FBBF24'} />
          <Text style={styles.micStatusText}>
            {isListening ? 'LIVE MIC RECORDING VOICE...' : 'SPEECH MODE STANDBY'}
          </Text>
        </View>
        {audioLevel > 0 && (
          <View style={styles.audioLevelBadge}>
            <Volume2 size={12} color="#38BDF8" />
            <Text style={styles.audioLevelText}>{audioLevel}%</Text>
          </View>
        )}
      </View>

      {/* Interim / Spoken Speech Typewriter Banner */}
      {(interimTranscript || liveSpokenText) ? (
        <View style={styles.interimBox}>
          <Text style={styles.interimLabel}>SPOKEN VOICE STREAM:</Text>
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
              Listening to live voice audio. Speak into your microphone during the call or type below to send transcripts to both parties.
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
                        {isCaller ? 'CITIZEN CALLER' : 'RESPONDER UNIT'} • {msg.sender_name || 'User'}
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

      {/* Input Box to Speak/Type Live Transcripts */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            role === 'CALLER'
              ? 'Speak into mic or type message to responder...'
              : 'Speak into mic or type message to caller...'
          }
          placeholderTextColor="#71717A"
          onSubmitEditing={handleSendMessage}
        />
        <Pressable
          onPress={handleSendMessage}
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
    height: 160,
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

