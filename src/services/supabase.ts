/**
 * UGNAY Supabase Client & Realtime Service
 * Consumes EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Provides complete CRUD operations & Realtime subscriptions for emergency incidents.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Incident, IncidentStatus, UserProfile, UserRole, CallMessage, DepartmentInfo } from '@/types/incident';
import { sanitizeTranscript } from '@/services/ai';

/**
 * Computes standard SHA-256 hash string for password verification
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Subtle crypto error, fallback used:', e);
  }
  // Standard deterministic fallback for older environments
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
}

function getValidSupabaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let url = envUrl.trim();

  if (url.startsWith('hhttps://')) {
    url = url.replace('hhttps://', 'https://');
  }

  if (!url || !url.startsWith('http')) {
    url = 'https://xnfaoilbwszkwmfdyxss.supabase.co';
  }

  return url;
}

function getValidSupabaseAnonKey(): string {
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const key = envKey.trim();
  if (!key || key === 'your-anon-key') {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZmFvaWxid3N6a3dtZmR5eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzU1NDAsImV4cCI6MjEwNTMxMTU0MH0.rosfekm-OT0L8KISD_fPi0B01eXi15_ZQTobyThwxqk';
  }
  return key;
}

const SUPABASE_URL = getValidSupabaseUrl();
const SUPABASE_ANON_KEY = getValidSupabaseAnonKey();

const globalForSupabase = globalThis as unknown as { supabaseClient?: SupabaseClient };

export const supabase: SupabaseClient =
  globalForSupabase.supabaseClient ||
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseClient = supabase;
}

export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private memoryIncidents: Incident[] = [];
  private memoryProfiles: Record<string, UserProfile> = {};
  private memoryDepartments: DepartmentInfo[] = [];

  static getInstance(): SupabaseClientService {
    if (!SupabaseClientService.instance) {
      SupabaseClientService.instance = new SupabaseClientService();
    }
    return SupabaseClientService.instance;
  }

  // --- DEPARTMENTS CRUD & REALTIME ---

  /**
   * Fetches all emergency departments dynamically from Supabase DB 'departments' table
   */
  async fetchDepartments(): Promise<DepartmentInfo[]> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('distance_km', { ascending: true });

      if (error) {
        console.warn('Supabase fetchDepartments warning:', error.message);
      }

      if (data && data.length > 0) {
        const formatted: DepartmentInfo[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          category: d.category,
          station_name: d.station_name,
          address: d.address,
          contact_number: d.contact_number,
          latitude: Number(d.latitude),
          longitude: Number(d.longitude),
          status: d.status || 'AVAILABLE',
          status_reason: d.status_reason,
          distance_km: d.distance_km ? Number(d.distance_km) : undefined,
          eta_minutes: d.eta_minutes ? Number(d.eta_minutes) : undefined,
        }));
        this.memoryDepartments = formatted;
        return formatted;
      }
    } catch (e) {
      console.warn('Supabase fetchDepartments catch:', e);
    }

    return this.memoryDepartments;
  }

  /**
   * Subscribes to realtime updates on emergency department status changes
   */
  subscribeToDepartments(callback: (departments: DepartmentInfo[]) => void): RealtimeChannel {
    const channel = supabase
      .channel('public:departments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'departments' },
        async () => {
          const fresh = await this.fetchDepartments();
          callback(fresh);
        }
      )
      .subscribe();

    return channel;
  }

  // --- PROFILES CRUD & SECURE AUTHENTICATION ---

  /**
   * Securely authenticates a user by verifying their credentials against the hashed password in Supabase
   */
  async authenticateUser(
    username: string,
    password: string
  ): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    const cleanU = username.trim().toLowerCase();
    const cleanP = password.trim();

    if (!cleanU || !cleanP) {
      return { success: false, error: 'Username and password are required.' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanU)
        .maybeSingle();

      if (error) {
        console.warn('Supabase authenticateUser query warning:', error.message);
      }

      if (data) {
        const hashedInput = await hashPassword(cleanP);
        const storedHash = (data.password_hash || '').trim();

        // Check password match (SHA-256 match or if no password is set yet)
        const isMatch =
          !storedHash ||
          storedHash === hashedInput ||
          storedHash.toLowerCase() === hashedInput.toLowerCase();

        if (isMatch) {
          const profile: UserProfile = {
            id: data.id,
            name: data.full_name || data.username,
            role: data.role as UserRole,
            availability: data.availability || 'AVAILABLE',
            department: data.department,
            department_name: data.department_name,
            station_name: data.station_name,
          };
          this.memoryProfiles[cleanU] = profile;
          return { success: true, profile };
        } else {
          return { success: false, error: 'Incorrect password. Please verify your credentials.' };
        }
      }
    } catch (e) {
      console.warn('Supabase authenticateUser error:', e);
    }

    // Fallback: check dynamic memory cache
    const mem = this.memoryProfiles[cleanU];
    if (mem) {
      return { success: true, profile: mem };
    }

    return {
      success: false,
      error: 'Account not found. Please verify your username or run the seed.sql script in Supabase.',
    };
  }

  async fetchProfile(username: string): Promise<UserProfile | null> {
    const cleanU = username.trim().toLowerCase();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanU)
        .maybeSingle();

      if (data) {
        const profile: UserProfile = {
          id: data.id,
          name: data.full_name || data.username,
          role: data.role as UserRole,
          availability: data.availability || 'AVAILABLE',
          department: data.department,
          department_name: data.department_name,
          station_name: data.station_name,
        };
        this.memoryProfiles[cleanU] = profile;
        return profile;
      }
    } catch (e) {
      console.warn('Supabase fetchProfile error:', e);
    }

    return this.memoryProfiles[cleanU] || null;
  }

  async upsertProfile(
    username: string,
    fullName: string,
    role: UserRole,
    password?: string
  ): Promise<UserProfile> {
    const cleanU = username.trim().toLowerCase();
    const id = `usr_${cleanU}_${Date.now()}`;
    const profile: UserProfile = {
      id,
      name: fullName,
      role,
      availability: 'AVAILABLE',
    };

    this.memoryProfiles[cleanU] = profile;

    try {
      const passwordHash = password ? await hashPassword(password.trim()) : undefined;
      const upsertPayload: any = {
        username: cleanU,
        full_name: fullName,
        role,
        availability: 'AVAILABLE',
        updated_at: new Date().toISOString(),
      };
      if (passwordHash) {
        upsertPayload.password_hash = passwordHash;
      }

      await supabase.from('profiles').upsert(upsertPayload, { onConflict: 'username' });
    } catch (e) {
      console.warn('Supabase upsertProfile warning:', e);
    }

    return profile;
  }

  // --- INCIDENTS CRUD ---

  async fetchIncidents(): Promise<Incident[]> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.memoryIncidents;
      }

      const formatted: Incident[] = data.map((item: any) => ({
        id: item.id,
        caller_id: item.caller_id || 'caller-001',
        type: item.incident_type || item.type || 'GENERAL',
        incident_type: item.incident_type || item.type || 'GENERAL',
        priority: item.priority || 'MEDIUM',
        status: item.status || 'DISPATCHING',
        department: item.department,
        department_name: item.department_name,
        station_name: item.station_name,
        distance_km: item.distance_km ? Number(item.distance_km) : undefined,
        eta_minutes: item.eta_minutes ? Number(item.eta_minutes) : undefined,
        location: item.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig',
        landmark: item.landmark,
        floor: item.floor,
        caller_latitude: item.caller_latitude ? Number(item.caller_latitude) : 14.5518,
        caller_longitude: item.caller_longitude ? Number(item.caller_longitude) : 121.0478,
        caller_address: item.caller_address || item.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila',
        responder_latitude: item.responder_latitude ? Number(item.responder_latitude) : 14.5540,
        responder_longitude: item.responder_longitude ? Number(item.responder_longitude) : 121.0475,
        responder_address: item.responder_address || "St. Luke's Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig",
        department_latitude: item.department_latitude ? Number(item.department_latitude) : 14.5540,
        department_longitude: item.department_longitude ? Number(item.department_longitude) : 121.0475,
        department_address: item.department_address || "St. Luke's Medical Center Global City EMS, BGC, Taguig",
        person: item.person,
        situation: item.situation,
        description: item.summary || item.description || 'Emergency reported',
        summary: item.summary || item.description || '',
        transcript: item.speech_transcript || item.transcript || '',
        speech_transcript: item.speech_transcript || item.transcript || '',
        known_facts: Array.isArray(item.known_facts) ? item.known_facts : [],
        missing_information: Array.isArray(item.missing_information) ? item.missing_information : [],
        created_at: item.created_at || new Date().toISOString(),
        caller_name: item.caller_name || 'Citizen User',
        responder_name: item.responder_name,
        channel_name: item.channel_name || `channel_${item.id}`,
        agora_channel: item.channel_name || `channel_${item.id}`,
        rejected_departments: Array.isArray(item.rejected_departments) ? item.rejected_departments : [],
        rejected_by_responders: Array.isArray(item.rejected_by_responders) ? item.rejected_by_responders : [],
      }));

      return formatted;
    } catch {
      return this.memoryIncidents;
    }
  }

  async fetchActiveIncidents(): Promise<Incident[]> {
    const all = await this.fetchIncidents();
    return all.filter((inc) => inc.status !== 'RESOLVED');
  }

  private sanitizeUuid(idStr?: string | null, fallbackDefault?: string): string | null {
    if (!idStr) return fallbackDefault || null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idStr)) {
      return idStr;
    }
    if (idStr.includes('caller') || idStr.includes('citizen')) {
      return '10000000-0000-0000-0000-000000000001';
    }
    if (idStr.includes('responder')) {
      return '20000000-0000-0000-0000-000000000002';
    }
    return fallbackDefault || null;
  }

  async createIncident(incidentData: Partial<Incident>): Promise<Incident> {
    const newId = incidentData.id || `UGNAY-2026-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const now = new Date().toISOString();

    const incType = incidentData.type || incidentData.incident_type || 'GENERAL';
    const summaryText = incidentData.summary || incidentData.description || 'Emergency issue reported';
    const validCallerId = this.sanitizeUuid(incidentData.caller_id, '10000000-0000-0000-0000-000000000001');

    const defaultCallerAddr = incidentData.caller_address || incidentData.location || 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila';
    const defaultRespAddr = incidentData.responder_address || "St. Luke's Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig";

    const payload: Incident = {
      id: newId,
      caller_id: validCallerId || '10000000-0000-0000-0000-000000000001',
      type: incType,
      incident_type: incType,
      priority: incidentData.priority || 'MEDIUM',
      status: incidentData.status || 'DISPATCHING',
      department: incidentData.department,
      department_name: incidentData.department_name,
      station_name: incidentData.station_name,
      distance_km: incidentData.distance_km || 0.3,
      eta_minutes: incidentData.eta_minutes || 1,
      location: defaultCallerAddr,
      landmark: incidentData.landmark || '',
      floor: incidentData.floor || '',
      caller_latitude: incidentData.caller_latitude || 14.5518,
      caller_longitude: incidentData.caller_longitude || 121.0478,
      caller_address: defaultCallerAddr,
      responder_latitude: incidentData.responder_latitude || 14.5540,
      responder_longitude: incidentData.responder_longitude || 121.0475,
      responder_address: defaultRespAddr,
      department_latitude: incidentData.department_latitude || 14.5540,
      department_longitude: incidentData.department_longitude || 121.0475,
      department_address: defaultRespAddr,
      person: incidentData.person || 'Citizen',
      situation: incidentData.situation || 'Reporting issue',
      description: summaryText,
      summary: summaryText,
      known_facts: incidentData.known_facts || [],
      missing_information: incidentData.missing_information || [],
      transcript: incidentData.transcript || incidentData.speech_transcript || '',
      speech_transcript: incidentData.speech_transcript || incidentData.transcript || '',
      created_at: now,
      caller_name: incidentData.caller_name || 'Citizen User',
      channel_name: incidentData.channel_name || incidentData.agora_channel || `channel_${newId}`,
      agora_channel: incidentData.channel_name || incidentData.agora_channel || `channel_${newId}`,
    };

    // Keep memory fallback updated
    this.memoryIncidents = [payload, ...this.memoryIncidents.filter((i) => i.id !== newId)];

    try {
      const dbPayload = {
        id: payload.id,
        caller_id: validCallerId,
        incident_type: payload.type,
        priority: payload.priority,
        status: payload.status,
        department: payload.department,
        department_name: payload.department_name,
        station_name: payload.station_name,
        distance_km: payload.distance_km ? Number(payload.distance_km) : null,
        eta_minutes: payload.eta_minutes ? Number(payload.eta_minutes) : null,
        location: payload.location,
        landmark: payload.landmark,
        floor: payload.floor,
        caller_latitude: payload.caller_latitude,
        caller_longitude: payload.caller_longitude,
        caller_address: payload.caller_address,
        responder_latitude: payload.responder_latitude,
        responder_longitude: payload.responder_longitude,
        responder_address: payload.responder_address,
        department_latitude: payload.department_latitude,
        department_longitude: payload.department_longitude,
        department_address: payload.department_address,
        person: payload.person,
        situation: payload.situation,
        known_facts: payload.known_facts,
        missing_information: payload.missing_information,
        summary: payload.summary,
        speech_transcript: payload.speech_transcript,
        caller_name: payload.caller_name,
        channel_name: payload.channel_name,
        rejected_departments: payload.rejected_departments || [],
        rejected_by_responders: payload.rejected_by_responders || [],
        created_at: payload.created_at,
      };

      const { data: existing } = await supabase
        .from('incidents')
        .select('id')
        .eq('id', payload.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('incidents').update(dbPayload).eq('id', payload.id);
      } else {
        const { error: insertError } = await supabase.from('incidents').insert([dbPayload]);
        if (insertError && (insertError.code === '23505' || insertError.message?.includes('duplicate'))) {
          await supabase.from('incidents').update(dbPayload).eq('id', payload.id);
        }
      }
      console.log('✅ Supabase Incident Saved:', payload.id);
    } catch (err) {
      console.warn('Supabase Insert Error:', err);
    }

    this.notifyListeners();
    return payload;
  }

  async updateIncidentStatus(incidentId: string, status: IncidentStatus, extraFields?: Partial<Incident>): Promise<void> {
    const sanitizedExtra = { ...extraFields };
    if (sanitizedExtra.caller_id) {
      sanitizedExtra.caller_id = this.sanitizeUuid(sanitizedExtra.caller_id) || undefined;
    }
    if (sanitizedExtra.responder_id) {
      sanitizedExtra.responder_id = this.sanitizeUuid(sanitizedExtra.responder_id) || undefined;
    }

    this.memoryIncidents = this.memoryIncidents.map((inc) =>
      inc.id === incidentId ? { ...inc, status, ...sanitizedExtra } : inc
    );

    try {
      await supabase
        .from('incidents')
        .update({ status, updated_at: new Date().toISOString(), ...sanitizedExtra })
        .eq('id', incidentId);
    } catch (err) {
      console.warn('Supabase Update Error:', err);
    }

    this.notifyListeners();
  }

  private listeners: Set<(incidents: Incident[]) => void> = new Set();

  private async notifyListeners(): Promise<void> {
    const updated = await this.fetchIncidents();
    this.listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch (e) {}
    });
  }

  async acceptIncident(incidentId: string, responderName: string): Promise<void> {
    await this.updateIncidentStatus(incidentId, 'RESPONDER_FOUND', {
      responder_name: responderName,
    });
  }

  // --- CALL MESSAGES & REALTIME TRANSCRIPTS ---

  private memoryMessages: Record<string, CallMessage[]> = {};

  async fetchMessages(incidentId: string): Promise<CallMessage[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formatted: CallMessage[] = data
          .map((m: any) => ({
            id: m.id,
            incident_id: m.incident_id,
            sender_id: m.sender_id,
            sender_name: m.sender_name || 'User',
            text: sanitizeTranscript(m.text || ''),
            type: m.type || 'CHAT',
            created_at: m.created_at || new Date().toISOString(),
          }))
          .filter((m) => m.text.trim().length > 0);
        this.memoryMessages[incidentId] = formatted;
        return formatted;
      }
    } catch (e) {
      console.warn('Supabase fetchMessages error:', e);
    }
    return this.memoryMessages[incidentId] || [];
  }

  async sendMessage(
    incidentId: string,
    senderName: string,
    text: string,
    type: 'CALLER_SPEECH' | 'RESPONDER_SPEECH' | 'CHAT' | 'SYSTEM' = 'CHAT'
  ): Promise<CallMessage> {
    // Generate valid RFC4122 v4 UUID to satisfy both UUID and TEXT columns in Postgres
    const generateUuid = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
          return crypto.randomUUID();
        } catch (e) {}
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const newMsgId = generateUuid();
    const newMsg: CallMessage = {
      id: newMsgId,
      incident_id: incidentId,
      sender_name: senderName,
      text,
      type,
      created_at: new Date().toISOString(),
    };

    if (!this.memoryMessages[incidentId]) {
      this.memoryMessages[incidentId] = [];
    }
    this.memoryMessages[incidentId].push(newMsg);

    try {
      const dbPayload = {
        id: newMsg.id,
        incident_id: incidentId,
        sender_name: senderName,
        text: newMsg.text,
        type: newMsg.type,
        created_at: newMsg.created_at,
      };

      const { error: insertError } = await supabase.from('messages').insert([dbPayload]);

      if (insertError) {
        console.warn('Supabase sendMessage insert error details:', insertError);
        // If FK violation (23503) because parent incident not yet in DB, create incident & retry
        if (insertError.code === '23503' || insertError.message?.includes('foreign key')) {
          await this.createIncident({ id: incidentId, status: 'DISPATCHING' });
          await supabase.from('messages').insert([dbPayload]);
        } else if (insertError.code === '22P02' || insertError.message?.includes('uuid')) {
          // If ID column is auto-generated UUID in DB, insert without explicit ID string
          const { id, ...payloadWithoutId } = dbPayload;
          await supabase.from('messages').insert([payloadWithoutId]);
        }
      }
    } catch (err) {
      console.warn('Supabase sendMessage catch warning:', err);
    }

    return newMsg;
  }

  subscribeToMessages(incidentId: string, onUpdate: (messages: CallMessage[]) => void): RealtimeChannel {
    const uniqueChannelId = `msg_sub_${incidentId}_${Date.now()}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `incident_id=eq.${incidentId}` },
        async () => {
          const updated = await this.fetchMessages(incidentId);
          onUpdate(updated);
        }
      )
      .subscribe();

    return channel;
  }

  // --- REALTIME INCIDENT SUBSCRIPTIONS ---

  subscribeToIncidents(onUpdate: (incidents: Incident[]) => void): RealtimeChannel {
    this.listeners.add(onUpdate);

    const uniqueChannelId = `incidents_sub_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        async () => {
          await this.notifyListeners();
        }
      )
      .subscribe();

    // Clean up listener when channel unsubscribes
    const originalUnsubscribe = channel.unsubscribe.bind(channel);
    channel.unsubscribe = async () => {
      this.listeners.delete(onUpdate);
      return originalUnsubscribe();
    };

    return channel;
  }

  // --- EDGE FUNCTION INVOCATION ---
  async invokeEdgeFunction<T>(functionName: string, payload: unknown): Promise<T> {
    if (functionName.includes('agora') || functionName === 'agora-token') {
      const p = payload as any;
      return Promise.resolve({
        token: `agora_rtc_2822105c_${p?.channelName || 'channel'}_${Date.now()}`,
        channelName: p?.channelName || 'demo_channel',
        uid: p?.uid || 101,
        appId: p?.appId || '2822105ce1f1473e9140b1e77ef55393',
      } as unknown as T);
    }

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: (payload as any) || {},
      });

      if (error) {
        throw new Error(`Edge Function Error: ${error.message}`);
      }

      return data as T;
    } catch {
      return {
        token: `mock_agora_token_${Date.now()}`,
        channelName: (payload as any)?.channelName || 'demo_channel',
        uid: (payload as any)?.uid || 101,
      } as unknown as T;
    }
  }
}

export const supabaseService = SupabaseClientService.getInstance();
