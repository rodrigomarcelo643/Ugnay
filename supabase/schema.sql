-- ==========================================
-- UGNAY Emergency Response Database Schema
-- Dynamic Supabase Migration, Realtime & Multi-Agency Schema
-- ==========================================

-- Enable cryptographic extensions for password hashing and UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. PROFILES TABLE (USERS & RESPONDERS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CALLER',
  availability TEXT DEFAULT 'AVAILABLE',
  department TEXT,
  department_name TEXT,
  station_name TEXT,
  contact_number TEXT,
  badge_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DROP RESTRICTIVE FOREIGN KEY & CHECK CONSTRAINTS IF PRE-EXISTING
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_availability_check;

-- ADD CHECK CONSTRAINTS FOR PROFILES
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('CALLER', 'RESPONDER', 'ADMIN'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_availability_check CHECK (availability IN ('AVAILABLE', 'BUSY', 'OFFLINE'));

-- ENSURE COLUMNS EXIST (Migration safety for pre-existing tables)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS station_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ==========================================
-- 2. DEPARTMENTS TABLE (EMERGENCY STATIONS & FLEET)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  station_name TEXT,
  address TEXT,
  contact_number TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  status TEXT DEFAULT 'AVAILABLE',
  status_reason TEXT,
  distance_km NUMERIC DEFAULT 0,
  eta_minutes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_status_check;
ALTER TABLE public.departments ADD CONSTRAINT departments_status_check CHECK (
  status IN ('AVAILABLE', 'OCCUPIED', 'BUSY', 'NOT_AVAILABLE', 'OFFLINE')
);

-- ENSURE DEPARTMENTS COLUMNS EXIST
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AVAILABLE';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS eta_minutes INT DEFAULT 0;

-- ==========================================
-- 3. INCIDENTS TABLE (GPS TRIAGING & DISPATCH)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY,
  caller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  caller_name TEXT,
  responder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responder_name TEXT,
  department TEXT,
  department_name TEXT,
  station_name TEXT,
  distance_km NUMERIC,
  eta_minutes INT,
  incident_type TEXT NOT NULL DEFAULT 'GENERAL',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'DISPATCHING',
  location TEXT,
  landmark TEXT,
  floor TEXT,
  caller_latitude NUMERIC DEFAULT 14.5518,
  caller_longitude NUMERIC DEFAULT 121.0478,
  caller_address TEXT DEFAULT 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila',
  responder_latitude NUMERIC DEFAULT 14.5540,
  responder_longitude NUMERIC DEFAULT 121.0475,
  responder_address TEXT DEFAULT 'St. Luke''s Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig',
  department_latitude NUMERIC DEFAULT 14.5540,
  department_longitude NUMERIC DEFAULT 121.0475,
  department_address TEXT DEFAULT 'St. Luke''s Medical Center Global City EMS, BGC, Taguig',
  person TEXT,
  situation TEXT,
  known_facts JSONB DEFAULT '[]'::jsonb,
  missing_information JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  speech_transcript TEXT,
  channel_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DROP RESTRICTIVE CONSTRAINTS IF PRE-EXISTING
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_caller_id_fkey;
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_responder_id_fkey;
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_status_check;

ALTER TABLE public.incidents ADD CONSTRAINT incidents_status_check CHECK (
  status IN (
    'NEW', 'ANALYZING', 'DISPATCHING', 'NEEDS_RESPONSE',
    'MATCHING', 'RESPONDER_FOUND', 'EN_ROUTE', 'ON_SCENE',
    'LIVE', 'RESOLVING', 'RESOLVED', 'OFFLINE_QUEUED'
  )
);

-- ENSURE INCIDENTS COLUMNS EXIST
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS responder_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS station_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS eta_minutes INT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS caller_latitude NUMERIC DEFAULT 14.5518;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS caller_longitude NUMERIC DEFAULT 121.0478;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS caller_address TEXT DEFAULT 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS responder_latitude NUMERIC DEFAULT 14.5540;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS responder_longitude NUMERIC DEFAULT 121.0475;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS responder_address TEXT DEFAULT 'St. Luke''s Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS department_latitude NUMERIC DEFAULT 14.5540;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS department_longitude NUMERIC DEFAULT 121.0475;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS department_address TEXT DEFAULT 'St. Luke''s Medical Center Global City EMS, BGC, Taguig';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS person TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS speech_transcript TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS channel_name TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS rejected_departments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS rejected_by_responders JSONB DEFAULT '[]'::jsonb;

-- ==========================================
-- 4. MESSAGES TABLE (CALL TRANSCRIPTS & CHAT)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES public.incidents(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT DEFAULT 'CHAT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_incident_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (
  type IN ('CALLER_SPEECH', 'RESPONDER_SPEECH', 'CHAT', 'SYSTEM')
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'CHAT';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ==========================================
-- 5. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_department ON public.incidents(department);
CREATE INDEX IF NOT EXISTS idx_departments_category ON public.departments(category);
CREATE INDEX IF NOT EXISTS idx_departments_status ON public.departments(status);
CREATE INDEX IF NOT EXISTS idx_messages_incident_id ON public.messages(incident_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ==========================================
-- 6. REPLICA IDENTITY FOR REALTIME STREAMS
-- ==========================================
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.departments REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ==========================================
-- 7. ROW LEVEL SECURITY (RLS POLICIES)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete to profiles" ON public.profiles;

CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert to profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to profiles" ON public.profiles FOR DELETE USING (true);

-- Departments Policies
DROP POLICY IF EXISTS "Allow public read access to departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public insert to departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public update to departments" ON public.departments;
DROP POLICY IF EXISTS "Allow public delete to departments" ON public.departments;

CREATE POLICY "Allow public read access to departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow public insert to departments" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to departments" ON public.departments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to departments" ON public.departments FOR DELETE USING (true);

-- Incidents Policies
DROP POLICY IF EXISTS "Allow public read access to incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow public insert to incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow public update to incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow public delete to incidents" ON public.incidents;

CREATE POLICY "Allow public read access to incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Allow public insert to incidents" ON public.incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to incidents" ON public.incidents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to incidents" ON public.incidents FOR DELETE USING (true);

-- Messages Policies
DROP POLICY IF EXISTS "Allow public read access to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public insert to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public update to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public delete to messages" ON public.messages;

CREATE POLICY "Allow public read access to messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert to messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to messages" ON public.messages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to messages" ON public.messages FOR DELETE USING (true);

-- ==========================================
-- 8. ENABLE REALTIME PUBLICATION
-- ==========================================
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.profiles, public.departments, public.incidents, public.messages;
