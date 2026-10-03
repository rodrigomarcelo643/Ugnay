import { useState, useEffect, useRef } from 'react';

function createFallbackAudioTrack(): MediaStreamTrack | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime); // Very quiet continuous background tone for active WebRTC audio track
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    const track = dst.stream.getAudioTracks()[0];
    return track || null;
  } catch (e) {
    return null;
  }
}

function createFallbackVideoTrack(): MediaStreamTrack | null {
  if (typeof window === 'undefined' || !document.createElement) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    let angle = 0;
    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#09090B';
      ctx.fillRect(0, 0, 640, 480);
      
      // Animated pulse circle
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(320 + Math.cos(angle) * 40, 240 + Math.sin(angle) * 40, 35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UGNAY LIVE VIDEO FEED', 320, 230);
      
      ctx.fillStyle = '#A1A1AA';
      ctx.font = '14px sans-serif';
      ctx.fillText('Real-time Emergency Stream Active', 320, 260);
      
      angle += 0.08;
    };

    setInterval(draw, 40);
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(25) : null;
    return stream ? stream.getVideoTracks()[0] || null : null;
  } catch (e) {
    return null;
  }
}

export function useLiveMedia(channelName?: string, isInitiator: boolean = false) {
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    let activeLocalStream: any = null;
    let remoteAccumulatorStream: any = null;
    let pingInterval: any = null;
    const cName = channelName || 'default_ugnay_channel';
    setIsCallEnded(false);
    setMediaError(null);
    setConnectionState('connecting');

    if (
      typeof window === 'undefined' ||
      typeof MediaStream === 'undefined' ||
      typeof RTCPeerConnection === 'undefined'
    ) {
      return;
    }

    const startMediaAndWebRTC = async () => {
      let mediaStream: any = typeof MediaStream !== 'undefined' ? new MediaStream() : null;
      if (!mediaStream) return;

      // 1. Capture Local Microphone & Camera Stream with Acoustic Echo Cancellation
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: true,
          });
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Camera locked or unavailable, using fallback audio/video track:', err);
        setMediaError('Camera locked by another application — dynamic video feed active');
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          if (!isMounted) return;
          const fallbackTrack = createFallbackVideoTrack();
          if (fallbackTrack) {
            audioOnly.addTrack(fallbackTrack);
          }
          mediaStream = audioOnly;
        } catch (audioErr) {
          console.warn('Microphone locked or unavailable, creating synthetic media stream:', audioErr);
          setMediaError('Hardware camera & mic locked by secondary tab — active fallback feed');
          const syntheticAudio = createFallbackAudioTrack();
          const syntheticVideo = createFallbackVideoTrack();
          if (syntheticAudio) mediaStream.addTrack(syntheticAudio);
          if (syntheticVideo) mediaStream.addTrack(syntheticVideo);
        }
      }

      if (!isMounted) {
        if (mediaStream) {
          mediaStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        }
        return;
      }

      // Ensure stream has at least 1 video track
      if (mediaStream.getVideoTracks().length === 0) {
        const fallbackVid = createFallbackVideoTrack();
        if (fallbackVid) mediaStream.addTrack(fallbackVid);
      }
      // Ensure stream has at least 1 audio track
      if (mediaStream.getAudioTracks().length === 0) {
        const fallbackAud = createFallbackAudioTrack();
        if (fallbackAud) mediaStream.addTrack(fallbackAud);
      }

      activeLocalStream = mediaStream;
      setLocalStream(mediaStream);

      // 2. Setup Local Audio Level Analyser
      setupAudioAnalyser(mediaStream, setAudioLevel);

      if (!isMounted) return;

      // 3. WebRTC Peer Connection Setup for Realtime Voice & Video Cross-Tab Handoff
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      const pendingCandidates: any[] = [];

      const flushCandidates = async () => {
        while (pendingCandidates.length > 0 && isMounted) {
          const cand = pendingCandidates.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
      };

      // Add local tracks to Peer Connection
      mediaStream.getTracks().forEach((track: MediaStreamTrack) => {
        if (isMounted) pc.addTrack(track, mediaStream);
      });

      // Receive Remote Voice & Video Tracks from the peer (Caller / Responder)
      pc.ontrack = (event) => {
        if (!isMounted) return;
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setupAudioAnalyser(event.streams[0], setRemoteAudioLevel);
        } else if (event.track) {
          if (!remoteAccumulatorStream) {
            remoteAccumulatorStream = new MediaStream();
          }
          remoteAccumulatorStream.addTrack(event.track);
          setRemoteStream(remoteAccumulatorStream);
          setupAudioAnalyser(remoteAccumulatorStream, setRemoteAudioLevel);
        }
      };

      // BroadcastChannel for instant local P2P WebRTC signaling
      let bc: BroadcastChannel | null = null;
      try {
        bc = new BroadcastChannel(`ugnay_webrtc_${cName}`);
        broadcastRef.current = bc;
      } catch (e) {
        console.warn('BroadcastChannel creation error:', e);
      }

      const safePostMessage = (data: any) => {
        if (!isMounted) return;
        const targetBc = broadcastRef.current || bc;
        if (targetBc) {
          try {
            targetBc.postMessage(data);
          } catch (e) {
            // Silently swallow postMessage on closed BroadcastChannel
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (!isMounted) return;
        if (event.candidate) {
          const candidateData = event.candidate.toJSON
            ? event.candidate.toJSON()
            : {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                usernameFragment: event.candidate.usernameFragment,
              };
          safePostMessage({ type: 'candidate', candidate: candidateData });
        }
      };

      const createAndSendOffer = async () => {
        if (!isMounted || !pcRef.current || pcRef.current.signalingState !== 'stable') return;
        try {
          const offer = await pc.createOffer();
          if (!isMounted || pcRef.current.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          if (!isMounted) return;
          const offerData = { type: offer.type, sdp: offer.sdp };
          safePostMessage({ type: 'offer', offer: offerData });
        } catch (err) {
          console.warn('Error creating WebRTC offer:', err);
        }
      };

      if (bc && isMounted) {
        bc.onmessage = async (event) => {
          if (!isMounted) return;
          const msg = event.data;
          if (!msg) return;

          try {
            if (msg.type === 'end_call') {
              setIsCallEnded(true);
              if (pcRef.current) pcRef.current.close();
              if (activeLocalStream) {
                activeLocalStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
              }
            } else if (msg.type === 'ping') {
              if (isInitiator && pc.signalingState === 'stable') {
                createAndSendOffer();
              } else if (!isInitiator && !pc.remoteDescription) {
                safePostMessage({ type: 'request_offer' });
              }
            } else if (msg.type === 'offer' && !isInitiator) {
              if (pc.signalingState !== 'stable') return;
              await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
              await flushCandidates();
              if (!isMounted || (pc.signalingState as string) === 'closed') return;
              const answer = await pc.createAnswer();
              if (!isMounted || (pc.signalingState as string) === 'closed') return;
              await pc.setLocalDescription(answer);
              const answerData = { type: answer.type, sdp: answer.sdp };
              safePostMessage({ type: 'answer', answer: answerData });
            } else if (msg.type === 'answer' && isInitiator) {
              if (pc.signalingState !== 'have-local-offer') return;
              await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
              await flushCandidates();
            } else if (msg.type === 'candidate' && msg.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (iceErr) {}
              } else {
                pendingCandidates.push(msg.candidate);
              }
            } else if (msg.type === 'request_offer' && isInitiator) {
              if (pc.signalingState === 'stable') {
                createAndSendOffer();
              }
            }
          } catch (e) {
            console.warn('WebRTC signaling error:', e);
          }
        };

        // Broadcast initial ping to announce presence
        safePostMessage({ type: 'ping' });

        // Request or send offer
        if (isInitiator) {
          createAndSendOffer();
        } else {
          safePostMessage({ type: 'request_offer' });
        }
      }

      // Heartbeat ping interval to auto-recover cross-tab signaling
      pingInterval = setInterval(() => {
        if (!isMounted) {
          clearInterval(pingInterval);
          return;
        }
        if (pcRef.current && (pcRef.current.signalingState as string) !== 'closed' && !pcRef.current.remoteDescription) {
          safePostMessage({ type: 'ping' });
        } else {
          clearInterval(pingInterval);
        }
      }, 1000);

      (pcRef as any)._pingInterval = pingInterval;
    };

    startMediaAndWebRTC();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if ((pcRef as any)?._pingInterval) clearInterval((pcRef as any)._pingInterval);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (e) {}
        audioCtxRef.current = null;
      }
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.onmessage = null;
          broadcastRef.current.close();
        } catch (e) {}
        broadcastRef.current = null;
      }
      if (activeLocalStream) {
        activeLocalStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [channelName, isInitiator]);

  function setupAudioAnalyser(stream: MediaStream, callback: (lvl: number) => void) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const update = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          callback(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(update);
        };

        update();
      }
    } catch (e) {}
  }

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = !isVideoOn;
      });
    }
    setIsVideoOn(!isVideoOn);
  };

  const endCall = () => {
    setIsCallEnded(true);
    if (broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: 'end_call' });
        broadcastRef.current.close();
      } catch (e) {}
      broadcastRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
  };

  return {
    localStream,
    remoteStream,
    audioLevel,
    remoteAudioLevel,
    isSpeaking: audioLevel > 10 || remoteAudioLevel > 10,
    isMuted,
    isVideoOn,
    isCallEnded,
    mediaError,
    connectionState,
    toggleMute,
    toggleVideo,
    endCall,
  };
}
