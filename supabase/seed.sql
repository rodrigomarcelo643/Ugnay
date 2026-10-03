-- ============================================================================
-- UGNAY EMERGENCY RESPONSE DATABASE SEED DATA
-- Dynamic Stations, Fleet Availability & Seeded Credentials with Hashed Passwords
-- ============================================================================

-- Ensure pgcrypto is enabled for secure password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SEED EMERGENCY DEPARTMENTS & STATIONS
-- ============================================================================
INSERT INTO public.departments (
  id, name, type, category, station_name, address, contact_number,
  latitude, longitude, status, status_reason, distance_km, eta_minutes
) VALUES
  -- --------------------------------------------------------------------------
  -- A. LOCAL BGC / TAGUIG UNITS (NEAR ARTHALAND CENTURY PACIFIC TOWER)
  -- --------------------------------------------------------------------------
  (
    'dept-ems-bgc-01',
    'St. Luke''s Medical Center Global City EMS',
    'EMS_AMBULANCE',
    'MEDICAL',
    'St. Luke''s Emergency & Trauma EMS Bay',
    '32nd St & 5th Ave, Bonifacio Global City, Taguig',
    '(02) 8789-7700',
    14.5540,
    121.0475,
    'AVAILABLE',
    'Ready for immediate dispatch • 2 units on standby',
    0.3,
    1
  ),
  (
    'dept-police-bgc-01',
    'PNP Taguig City Police - BGC Substation #1',
    'POLICE_DEPT',
    'SECURITY',
    'PNP Fort Bonifacio Community Precinct',
    '7th Ave & 30th St, Bonifacio Global City, Taguig',
    '(02) 8888-2477',
    14.5510,
    121.0495,
    'AVAILABLE',
    'Patrol units active on scene standby',
    0.2,
    1
  ),
  (
    'dept-fire-bgc-01',
    'Bureau of Fire Protection - BGC Sub-Station',
    'FIRE_DEPT',
    'FIRE',
    'BFP Bonifacio Global City Station #1',
    '26th St & 11th Ave, Bonifacio Global City, Taguig',
    '(02) 8837-0740',
    14.5492,
    121.0520,
    'AVAILABLE',
    'Fire engine and ladder company ready',
    0.6,
    2
  ),
  (
    'dept-drrmo-bgc-01',
    'Taguig City DRRMO - BGC Rescue Operations',
    'FLOOD_DRRMO',
    'FLOOD',
    'Taguig DRRMO Command Operations Center',
    'C-5 Perimeter Road, Bonifacio Global City, Taguig',
    '(02) 8789-3200',
    14.5450,
    121.0560,
    'AVAILABLE',
    'Water rescue and disaster relief teams on alert',
    1.1,
    3
  ),
  (
    'dept-general-bgc-01',
    'Taguig City Emergency Central Command (DRRMO)',
    'FLOOD_DRRMO',
    'GENERAL',
    'Taguig City Hall 911 Operations Center',
    'Gen. Santos Ave, Central Taguig / BGC Sector',
    '(02) 8789-3200',
    14.5460,
    121.0530,
    'AVAILABLE',
    'City-wide multi-agency coordination ready',
    1.2,
    4
  ),

  -- --------------------------------------------------------------------------
  -- B. SURROUNDING METRO MANILA UNITS (OCCUPIED / BUSY / NOT AVAILABLE / OFFLINE)
  -- --------------------------------------------------------------------------
  (
    'dept-ems-makati-02',
    'Makati Medical Center Emergency Trauma Bay',
    'EMS_AMBULANCE',
    'MEDICAL',
    'Makati Med Emergency Medical Bay',
    'Amorsolo St, Legaspi Village, Makati City',
    '(02) 8888-8999',
    14.5585,
    121.0150,
    'OCCUPIED',
    'Currently occupied • Deployed on code blue vehicular trauma on Ayala Ave',
    4.2,
    14
  ),
  (
    'dept-fire-pasig-02',
    'BFP Pasig Central Fire Brigade',
    'FIRE_DEPT',
    'FIRE',
    'Pasig City Fire Command Station',
    'C. Raymundo Ave, Pasig City',
    '(02) 8641-1911',
    14.5760,
    121.0820,
    'OCCUPIED',
    'Currently occupied • 2nd-alarm residential fire response in Rosario',
    5.8,
    18
  ),
  (
    'dept-police-manda-02',
    'PNP Mandaluyong Police Station HQ',
    'POLICE_DEPT',
    'SECURITY',
    'Mandaluyong City Police Station',
    'Maysilo Circle, Boni Ave, Mandaluyong City',
    '(02) 8532-2145',
    14.5790,
    121.0340,
    'BUSY',
    'All patrol units engaged in active operation',
    4.8,
    16
  ),
  (
    'dept-drrmo-manila-02',
    'Manila City DRRMO Disaster Response Base',
    'FLOOD_DRRMO',
    'FLOOD',
    'Ermita Disaster Command Post',
    'Padre Burgos Ave, Ermita, City of Manila',
    '(02) 8527-5174',
    14.5895,
    120.9815,
    'NOT_AVAILABLE',
    'Not Available • Deployed on storm surge flooding in Manila Bay sector',
    11.8,
    35
  ),
  (
    'dept-ems-qc-03',
    'QC General Hospital Emergency EMS Depot',
    'EMS_AMBULANCE',
    'MEDICAL',
    'QC North EMS Ambulance Bay',
    'Seminario St, Bahay Toro, Quezon City',
    '(02) 8920-5000',
    14.6620,
    121.0180,
    'OFFLINE',
    'Fleet undergoing routine maintenance and re-supply',
    15.5,
    48
  ),

  -- --------------------------------------------------------------------------
  -- C. CEBU REGIONAL BACKUP STATIONS
  -- --------------------------------------------------------------------------
  (
    'dept-fire-cebu-01',
    'Bureau of Fire Protection (BFP) Cebu',
    'FIRE_DEPT',
    'FIRE',
    'BFP Cebu City Central Fire Station',
    'N. Bacalso Ave, Cebu City',
    '(02) 256-0541',
    10.3045,
    123.8910,
    'AVAILABLE',
    'Regional backup station ready',
    1.2,
    4
  ),
  (
    'dept-flood-cebu-01',
    'MDRRMO Flood Rescue Unit Cebu',
    'FLOOD_DRRMO',
    'FLOOD',
    'Cebu City DRRMO Water Search & Rescue',
    'Labangon Riverbank Station, Cebu City',
    '(032) 8888-RESCUE',
    10.3010,
    123.8860,
    'AVAILABLE',
    'River patrol & water rescue ready',
    0.8,
    3
  ),
  (
    'dept-ems-cebu-01',
    'CCMC Hospital Emergency EMS Bay',
    'EMS_AMBULANCE',
    'MEDICAL',
    'CCMC Emergency Medical Services',
    'Panganiban St, Pahina Central, Cebu City',
    '(032) 8911-MED',
    10.3005,
    123.8935,
    'AVAILABLE',
    'Regional hospital trauma unit ready',
    1.1,
    4
  ),
  (
    'dept-police-cebu-01',
    'Philippine National Police (PNP) Cebu',
    'POLICE_DEPT',
    'SECURITY',
    'PNP Police Community Precinct #5',
    'B. Aranas St, San Nicolas, Cebu City',
    '(032) 8911-PNP',
    10.2965,
    123.8940,
    'AVAILABLE',
    'Regional community patrol ready',
    0.9,
    3
  ),
  (
    'dept-general-cebu-01',
    'Cebu City DRRMO Command Operations Center',
    'FLOOD_DRRMO',
    'GENERAL',
    'City Hall Operations Center, Cebu City',
    'City Hall Operations Center, Cebu City',
    '(032) 8888-RESCUE',
    10.2980,
    123.8915,
    'AVAILABLE',
    'Visayas regional coordination center',
    1.0,
    4
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  station_name = EXCLUDED.station_name,
  address = EXCLUDED.address,
  contact_number = EXCLUDED.contact_number,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  status = EXCLUDED.status,
  status_reason = EXCLUDED.status_reason,
  distance_km = EXCLUDED.distance_km,
  eta_minutes = EXCLUDED.eta_minutes,
  updated_at = NOW();

-- ============================================================================
-- 2. SEED USER PROFILES WITH HASHED PASSWORDS
-- ============================================================================
-- Passwords are encrypted using SHA-256 via pgcrypto: encode(digest('plaintext', 'sha256'), 'hex')
-- Plaintext credentials for testing:
-- ----------------------------------------------------------------------------
-- Citizen Caller:       username: citizen123        password: Password123!
-- Citizen Caller 2:     username: caller_bgc        password: Password123!
-- EMS Responder:        username: ems_responder     password: Password123!
-- Police Responder:     username: police_responder  password: Password123!
-- Fire Responder:       username: fire_responder    password: Password123!
-- DRRMO Responder:      username: responder123      password: Password123!
-- Emergency Admin:      username: admin_ugnay       password: AdminPassword123!
-- ----------------------------------------------------------------------------

INSERT INTO public.profiles (
  id, username, password_hash, full_name, role, availability,
  department, department_name, station_name, contact_number, badge_number
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'citizen123',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'Citizen User (BGC Resident)',
    'CALLER',
    'AVAILABLE',
    NULL,
    NULL,
    NULL,
    '(0917) 123-4567',
    NULL
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'caller_bgc',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'Juan De La Cruz (Arthaland Tower)',
    'CALLER',
    'AVAILABLE',
    NULL,
    NULL,
    NULL,
    '(0918) 555-8899',
    NULL
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'responder123',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'Officer Marcelo Santos',
    'RESPONDER',
    'AVAILABLE',
    'FLOOD_DRRMO',
    'Taguig City DRRMO - BGC Rescue Operations',
    'Taguig DRRMO Command Operations Center',
    '(02) 8789-3200',
    'DRRMO-BGC-04'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'fire_responder',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'Captain Juan Dela Cruz',
    'RESPONDER',
    'AVAILABLE',
    'FIRE_DEPT',
    'Bureau of Fire Protection - BGC Sub-Station',
    'BFP Bonifacio Global City Station #1',
    '(02) 8837-0740',
    'BFP-BGC-101'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'ems_responder',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'Medic Sarah Ramos',
    'RESPONDER',
    'AVAILABLE',
    'EMS_AMBULANCE',
    'St. Luke''s Medical Center Global City EMS',
    'St. Luke''s Emergency & Trauma EMS Bay',
    '(02) 8789-7700',
    'SLMC-EMS-202'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    'police_responder',
    encode(digest('Password123!', 'sha256'), 'hex'),
    'PO3 Ricardo Reyes',
    'RESPONDER',
    'AVAILABLE',
    'POLICE_DEPT',
    'PNP Taguig City Police - BGC Substation #1',
    'PNP Fort Bonifacio Community Precinct',
    '(02) 8888-2477',
    'PNP-BGC-303'
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    'admin_ugnay',
    encode(digest('AdminPassword123!', 'sha256'), 'hex'),
    'Command Dispatcher Chief',
    'ADMIN',
    'AVAILABLE',
    'ADMIN_COMMAND',
    'UGNAY Central Emergency Dispatch Operations',
    'Metro Manila Unified 911 Operations Center',
    '(02) 8911-0000',
    'UGNAY-DIR-01'
  )
ON CONFLICT (username) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  department_name = EXCLUDED.department_name,
  station_name = EXCLUDED.station_name,
  contact_number = EXCLUDED.contact_number,
  badge_number = EXCLUDED.badge_number,
  updated_at = NOW();
