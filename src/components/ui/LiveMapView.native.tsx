import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, DimensionValue } from 'react-native';
import { MapPin, Navigation, RefreshCw, Compass, ShieldAlert, Route } from 'lucide-react-native';
import { locationService } from '@/services/locationService';
import { openRouteService, ORSRouteResult } from '@/services/openRouteService';
import { AnimatedCallerPingIcon } from './AnimatedCallerPingIcon';

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
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({
  callerLat = 10.2994,
  callerLng = 123.8890,
  callerAddress = 'Katipunan Ave, Labangon, Cebu City, 6000 Cebu, Philippines',
  responderLat = 10.3157,
  responderLng = 123.8854,
  responderAddress = 'Cebu City DRRMO Central Command, N. Gonzales St, Cebu City',
  departmentName = 'Cebu City Emergency Response Unit',
  etaMinutes: initialEta = 3,
  distanceKm: initialDistance = 0.9,
  role = 'CALLER',
  mapHeight,
}) => {
  const [resolvedCallerAddress, setResolvedCallerAddress] = useState<string>(callerAddress);
  const [resolvedRespAddress, setResolvedRespAddress] = useState<string>(responderAddress);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [routeResult, setRouteResult] = useState<ORSRouteResult | null>(null);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBb6uLRn1eFYx8pLYhXxM5eWZeo8uZOMbY';

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

  useEffect(() => {
    fetchGeocodedAddresses();
    openRouteService.getRoute(callerLat, callerLng, responderLat, responderLng)
      .then(setRouteResult)
      .catch((e) => console.warn('ORS Native route warning:', e));
  }, [callerLat, callerLng, responderLat, responderLng]);

  const activeDistance = routeResult ? routeResult.distanceKm : initialDistance;
  const activeEta = routeResult ? routeResult.etaMinutes : initialEta;

  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=10.3075,123.8872&zoom=14&size=600x320&maptype=roadmap&markers=color:blue%7Clabel:C%7C${callerLat},${callerLng}&markers=color:green%7Clabel:R%7C${responderLat},${responderLng}&path=color:0x10b981ff%7Cweight:5%7C${responderLat},${responderLng}%7C10.3080,123.8870%7C${callerLat},${callerLng}&key=${apiKey}`;

  return (
    <View style={styles.container}>
      {/* Dynamic Geocoded Address Card Banner */}
      <View style={styles.addressCard}>
        {role === 'CALLER' ? (
          <>
            <View style={styles.addressRow}>
              <AnimatedCallerPingIcon size={16} color="#38BDF8" />
              <View style={styles.addressTextColumn}>
                <Text style={styles.addressLabelText}>CALLER DEVICE GPS LOCATION</Text>
                <Text style={styles.addressFullText} numberOfLines={2}>
                  {resolvedCallerAddress}
                </Text>
                <Text style={styles.coordsText}>
                  {callerLat.toFixed(4)}° N, {callerLng.toFixed(4)}° E (GPS ±146m)
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
                  DISPATCH UNIT • {departmentName.toUpperCase()}
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
                  DISPATCH UNIT • MY LOCATION
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
                <Text style={styles.addressLabelText}>CALLER EMERGENCY SCENE</Text>
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

      {/* Native Map Viewport */}
      <View style={[styles.mapFrame, mapHeight ? { height: mapHeight } : null]}>
        <Image
          source={{ uri: staticMapUrl }}
          style={styles.staticMapImage}
          resizeMode="cover"
        />

        <View style={styles.vectorOverlay}>
          <View style={styles.badgeRow}>
            <View style={styles.callerPingBadge}>
              <AnimatedCallerPingIcon size={14} color="#38BDF8" pingColor="rgba(56, 189, 248, 0.8)" />
              <Text style={styles.callerPingBadgeText}>
                OPENROUTESERVICE • {resolvedCallerAddress.split(',')[0]} ({callerLat.toFixed(4)}°, {callerLng.toFixed(4)}°)
              </Text>
            </View>
            <View style={styles.etaPill}>
              <Route size={12} color="#10B981" />
              <Text style={styles.etaPillText}>{activeDistance} km • {activeEta} MINS ETA</Text>
            </View>
          </View>

          {/* ACTUAL ANIMATED CALLER & RESPONDER PINS OVERLAY ON MAP */}
          <View style={styles.mapPinsOverlay} pointerEvents="none">
            {/* CALLER ANIMATED PING MARKER PIN */}
            <View style={[styles.pinnedMarkerContainer, role === 'CALLER' ? styles.callerPinPos : styles.callerDestPinPos]}>
              <View style={styles.markerTooltipCard}>
                <Text style={styles.markerTooltipTitle}>CALLER LOCATION</Text>
                <Text style={styles.markerTooltipSub} numberOfLines={1}>{resolvedCallerAddress.split(',')[0]}</Text>
              </View>
              <AnimatedCallerPingIcon size={18} color="#38BDF8" pingColor="rgba(56, 189, 248, 0.7)" />
            </View>

            {/* RESPONDER UNIT ANIMATED MARKER PIN */}
            <View style={[styles.pinnedMarkerContainer, role === 'CALLER' ? styles.responderDestPinPos : styles.responderPinPos]}>
              <View style={[styles.markerTooltipCard, { borderColor: '#10B981' }]}>
                <Text style={[styles.markerTooltipTitle, { color: '#10B981' }]}>RESPONDER UNIT</Text>
                <Text style={styles.markerTooltipSub} numberOfLines={1}>{departmentName}</Text>
              </View>
              <AnimatedCallerPingIcon size={18} color="#10B981" pingColor="rgba(16, 185, 129, 0.7)" />
            </View>
          </View>

          <View style={styles.mapBottomBar}>
            <View style={styles.bottomBarLeft}>
              <Compass size={13} color="#A1A1AA" />
              <Text style={styles.compassText}>Cebu City Operational District</Text>
            </View>
            <View style={styles.bottomBarLeft}>
              <ShieldAlert size={13} color="#F59E0B" />
              <Text style={styles.liveText}>ROUTE ACTIVE</Text>
            </View>
          </View>
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
  mapFrame: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    position: 'relative',
  },
  staticMapImage: {
    width: '100%',
    height: '100%',
  },
  vectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 9, 11, 0.3)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  callerPingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(9, 9, 11, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  callerPingBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  etaPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
  },
  mapPinsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  pinnedMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    width: 120,
    marginLeft: -60,
  },
  callerPinPos: {
    bottom: '18%',
    left: '49%',
  },
  responderDestPinPos: {
    top: '16%',
    left: '49%',
  },
  callerDestPinPos: {
    bottom: '18%',
    left: '49%',
  },
  responderPinPos: {
    top: '16%',
    left: '49%',
  },
  markerTooltipCard: {
    backgroundColor: 'rgba(9, 9, 11, 0.92)',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  markerTooltipTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  markerTooltipSub: {
    fontSize: 8,
    fontWeight: '600',
    color: '#E4E4E7',
    maxWidth: 120,
  },
  mapBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  bottomBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compassText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F59E0B',
  },
});
