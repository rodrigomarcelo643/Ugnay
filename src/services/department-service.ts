import { DepartmentInfo, DepartmentType, IncidentType, UserProfile, Incident } from '@/types/incident';
import { supabaseService } from '@/services/supabase';

/**
 * Baseline fallback emergency departments (used when database connection is unavailable)
 */
export const FALLBACK_DEPARTMENTS: DepartmentInfo[] = [
  // ==========================================
  // 1. BGC / TAGUIG LOCAL RESCUE UNITS (NEAR ARTHALAND TOWER - AVAILABLE)
  // ==========================================
  {
    id: 'dept-ems-bgc-01',
    name: 'St. Luke\'s Medical Center Global City EMS',
    type: 'EMS_AMBULANCE',
    category: 'MEDICAL',
    station_name: 'St. Luke\'s Emergency & Trauma EMS Bay',
    address: '32nd St & 5th Ave, Bonifacio Global City, Taguig',
    contact_number: '(02) 8789-7700',
    distance_km: 0.3,
    eta_minutes: 1,
    latitude: 14.5540,
    longitude: 121.0475,
    status: 'AVAILABLE',
    status_reason: 'Ready for immediate dispatch • 2 units on standby',
  },
  {
    id: 'dept-police-bgc-01',
    name: 'PNP Taguig City Police - BGC Substation #1',
    type: 'POLICE_DEPT',
    category: 'SECURITY',
    station_name: 'PNP Fort Bonifacio Community Precinct',
    address: '7th Ave & 30th St, Bonifacio Global City, Taguig',
    contact_number: '(02) 8888-2477',
    distance_km: 0.2,
    eta_minutes: 1,
    latitude: 14.5510,
    longitude: 121.0495,
    status: 'AVAILABLE',
    status_reason: 'Patrol units active on scene standby',
  },
  {
    id: 'dept-fire-bgc-01',
    name: 'Bureau of Fire Protection - BGC Sub-Station',
    type: 'FIRE_DEPT',
    category: 'FIRE',
    station_name: 'BFP Bonifacio Global City Station #1',
    address: '26th St & 11th Ave, Bonifacio Global City, Taguig',
    contact_number: '(02) 8837-0740',
    distance_km: 0.6,
    eta_minutes: 2,
    latitude: 14.5492,
    longitude: 121.0520,
    status: 'AVAILABLE',
    status_reason: 'Fire engine and ladder company ready',
  },
  {
    id: 'dept-drrmo-bgc-01',
    name: 'Taguig City DRRMO - BGC Rescue Operations',
    type: 'FLOOD_DRRMO',
    category: 'FLOOD',
    station_name: 'Taguig DRRMO Command Operations Center',
    address: 'C-5 Perimeter Road, Bonifacio Global City, Taguig',
    contact_number: '(02) 8789-3200',
    distance_km: 1.1,
    eta_minutes: 3,
    latitude: 14.5450,
    longitude: 121.0560,
    status: 'AVAILABLE',
    status_reason: 'Water rescue and disaster relief teams on alert',
  },
  {
    id: 'dept-general-bgc-01',
    name: 'Taguig City Emergency Central Command (DRRMO)',
    type: 'FLOOD_DRRMO',
    category: 'GENERAL',
    station_name: 'Taguig City Hall 911 Operations Center',
    address: 'Gen. Santos Ave, Central Taguig / BGC Sector',
    contact_number: '(02) 8789-3200',
    distance_km: 1.2,
    eta_minutes: 4,
    latitude: 14.5460,
    longitude: 121.0530,
    status: 'AVAILABLE',
    status_reason: 'City-wide multi-agency coordination ready',
  },
  {
    id: 'dept-ems-taguig-02',
    name: 'Taguig-Pateros District Hospital Emergency EMS Unit',
    type: 'EMS_AMBULANCE',
    category: 'MEDICAL',
    station_name: 'Taguig-Pateros District Hospital EMS Bay',
    address: 'East Service Rd, Western Bicutan, Taguig City',
    contact_number: '(02) 8837-8132',
    distance_km: 2.3,
    eta_minutes: 5,
    latitude: 14.5150,
    longitude: 121.0370,
    status: 'AVAILABLE',
    status_reason: 'Hospital trauma EMS ambulance standby unit ready',
  },
  {
    id: 'dept-police-taguig-02',
    name: 'PNP Taguig City Police Station Headquarters',
    type: 'POLICE_DEPT',
    category: 'SECURITY',
    station_name: 'Taguig Central Police Station Headquarters',
    address: 'Gen. Santos Ave, Lower Bicutan, Taguig City',
    contact_number: '(02) 8642-3582',
    distance_km: 2.8,
    eta_minutes: 6,
    latitude: 14.5175,
    longitude: 121.0505,
    status: 'AVAILABLE',
    status_reason: 'Mobile tactical patrol units on city standby',
  },
  {
    id: 'dept-fire-taguig-02',
    name: 'BFP Taguig City Central Fire Station',
    type: 'FIRE_DEPT',
    category: 'FIRE',
    station_name: 'Taguig Central Fire Command Station',
    address: 'Gen. Santos Ave, Bicutan, Taguig City',
    contact_number: '(02) 8838-8902',
    distance_km: 2.6,
    eta_minutes: 5,
    latitude: 14.5180,
    longitude: 121.0510,
    status: 'AVAILABLE',
    status_reason: 'District backup pumper & rescue crew on standby',
  },

  // ==========================================
  // 2. FARTHER AWAY METRO MANILA UNITS (STATUS: OCCUPIED / NOT AVAILABLE / BUSY)
  // ==========================================
  {
    id: 'dept-ems-makati-02',
    name: 'Makati Medical Center Emergency Trauma Bay',
    type: 'EMS_AMBULANCE',
    category: 'MEDICAL',
    station_name: 'Makati Med Emergency Medical Bay',
    address: 'Amorsolo St, Legaspi Village, Makati City',
    contact_number: '(02) 8888-8999',
    distance_km: 4.2,
    eta_minutes: 14,
    latitude: 14.5585,
    longitude: 121.0150,
    status: 'OCCUPIED',
    status_reason: 'Currently occupied • Deployed on code blue vehicular trauma on Ayala Ave',
  },
  {
    id: 'dept-fire-pasig-02',
    name: 'BFP Pasig Central Fire Brigade',
    type: 'FIRE_DEPT',
    category: 'FIRE',
    station_name: 'Pasig City Fire Command Station',
    address: 'C. Raymundo Ave, Pasig City',
    contact_number: '(02) 8641-1911',
    distance_km: 5.8,
    eta_minutes: 18,
    latitude: 14.5760,
    longitude: 121.0820,
    status: 'OCCUPIED',
    status_reason: 'Currently occupied • 2nd-alarm residential fire response in Rosario',
  },
  {
    id: 'dept-police-manda-02',
    name: 'PNP Mandaluyong Police Station HQ',
    type: 'POLICE_DEPT',
    category: 'SECURITY',
    station_name: 'Mandaluyong City Police Station',
    address: 'Maysilo Circle, Boni Ave, Mandaluyong City',
    contact_number: '(02) 8532-2145',
    distance_km: 4.8,
    eta_minutes: 16,
    latitude: 14.5790,
    longitude: 121.0340,
    status: 'BUSY',
    status_reason: 'All patrol units engaged in active operation',
  },
  {
    id: 'dept-drrmo-manila-02',
    name: 'Manila City DRRMO Disaster Response Base',
    type: 'FLOOD_DRRMO',
    category: 'FLOOD',
    station_name: 'Ermita Disaster Command Post',
    address: 'Padre Burgos Ave, Ermita, City of Manila',
    contact_number: '(02) 8527-5174',
    distance_km: 11.8,
    eta_minutes: 35,
    latitude: 14.5895,
    longitude: 120.9815,
    status: 'NOT_AVAILABLE',
    status_reason: 'Not Available • Deployed on storm surge flooding in Manila Bay sector',
  },
  {
    id: 'dept-ems-qc-03',
    name: 'QC General Hospital Emergency EMS Depot',
    type: 'EMS_AMBULANCE',
    category: 'MEDICAL',
    station_name: 'QC North EMS Ambulance Bay',
    address: 'Seminario St, Bahay Toro, Quezon City',
    contact_number: '(02) 8920-5000',
    distance_km: 15.5,
    eta_minutes: 48,
    latitude: 14.6620,
    longitude: 121.0180,
    status: 'OFFLINE',
    status_reason: 'Fleet undergoing routine maintenance and re-supply',
  },

  // ==========================================
  // 3. CEBU CITY REGIONAL BACKUP STATIONS
  // ==========================================
  {
    id: 'dept-fire-cebu-01',
    name: 'Bureau of Fire Protection (BFP) Cebu',
    type: 'FIRE_DEPT',
    category: 'FIRE',
    station_name: 'BFP Cebu City Central Fire Station',
    address: 'N. Bacalso Ave, Cebu City',
    contact_number: '(032) 256-0541',
    distance_km: 1.2,
    eta_minutes: 4,
    latitude: 10.3045,
    longitude: 123.8910,
    status: 'AVAILABLE',
  },
  {
    id: 'dept-flood-cebu-01',
    name: 'MDRRMO Flood Rescue Unit Cebu',
    type: 'FLOOD_DRRMO',
    category: 'FLOOD',
    station_name: 'Cebu City DRRMO Water Search & Rescue',
    address: 'Labangon Riverbank Station, Cebu City',
    contact_number: '(032) 8888-RESCUE',
    distance_km: 0.8,
    eta_minutes: 3,
    latitude: 10.3010,
    longitude: 123.8860,
    status: 'AVAILABLE',
  },
  {
    id: 'dept-ems-cebu-01',
    name: 'CCMC Hospital Emergency EMS Bay',
    type: 'EMS_AMBULANCE',
    category: 'MEDICAL',
    station_name: 'CCMC Emergency Medical Services',
    address: 'Panganiban St, Pahina Central, Cebu City',
    contact_number: '(032) 8911-MED',
    distance_km: 1.1,
    eta_minutes: 4,
    latitude: 10.3005,
    longitude: 123.8935,
    status: 'AVAILABLE',
  },
  {
    id: 'dept-police-cebu-01',
    name: 'Philippine National Police (PNP) Cebu',
    type: 'POLICE_DEPT',
    category: 'SECURITY',
    station_name: 'PNP Police Community Precinct #5',
    address: 'B. Aranas St, San Nicolas, Cebu City',
    contact_number: '(032) 8911-PNP',
    distance_km: 0.9,
    eta_minutes: 3,
    latitude: 10.2965,
    longitude: 123.8940,
    status: 'AVAILABLE',
  },
  {
    id: 'dept-general-cebu-01',
    name: 'Cebu City DRRMO Command Operations Center',
    type: 'FLOOD_DRRMO',
    category: 'GENERAL',
    station_name: 'City Hall Operations Center, Cebu City',
    address: 'City Hall Operations Center, Cebu City',
    contact_number: '(032) 8888-RESCUE',
    distance_km: 1.0,
    eta_minutes: 4,
    latitude: 10.2980,
    longitude: 123.8915,
    status: 'AVAILABLE',
  },
];

