import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, DimensionValue, ActivityIndicator, useWindowDimensions } from 'react-native';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Compass,
  ShieldAlert,
  Route,
  Layers,
  Sparkles,
  Clock,
} from 'lucide-react-native';
import { locationService } from '@/services/locationService';
import { openRouteService, ORSRouteResult, ORSIsochronePolygon } from '@/services/openRouteService';
import { AnimatedCallerPingIcon } from './AnimatedCallerPingIcon';
import { DepartmentInfo } from '@/types/incident';

interface LiveMapViewProps {
  callerLat?: number;
  callerLng?: number;
  callerAddress?: string;
  responderLat?: number;
  responderLng?: number;
  responderAddress?: string;
  departmentName?: string;
  etaMinutes?: number;
  distanceKm?: number;
  role?: 'CALLER' | 'RESPONDER';
  mapHeight?: DimensionValue;
  nearbyDepartments?: DepartmentInfo[];
  isPingingRadar?: boolean;
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({
  callerLat = 14.5518,
  callerLng = 121.0478,
  callerAddress = 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila',
  responderLat = 14.5540,
  responderLng = 121.0475,
  responderAddress = 'St. Luke\'s Emergency & Trauma EMS Bay, 32nd St, BGC, Taguig',
  departmentName = 'St. Luke\'s Medical Center Global City EMS',
  etaMinutes: initialEta = 1,
  distanceKm: initialDistance = 0.3,
  role = 'CALLER',
  mapHeight,
  nearbyDepartments,
  isPingingRadar = false,
}) => {
  const [resolvedCallerAddress, setResolvedCallerAddress] = useState<string>(callerAddress);
  const [resolvedRespAddress, setResolvedRespAddress] = useState<string>(responderAddress);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // OpenRouteService Route & Isochrone State
  const [routeResult, setRouteResult] = useState<ORSRouteResult | null>(null);
  const [isochrones, setIsochrones] = useState<ORSIsochronePolygon[]>([]);
  const [showIsochrones, setShowIsochrones] = useState<boolean>(true);
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(true);

  // Origin & Destination assignment based on user role
  const originLat = role === 'CALLER' ? callerLat : responderLat;
  const originLng = role === 'CALLER' ? callerLng : responderLng;
  const destLat = role === 'CALLER' ? responderLat : callerLat;
  const destLng = role === 'CALLER' ? responderLng : callerLng;

  const fetchGeocodedAddresses = async () => {
    setIsRefreshing(true);
    try {
      const cAddr = await locationService.reverseGeocode(callerLat, callerLng);
      if (cAddr) setResolvedCallerAddress(cAddr);

      const rAddr = await locationService.reverseGeocode(responderLat, responderLng);
      if (rAddr) setResolvedRespAddress(rAddr);
    } catch (e) {
      console.warn('Geocoding error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchRoutingData = async () => {
    setIsLoadingRoute(true);
    try {
      // 1. Calculate Route Coordinates and ETA via OpenRouteService
      const route = await openRouteService.getRoute(originLat, originLng, destLat, destLng);
      setRouteResult(route);

      // 2. Calculate Emergency Isochrone Reachability Zones around the responder unit
      const iso = await openRouteService.getIsochrones(responderLat, responderLng);
      setIsochrones(iso);
    } catch (err) {
      console.warn('[OpenRouteService] Fetch routing data notice:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  useEffect(() => {
    fetchGeocodedAddresses();
    fetchRoutingData();
  }, [callerLat, callerLng, responderLat, responderLng]);

  const activeDistance = routeResult ? routeResult.distanceKm : initialDistance;
  const activeEta = routeResult ? routeResult.etaMinutes : initialEta;

  // Build the self-contained Leaflet + OpenStreetMap HTML page
  const leafletSrcDoc = useMemo(() => {
    const routeCoordsJson = JSON.stringify(routeResult?.coordinates || [[callerLat, callerLng], [responderLat, responderLng]]);
    const isochronesJson = JSON.stringify(showIsochrones ? isochrones : []);
    const nearbyDeptsJson = JSON.stringify(nearbyDepartments || []);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>UGNAY Leaflet & OpenStreetMap Emergency Tracking</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map {
      margin: 0; padding: 0; width: 100%; height: 100%; background: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-container { background: #09090b; }
    /* Animated Caller Ping Marker with Multi-Ring Radar Scanning */
    .caller-ping-wrap {
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .caller-ping-dot {
      width: 16px; height: 16px; border-radius: 50%; background: #38bdf8;
      border: 2px solid #ffffff; box-shadow: 0 0 10px #38bdf8;
      position: relative; z-index: 2;
    }
    .caller-ping-wave {
      position: absolute; width: 34px; height: 34px; border-radius: 50%;
      border: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.25);
      animation: ping-wave 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite;
    }
    .radar-pulse-ring-1 {
      position: absolute; width: 68px; height: 68px; border-radius: 50%;
      border: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.15);
      animation: ping-wave 2.4s infinite ease-out;
    }
    .radar-pulse-ring-2 {
      position: absolute; width: 110px; height: 110px; border-radius: 50%;
      border: 1.5px dashed rgba(56, 189, 248, 0.45);
      animation: ping-wave 3.2s infinite ease-out 0.8s;
    }
    @keyframes ping-wave {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    /* Responder Marker */
    .responder-wrap {
      display: flex; align-items: center; justify-content: center;
    }
    .responder-badge {
      width: 24px; height: 24px; border-radius: 50%; background: #10b981;
      border: 2px solid #ffffff; box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
      display: flex; align-items: center; justify-content: center; color: #fff;
      font-size: 11px; font-weight: 900;
    }
    /* Dark Theme Popups */
    .leaflet-popup-content-wrapper {
      background: #18181b !important; color: #ffffff !important;
      border: 1px solid #27272a !important; border-radius: 12px !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6) !important; padding: 4px 6px !important;
    }
    .leaflet-popup-content {
      margin: 8px 10px !important; font-size: 11px !important; font-weight: 700 !important; line-height: 1.4 !important;
    }
    .leaflet-popup-tip {
      background: #18181b !important; border: 1px solid #27272a !important;
    }
    /* High Performance Dark Theme for OpenStreetMap Tiles (100% Free, Zero API Key Required) */
    .leaflet-tile {
      filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(108%) !important;
    }
    .leaflet-control-attribution {
      background: rgba(9, 9, 11, 0.75) !important; color: #71717a !important;
      font-size: 8px !important; border-radius: 6px !important; margin: 4px !important;
    }
    .leaflet-control-attribution a { color: #38bdf8 !important; text-decoration: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true
    }).setView([${(callerLat + responderLat) / 2}, ${(callerLng + responderLng) / 2}], 14);

    // 100% Free OpenStreetMap Standard Tiles - No API key required, zero watermarks!
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://openrouteservice.org" target="_blank">OpenRouteService</a>'
    }).addTo(map);

    var bounds = L.latLngBounds();

    // 1. Draw Emergency Isochrone Reachability Zones (3m, 5m, 10m)
    var isochronesData = ${isochronesJson};
    if (isochronesData && isochronesData.length > 0) {
      isochronesData.forEach(function(iso) {
        if (iso.coordinates && iso.coordinates.length > 0) {
          var poly = L.polygon(iso.coordinates, {
            color: iso.color,
            weight: 1.5,
            opacity: 0.8,
            fillColor: iso.fillColor,
            fillOpacity: 0.18,
            dashArray: '4, 4'
          }).addTo(map);
          poly.bindTooltip(iso.label || (iso.intervalMinutes + ' mins Reachability Zone'), {
            sticky: true,
            className: 'leaflet-popup-content-wrapper'
          });
          poly.getLatLngs()[0].forEach(function(ll) { bounds.extend(ll); });
        }
      });
    }

    // 2. Draw OpenRouteService / OSRM Polyline Road Trajectory
    var routePoints = ${routeCoordsJson};
    if (${showRoute ? 'true' : 'false'} && routePoints && routePoints.length > 0) {
      // Outer glow line
      L.polyline(routePoints, {
        color: '#0284c7',
        weight: 6,
        opacity: 0.4
      }).addTo(map);

      // Core emergency route line
      var mainRoute = L.polyline(routePoints, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      mainRoute.bindPopup('<b style="color:#38bdf8;">UGNAY Emergency Route</b><br>${activeDistance} km • ~${activeEta} mins via OpenRouteService');
      routePoints.forEach(function(pt) { bounds.extend(pt); });
    }

    // 3. Caller Marker (Pulsing Radar Icon with Expanding Scan Rings)
    var callerIcon = L.divIcon({
      className: '',
      html: '<div class="caller-ping-wrap"><div class="radar-pulse-ring-2"></div><div class="radar-pulse-ring-1"></div><div class="caller-ping-wave"></div><div class="caller-ping-dot"></div></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    var callerMarker = L.marker([${callerLat}, ${callerLng}], { icon: callerIcon }).addTo(map);
    callerMarker.bindPopup('<b style="color:#38bdf8;">YOUR GPS LOCATION (RADAR ACTIVE)</b><br>${resolvedCallerAddress.replace(/'/g, "\\'")}');
    bounds.extend([${callerLat}, ${callerLng}]);

    ${isPingingRadar ? `
    // Add active radar scanning circle covering BGC radius
    var radarCircle = L.circle([${callerLat}, ${callerLng}], {
      color: '#38bdf8',
      fillColor: '#0284c7',
      fillOpacity: 0.12,
      radius: 1200,
      dashArray: '6, 8',
      weight: 2
    }).addTo(map);
    bounds.extend(radarCircle.getBounds());
    ` : ''}

    // 4. Assigned Responder Unit Marker
    var responderIcon = L.divIcon({
      className: '',
      html: '<div class="responder-wrap"><div class="responder-badge">🚑</div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    var respMarker = L.marker([${responderLat}, ${responderLng}], { icon: responderIcon }).addTo(map);
    respMarker.bindPopup('<b style="color:#10b981;">ASSIGNED DISPATCH UNIT</b><br>${departmentName.replace(/'/g, "\\'")}<br><small style="color:#a1a1aa;">${resolvedRespAddress.replace(/'/g, "\\'")}</small>');
    bounds.extend([${responderLat}, ${responderLng}]);

    // 5. Scanned Nearby Departments (Available vs Occupied)
    var nearbyDepts = ${nearbyDeptsJson};
    if (nearbyDepts && nearbyDepts.length > 0) {
      nearbyDepts.forEach(function(d) {
        // Skip duplicate of primary responder
        if (Math.abs(d.latitude - ${responderLat}) < 0.0001 && Math.abs(d.longitude - ${responderLng}) < 0.0001) return;

        var isAvail = d.status === 'AVAILABLE';
        var badgeBg = isAvail ? '#10b981' : '#f43f5e';
        var iconChar = d.category === 'FIRE' ? '🚒' : (d.category === 'SECURITY' ? '🚓' : (d.category === 'FLOOD' ? '🚤' : '🚑'));

        var deptIcon = L.divIcon({
          className: '',
          html: '<div style="display:flex;align-items:center;justify-content:center;cursor:pointer;"><div style="width:26px;height:26px;border-radius:50%;background:' + badgeBg + ';border:2px solid #ffffff;box-shadow:0 0 10px ' + badgeBg + ';display:flex;align-items:center;justify-content:center;font-size:12px;">' + iconChar + '</div></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        var marker = L.marker([d.latitude, d.longitude], { icon: deptIcon }).addTo(map);
        var statusBadge = isAvail 
          ? '<span style="color:#10b981;font-weight:900;">[AVAILABLE]</span>' 
          : '<span style="color:#f43f5e;font-weight:900;">[' + (d.status || 'OCCUPIED') + ']</span>';
        var statusNote = d.status_reason ? '<br><small style="color:#a1a1aa;line-height:1.2;">' + d.status_reason.replace(/'/g, "\\'") + '</small>' : '';
        marker.bindPopup('<b style="color:#ffffff;">' + d.name.replace(/'/g, "\\'") + '</b> ' + statusBadge + '<br><small style="color:#71717a;">' + d.address.replace(/'/g, "\\'") + '</small><br><b style="color:#38bdf8;">' + d.distance_km + ' km • ~' + d.eta_minutes + 'm ETA</b>' + statusNote);
        bounds.extend([d.latitude, d.longitude]);
      });
    }

    // Fit map bounds smoothly with padding
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    }
  </script>
</body>
</html>`;
  }, [
    callerLat,
    callerLng,
    responderLat,
    responderLng,
    resolvedCallerAddress,
    resolvedRespAddress,
    departmentName,
    routeResult,
    isochrones,
    showIsochrones,
    showRoute,
    activeDistance,
    activeEta,
    nearbyDepartments,
    isPingingRadar,
  ]);

  const { width: windowWidth } = useWindowDimensions();
  const isSmall = windowWidth < 360;
  const responsiveMapHeight = mapHeight || (isSmall ? 190 : 220);

  return (
    <View style={styles.container}>
      {/* Geocoded Address Card Banner */}
      <View style={[styles.addressCard, { padding: isSmall ? 10 : 12 }]}>
        {role === 'CALLER' ? (
          <>
            <View style={styles.addressRow}>
              <AnimatedCallerPingIcon size={16} color="#38BDF8" />
              <View style={styles.addressTextColumn}>
                <Text style={styles.addressLabelText}>STARTING POINT • MY CALLER LOCATION</Text>
                <Text style={styles.addressFullText} numberOfLines={2}>
                  {resolvedCallerAddress}
                </Text>
                <Text style={styles.coordsText}>
                  {callerLat.toFixed(4)}° N, {callerLng.toFixed(4)}° E (GPS Scene)
                </Text>
              </View>
              <Pressable onPress={fetchGeocodedAddresses} style={styles.refreshBtn}>
                <RefreshCw size={14} color="#71717A" />
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.addressRow}>
              <View style={[styles.addressIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Navigation size={16} color="#10B981" />
              </View>
              <View style={styles.addressTextColumn}>
                <Text style={[styles.addressLabelText, { color: '#10B981' }]}>
                  DESTINATION • {departmentName.toUpperCase()}
                </Text>
                <Text style={styles.addressFullText} numberOfLines={1}>
                  {resolvedRespAddress}
                </Text>
                <Text style={styles.coordsText}>
                  {responderLat.toFixed(4)}° N, {responderLng.toFixed(4)}° E • ETA {activeEta}m ({activeDistance} km away)
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.addressRow}>
              <View style={[styles.addressIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Navigation size={16} color="#10B981" />
              </View>
              <View style={styles.addressTextColumn}>
                <Text style={[styles.addressLabelText, { color: '#10B981' }]}>
                  STARTING POINT • MY DISPATCH UNIT LOCATION
                </Text>
                <Text style={styles.addressFullText} numberOfLines={1}>
                  {resolvedRespAddress}
                </Text>
                <Text style={styles.coordsText}>
                  {responderLat.toFixed(4)}° N, {responderLng.toFixed(4)}° E • {departmentName}
                </Text>
              </View>
              <Pressable onPress={fetchGeocodedAddresses} style={styles.refreshBtn}>
                <RefreshCw size={14} color="#71717A" />
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.addressRow}>
              <AnimatedCallerPingIcon size={16} color="#38BDF8" />
              <View style={styles.addressTextColumn}>
                <Text style={styles.addressLabelText}>DESTINATION • CALLER EMERGENCY SCENE</Text>
                <Text style={styles.addressFullText} numberOfLines={2}>
                  {resolvedCallerAddress}
                </Text>
                <Text style={styles.coordsText}>
                  {callerLat.toFixed(4)}° N, {callerLng.toFixed(4)}° E • ETA {activeEta}m ({activeDistance} km away)
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Interactive OpenRouteService & Leaflet Controls Bar */}
      <View style={styles.controlsBar}>
        <Pressable
          onPress={() => setShowIsochrones(!showIsochrones)}
          style={[
            styles.controlPill,
            showIsochrones && styles.controlPillActive,
            { paddingHorizontal: isSmall ? 7 : 10, paddingVertical: isSmall ? 5 : 6 },
          ]}
        >
          <Layers size={isSmall ? 11 : 13} color={showIsochrones ? '#10B981' : '#94A3B8'} />
          <Text
            style={[
              styles.controlPillText,
              showIsochrones && styles.controlPillTextActive,
              { fontSize: isSmall ? 9 : 10 },
            ]}
          >
            {showIsochrones ? (isSmall ? 'ISOCHRONES: ON' : 'ISOCHRONES: 3M/5M/10M ON') : 'ISOCHRONES: OFF'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowRoute(!showRoute)}
          style={[
            styles.controlPill,
            showRoute && styles.controlPillActiveBlue,
            { paddingHorizontal: isSmall ? 7 : 10, paddingVertical: isSmall ? 5 : 6 },
          ]}
        >
          <Route size={isSmall ? 11 : 13} color={showRoute ? '#38BDF8' : '#94A3B8'} />
          <Text
            style={[
              styles.controlPillText,
              showRoute && styles.controlPillTextActiveBlue,
              { fontSize: isSmall ? 9 : 10 },
            ]}
          >
            {showRoute ? (isSmall ? 'ROUTE: ON' : 'ROUTE: ACTIVE') : (isSmall ? 'ROUTE: OFF' : 'ROUTE: HIDDEN')}
          </Text>
        </Pressable>

        <Pressable onPress={fetchRoutingData} style={[styles.iconButton, { padding: isSmall ? 6 : 8 }]}>
          {isLoadingRoute ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <RefreshCw size={isSmall ? 11 : 13} color="#94A3B8" />
          )}
        </Pressable>
      </View>

      {/* Lightweight Leaflet + OpenStreetMap Map Container */}
      <View style={[styles.mapFrame, { height: responsiveMapHeight }]}>
        <iframe
          title="UGNAY OpenRouteService & Leaflet Map"
          width="100%"
          height="100%"
          style={{ border: 0, borderRadius: 16 }}
          loading="lazy"
          srcDoc={leafletSrcDoc}
        />

        {/* Floating Top Route Info Badge with Live Caller Ping Pill */}
        <View style={styles.topBadgeOverlay}>
          <View style={[styles.callerPingBadge, { maxWidth: isSmall ? '58%' : '65%' }]}>
            <AnimatedCallerPingIcon size={13} color="#38BDF8" pingColor="rgba(56, 189, 248, 0.8)" />
            <Text style={[styles.callerPingBadgeText, { fontSize: isSmall ? 8 : 9 }]} numberOfLines={1}>
              {isPingingRadar ? 'RADAR ACTIVE • SCANNING' : `ORS • ${resolvedCallerAddress.split(',')[0]}`}
            </Text>
          </View>
          <View style={styles.etaPill}>
            <Route size={11} color="#10B981" />
            <Text style={[styles.etaPillText, { fontSize: isSmall ? 8 : 9 }]} numberOfLines={1}>
              {activeDistance} km • {activeEta}m ETA
            </Text>
          </View>
        </View>

        {/* Floating Bottom Status Pill */}
        <View style={styles.bottomPillOverlay}>
          <View style={styles.techBadge}>
            <Sparkles size={10} color="#38BDF8" />
            <Text style={styles.techBadgeText}>
              {isSmall ? 'LEAFLET OSM' : 'OPENROUTESERVICE & LEAFLET OSM'}
            </Text>
          </View>
          {showIsochrones && (
            <View style={styles.isochroneLegendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>3m</Text>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>5m</Text>
              <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.legendText}>10m</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 10,
  },
  addressCard: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextColumn: {
    flex: 1,
    gap: 1,
  },
  addressLabelText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  addressFullText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 16,
  },
  coordsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#09090B',
  },
  divider: {
    height: 1,
    backgroundColor: '#27272A',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 1,
  },
  controlPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  controlPillActiveBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  controlPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  controlPillTextActive: {
    color: '#10B981',
  },
  controlPillTextActiveBlue: {
    color: '#38BDF8',
  },
  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFrame: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    position: 'relative',
  },
  topBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    pointerEvents: 'none',
  },
  callerPingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#38BDF8',
    maxWidth: '65%',
    flexShrink: 1,
  },
  callerPingBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  etaPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
  },
  bottomPillOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  techBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(9, 9, 11, 0.88)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  techBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.4,
  },
  isochroneLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(9, 9, 11, 0.88)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#E4E4E7',
    marginRight: 2,
  },
});
