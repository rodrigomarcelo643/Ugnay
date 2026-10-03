export type IncidentType = 'FLOOD' | 'MEDICAL' | 'FIRE' | 'ACCIDENT' | 'SECURITY' | 'TYPHOON' | 'GENERAL';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus =
  | 'NEW'
  | 'ANALYZING'
  | 'DISPATCHING'
  | 'NEEDS_RESPONSE'
  | 'MATCHING'
  | 'RESPONDER_FOUND'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'LIVE'
  | 'RESOLVING'
  | 'RESOLVED'
  | 'OFFLINE_QUEUED';

export type UserRole = 'CALLER' | 'RESPONDER' | 'ADMIN';

export type DepartmentType = 'FIRE_DEPT' | 'FLOOD_DRRMO' | 'EMS_AMBULANCE' | 'POLICE_DEPT' | 'BARANGAY_RESPONSE';

export interface DepartmentInfo {
  id: string;
  name: string;
  type: DepartmentType;
  category: IncidentType;
  station_name: string;
  address: string;
  contact_number: string;
  distance_km?: number;
  eta_minutes?: number;
  latitude: number;
  longitude: number;
  status?: 'AVAILABLE' | 'OCCUPIED' | 'BUSY' | 'NOT_AVAILABLE' | 'OFFLINE';
  status_reason?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  role: UserRole;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  department?: DepartmentType;
  department_name?: string;
  station_name?: string;
}

export interface Incident {
  id: string;
  caller_id: string;
  caller_name?: string;
  responder_id?: string;
  responder_name?: string;
  department?: DepartmentType;
  department_name?: string;
  station_name?: string;
  distance_km?: number;
  eta_minutes?: number;
  type: IncidentType;
  incident_type?: IncidentType;
  category_tags?: string[];
  priority: Priority;
  description: string;
  summary?: string;
  person?: string;
  situation?: string;
  location?: string;
  landmark?: string;
  floor?: string;
  caller_latitude?: number;
  caller_longitude?: number;
  caller_address?: string;
  responder_latitude?: number;
  responder_longitude?: number;
  responder_address?: string;
  department_latitude?: number;
  department_longitude?: number;
  department_address?: string;
  status: IncidentStatus;
  channel_name?: string;
  agora_channel?: string;
  created_at: string;
  missing_information?: string[];
  known_facts?: string[];
  transcript?: string;
  speech_transcript?: string;
  rejected_departments?: string[];
  rejected_by_responders?: string[];
}

export interface CallMessage {
  id: string;
  incident_id: string;
  sender_id?: string;
  sender_name: string;
  text: string;
  type: 'CALLER_SPEECH' | 'RESPONDER_SPEECH' | 'CHAT' | 'SYSTEM';
  created_at: string;
}