/**
 * Calculates accurate geodesic distance (Haversine formula in km)
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Dynamically managed departments list (synced from Supabase DB 'departments' table)
 */
let dynamicDepartments: DepartmentInfo[] = [...FALLBACK_DEPARTMENTS];

/**
 * Synchronizes departments dynamically from Supabase database
 */
export async function syncDepartmentsFromDB(): Promise<DepartmentInfo[]> {
  try {
    const fromDb = await supabaseService.fetchDepartments();
    if (fromDb && fromDb.length > 0) {
      dynamicDepartments = fromDb;
      return fromDb;
    }
  } catch (e) {
    console.warn('Sync departments from DB notice:', e);
  }
  return dynamicDepartments;
}

// Background auto-sync on initialization
syncDepartmentsFromDB();

// Realtime subscription: update stations immediately when status or location updates in DB
if (typeof window !== 'undefined') {
  try {
    supabaseService.subscribeToDepartments((updated) => {
      if (updated && updated.length > 0) {
        dynamicDepartments = updated;
      }
    });
  } catch (e) {}
}

export const REGISTERED_DEPARTMENTS: DepartmentInfo[] = dynamicDepartments;

export const DepartmentService = {
  /**
   * Refreshes dynamic department list directly from the database
   */
  async refreshDepartments(): Promise<DepartmentInfo[]> {
    return syncDepartmentsFromDB();
  },

  /**
   * Gets current list of registered departments
   */
  getDepartments(): DepartmentInfo[] {
    return dynamicDepartments;
  },

  /**
   * Routes an emergency incident to the nearest matching department based on category & caller location.
   * Prioritizes AVAILABLE units first, dynamically calculating real distances and ETAs.
   * Filters out any departments that have previously rejected this incident.
   */
  getNearestDepartment(
    incidentType: IncidentType,
    callerLat: number = 14.5518, // Default to Arthaland Tower, BGC
    callerLng: number = 121.0478,
    preferAvailable: boolean = true,
    excludedDepartmentIdentifiers: string[] = []
  ): DepartmentInfo {
    const sourceList = dynamicDepartments.length > 0 ? dynamicDepartments : FALLBACK_DEPARTMENTS;

    // 1. Filter departments that handle this incident type
    let matching = sourceList.filter((dept) => {
      // Strictly skip any department marked as NOT_AVAILABLE, OCCUPIED, BUSY, or OFFLINE
      if (preferAvailable && dept.status && dept.status !== 'AVAILABLE') return false;
      if (incidentType === 'FIRE') return dept.category === 'FIRE' || dept.type === 'FIRE_DEPT';
      if (incidentType === 'MEDICAL' || incidentType === 'ACCIDENT') return dept.category === 'MEDICAL' || dept.type === 'EMS_AMBULANCE';
      if (incidentType === 'SECURITY') return dept.category === 'SECURITY' || dept.type === 'POLICE_DEPT';
      if (incidentType === 'FLOOD' || incidentType === 'TYPHOON') return dept.category === 'FLOOD' || dept.type === 'FLOOD_DRRMO';
      return true; // GENERAL matches DRRMO / all
    });

    // 2. Filter out any previously rejected departments using normalized comparison
    if (excludedDepartmentIdentifiers && excludedDepartmentIdentifiers.length > 0) {
      const normalizedExcluded = excludedDepartmentIdentifiers
        .filter(Boolean)
        .map((e) => normalizeDeptString(e))
        .filter(Boolean);

      const nonRejected = matching.filter((dept) => {
        const normId = normalizeDeptString(dept.id);
        const normName = normalizeDeptString(dept.name);
        const normStation = normalizeDeptString(dept.station_name);

        const isExcluded = normalizedExcluded.some((ex) => {
          return (
            normId === ex ||
            normName === ex ||
            normStation === ex ||
            normName.includes(ex) ||
            ex.includes(normName) ||
            (normStation && (normStation.includes(ex) || ex.includes(normStation)))
          );
        });

        return !isExcluded;
      });

      if (nonRejected.length > 0) {
        matching = nonRejected;
      } else {
        // If ALL matching category departments rejected, select any other AVAILABLE non-rejected emergency department
        const anyNonRejected = sourceList.filter((dept) => {
          if (dept.status && dept.status !== 'AVAILABLE') return false;
          const normId = normalizeDeptString(dept.id);
          const normName = normalizeDeptString(dept.name);
          const normStation = normalizeDeptString(dept.station_name);
          return !normalizedExcluded.some(
            (ex) =>
              normId === ex ||
              normName === ex ||
              normStation === ex ||
              normName.includes(ex) ||
              ex.includes(normName) ||
              (normStation && (normStation.includes(ex) || ex.includes(normStation)))
          );
        });
        if (anyNonRejected.length > 0) {
          matching = anyNonRejected;
        }
      }
    }

    // 3. Strictly prioritize AVAILABLE departments (skip NOT_AVAILABLE, OCCUPIED, BUSY, OFFLINE)
    if (preferAvailable) {
      const availableOnly = matching.filter((dept) => dept.status === 'AVAILABLE');
      if (availableOnly.length > 0) {
        matching = availableOnly;
      }
    }

    // 4. Compute dynamic distance and estimated travel time
    const computed = matching.map((dept) => {
      const dist = calculateHaversineDistance(callerLat, callerLng, dept.latitude, dept.longitude);
      const speedKmPerHour = 30; // Average emergency vehicle speed in city traffic
      const eta = Math.max(1, Math.round((dist / speedKmPerHour) * 60));
      return {
        ...dept,
        distance_km: dist,
        eta_minutes: eta,
      };
    });

    // 5. Sort by availability and proximity
    computed.sort((a, b) => {
      if (preferAvailable) {
        const aAvail = a.status === 'AVAILABLE' ? 0 : 1;
        const bAvail = b.status === 'AVAILABLE' ? 0 : 1;
        if (aAvail !== bAvail) return aAvail - bAvail;
      }
      return a.distance_km - b.distance_km;
    });

    if (computed.length > 0) {
      return computed[0];
    }

    // Fallback: Return first available non-rejected department in sourceList
    const fallbackAvailable = sourceList.find((dept) => {
      if (dept.status && dept.status !== 'AVAILABLE') return false;
      if (excludedDepartmentIdentifiers && excludedDepartmentIdentifiers.length > 0) {
        const normName = normalizeDeptString(dept.name);
        const normStation = normalizeDeptString(dept.station_name);
        return !excludedDepartmentIdentifiers.some((ex) => {
          const normEx = normalizeDeptString(ex);
          return normEx && (normName.includes(normEx) || (normStation && normStation.includes(normEx)));
        });
      }
      return true;
    });

    return fallbackAvailable || sourceList[0];
  },

  /**
   * Specifically finds the NEXT department to dispatch when the current one rejects.
   */
  getNextDepartment(
    incidentType: IncidentType,
    callerLat: number = 14.5518,
    callerLng: number = 121.0478,
    rejectedIdentifiers: string[] = []
  ): DepartmentInfo {
    return this.getNearestDepartment(incidentType, callerLat, callerLng, true, rejectedIdentifiers);
  },

  /**
   * Returns all nearby departments sorted by proximity, with dynamic distances and real status.
   */
  getAllNearbyDepartments(
    incidentType?: IncidentType,
    callerLat: number = 14.5518,
    callerLng: number = 121.0478
  ): DepartmentInfo[] {
    const sourceList = dynamicDepartments.length > 0 ? dynamicDepartments : FALLBACK_DEPARTMENTS;

    const list = incidentType
      ? sourceList.filter((dept) => {
          if (incidentType === 'FIRE') return dept.category === 'FIRE';
          if (incidentType === 'MEDICAL' || incidentType === 'ACCIDENT') return dept.category === 'MEDICAL';
          if (incidentType === 'SECURITY') return dept.category === 'SECURITY';
          if (incidentType === 'FLOOD' || incidentType === 'TYPHOON') return dept.category === 'FLOOD';
          return true;
        })
      : sourceList;

    return list
      .map((dept) => {
        const dist = calculateHaversineDistance(callerLat, callerLng, dept.latitude, dept.longitude);
        const eta = Math.max(1, Math.round((dist / 30) * 60));
        return {
          ...dept,
          distance_km: dist,
          eta_minutes: eta,
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km);
  },
};

/**
 * Robust string normalizer for department names, stations, and IDs.
 * Strips straight and curly quotes, punctuation, and extra whitespace.
 */
export function normalizeDeptString(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[\u2018\u2019\u0027'`]/g, '') // remove straight and curly apostrophes
    .replace(/[^a-z0-9]/g, ' ')            // convert punctuation to space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determines whether a given responder's department and category match an incident.
 * Ensures that only available responders matching the emergency category and non-rejected station can receive calls.
 */
export function doesResponderMatchIncident(
  responder: UserProfile | null | undefined,
  incident: Incident | null | undefined
): boolean {
  if (!responder || !incident) return false;

  // 1. AVAILABILITY CHECK: If responder is currently offline or busy, DO NOT CALL!
  if (responder.availability && responder.availability !== 'AVAILABLE') {
    return false;
  }

  // 2. REJECTION CHECK: If this responder or department already rejected this incident, DO NOT CALL AGAIN!
  if (incident.rejected_departments && incident.rejected_departments.length > 0) {
    const normRespDept = normalizeDeptString(responder.department_name);
    const normRespStation = normalizeDeptString(responder.station_name);
    const normRespType = normalizeDeptString(responder.department);
    const normRespName = normalizeDeptString(responder.name);

    const isDeptRejected = incident.rejected_departments.some((rej) => {
      const normRej = normalizeDeptString(rej);
      if (!normRej) return false;
      return (
        normRespDept === normRej ||
        normRespStation === normRej ||
        normRespType === normRej ||
        normRespDept.includes(normRej) ||
        normRej.includes(normRespDept) ||
        (normRespStation && (normRespStation.includes(normRej) || normRej.includes(normRespStation))) ||
        (normRespName && normRej.includes(normRespName))
      );
    });
    if (isDeptRejected) {
      return false;
    }
  }

  if (incident.rejected_by_responders && incident.rejected_by_responders.length > 0) {
    const normRespName = normalizeDeptString(responder.name);
    const isUserRejected = incident.rejected_by_responders.some((rej) => {
      const normRej = normalizeDeptString(rej);
      if (!normRej) return false;
      return (
        normRespName === normRej ||
        normRespName.includes(normRej) ||
        normRej.includes(normRespName) ||
        (responder.id && responder.id === rej)
      );
    });
    if (isUserRejected) {
      return false;
    }
  }

  // 3. Central Admin or Central Command can accept/view all non-rejected emergencies
  if (
    responder.role === 'ADMIN' ||
    (responder.department as string) === 'ADMIN_COMMAND' ||
    responder.name?.toLowerCase().includes('admin')
  ) {
    return true;
  }

  const dept = responder.department;
  const deptName = normalizeDeptString(responder.department_name || responder.name);
  const stationName = normalizeDeptString(responder.station_name);
  const incType = ((incident.incident_type || incident.type || 'GENERAL') as string).toUpperCase();
  const incDept = incident.department;
  const incStation = normalizeDeptString(incident.station_name || incident.department_name);

  // 3.5 Check if responder's station / department is marked as unavailable
  const allDepts = DepartmentService.getDepartments();
  const responderDeptObj = allDepts.find(
    (d) =>
      (stationName && normalizeDeptString(d.station_name) === stationName) ||
      (deptName && normalizeDeptString(d.name) === deptName) ||
      (d.id && responder.department_name && d.id === responder.department_name)
  );
  if (responderDeptObj && responderDeptObj.status && responderDeptObj.status !== 'AVAILABLE') {
    return false;
  }

  // 4. STATION SPECIFICITY CHECK: If incident was dispatched to a specific target station, only that station's responders match!
  if (incStation) {
    if (stationName || deptName) {
      const isMatchingStation =
        (stationName && (incStation.includes(stationName) || stationName.includes(incStation))) ||
        (deptName && (incStation.includes(deptName) || deptName.includes(incStation)));

      // If responder is assigned to a specific station that does NOT match the target dispatch station, DO NOT CALL!
      if (!isMatchingStation) {
        return false;
      }
      return true;
    }
  }

  // 5. Direct DepartmentType match (e.g. FIRE_DEPT === FIRE_DEPT)
  if (dept && incDept && dept === incDept) {
    return true;
  }

  // 6. Strict Incident Category to Responder Department Type match
  if (dept === 'FIRE_DEPT') {
    return incType === 'FIRE';
  }
  if (dept === 'POLICE_DEPT') {
    return incType === 'SECURITY' || incType === 'POLICE';
  }
  if (dept === 'EMS_AMBULANCE') {
    return incType === 'MEDICAL' || incType === 'ACCIDENT';
  }
  if (dept === 'FLOOD_DRRMO') {
    return incType === 'FLOOD' || incType === 'TYPHOON' || incType === 'GENERAL';
  }
  if (dept === 'BARANGAY_RESPONSE') {
    return true; // Local barangay responders handle localized community alerts
  }

  // 7. Keyword fallback matching on responder department name / station name
  if (deptName.includes('fire') || stationName.includes('fire') || deptName.includes('bfp')) {
    return incType === 'FIRE';
  }
  if (
    deptName.includes('police') ||
    stationName.includes('police') ||
    deptName.includes('pnp') ||
    deptName.includes('precinct')
  ) {
    return incType === 'SECURITY' || incType === 'POLICE';
  }
  if (
    deptName.includes('ems') ||
    stationName.includes('ems') ||
    deptName.includes('ambulance') ||
    deptName.includes('medical') ||
    deptName.includes('st luke') ||
    deptName.includes('hospital')
  ) {
    return incType === 'MEDICAL' || incType === 'ACCIDENT';
  }
  if (
    deptName.includes('drrmo') ||
    stationName.includes('drrmo') ||
    deptName.includes('flood') ||
    deptName.includes('rescue')
  ) {
    return incType === 'FLOOD' || incType === 'TYPHOON' || incType === 'GENERAL';
  }

  // If incident has no specific type or is GENERAL
  if (incType === 'GENERAL') {
    return true;
  }

  return false;
}
