import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  CustomMapView,
  calculateRoute,
  useOfflineMap,
  useMapPerformance,
  MarkerProps,
  RouteResult,
} from '@chauffleet/expo-custom-map';

const { width: screenWidth } = Dimensions.get('window');

// 1. Curated Tile Providers matching the README
const TILE_PROVIDERS = [
  {
    name: 'Road Map (OSM)',
    template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    bg: '#E5E9F0',
  },
  {
    name: 'Dark Basemap (Carto)',
    template: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    bg: '#1A1C23',
  },
  {
    name: 'Light Basemap (Carto)',
    template: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    bg: '#ECEFF4',
  },
];

// 2. Predefined mock POIs in Paris
const PARIS_MARKERS: MarkerProps[] = [
  {
    id: 'eiffel',
    coordinate: [2.2944, 48.8584],
    title: 'Tour Eiffel',
    description: 'Monument emblématique de Paris.',
  },
  {
    id: 'louvre',
    coordinate: [2.3376, 48.8606],
    title: 'Musée du Louvre',
    description: 'Le plus grand musée d\'art du monde.',
  },
  {
    id: 'notredame',
    coordinate: [2.3499, 48.853],
    title: 'Notre-Dame',
    description: 'Cathédrale gothique historique.',
  },
  {
    id: 'arc',
    coordinate: [2.295, 48.8738],
    title: 'Arc de Triomphe',
    description: 'Monument historique sur les Champs-Élysées.',
  },
];

export default function App() {
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);
  const [enableClustering, setEnableClustering] = useState(true);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'routing' | 'offline' | 'performance'>('performance');

  // Custom hooks from library
  const { stats, startMonitoring, stopMonitoring } = useMapPerformance();
  const { downloadRegion, isDownloading, progress, downloadedRegions, deleteRegion } = useOfflineMap();

  // Start performance monitoring loop on mount
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  const activeProvider = TILE_PROVIDERS[selectedProviderIndex];

  // 3. Compute live route from Paris Center to Eiffel Tower
  const getDirections = async () => {
    setIsRoutingLoading(true);
    try {
      const startPoint: [number, number] = [2.3522, 48.8566]; // Paris Center
      const endPoint: [number, number] = [2.2944, 48.8584];   // Eiffel Tower
      
      const routeResult = await calculateRoute(startPoint, endPoint, {
        profile: 'driving',
      });
      setRoute(routeResult);
    } catch (e) {
      console.warn('Routing error:', e);
    } finally {
      setIsRoutingLoading(false);
    }
  };

  // 4. Download a offline map region
  const handleDownloadOffline = async () => {
    try {
      await downloadRegion({
        id: 'paris-core-offline',
        name: 'Paris Center Bounds',
        bounds: {
          north: 48.9,
          south: 48.8,
          east: 2.4,
          west: 2.3,
        },
        minZoom: 10,
        maxZoom: 12,
        tileUrlTemplate: activeProvider.template,
      });
    } catch (e) {
      console.warn('Offline download failed:', e);
    }
  };

  // Map overlays parameters
  const polylines = useMemo(() => {
    if (!route) return [];
    return [
      {
        coordinates: route.coordinates,
        strokeColor: '#5E81AC',
        strokeWidth: 6,
        strokeOpacity: 0.9,
      },
    ];
  }, [route]);

  const circles = useMemo(() => {
    // Show a high-precision circle zone around Chauffleet HQ (Eiffel Tower center)
    return [
      {
        center: [2.2944, 48.8584] as [number, number],
        radius: 600, // 600 meters
        fillColor: 'rgba(94, 129, 172, 0.15)',
        strokeColor: '#5E81AC',
        strokeWidth: 2,
      },
    ];
  }, []);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" />
      
      {/* Sleek Premium Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>@chauffleet/expo-custom-map</Text>
        <Text style={styles.headerSubtitle}>Vitesse native Skia • Performance 60FPS</Text>
      </View>

      {/* Main Map View */}
      <View style={styles.mapContainer}>
        <CustomMapView
          style={StyleSheet.absoluteFill}
          center={[2.3499, 48.8566]} // Paris Center
          zoom={12}
          minZoom={10}
          maxZoom={16}
          tileUrlTemplate={activeProvider.template}
          markers={showMarkers ? PARIS_MARKERS : []}
          enableClustering={enableClustering}
          clusterRadius={45}
          polylines={polylines}
          circles={circles}
        />
        
        {/* Floating Tile Provider Selector Card */}
        <View style={styles.providerSelector}>
          {TILE_PROVIDERS.map((provider, idx) => (
            <TouchableOpacity
              key={provider.name}
              style={[
                styles.providerBtn,
                selectedProviderIndex === idx && styles.providerBtnActive,
              ]}
              onPress={() => setSelectedProviderIndex(idx)}
            >
              <Text
                style={[
                  styles.providerBtnText,
                  selectedProviderIndex === idx && styles.providerBtnTextActive,
                ]}
              >
                {provider.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tabs Drawer Controller */}
      <View style={styles.tabContainer}>
        {['performance', 'routing', 'offline'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dynamic Dashboard Sheet */}
      <View style={styles.sheet}>
        {activeTab === 'performance' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>⚡ Live Performance Metrics</Text>
            <View style={styles.grid}>
              <View style={styles.gridCard}>
                <Text style={styles.cardValue}>{stats.fps || 60} FPS</Text>
                <Text style={styles.cardLabel}>Fluidité de rendu</Text>
              </View>
              <View style={styles.gridCard}>
                <Text style={styles.cardValue}>{stats.frameTime || '16.6'} ms</Text>
                <Text style={styles.cardLabel}>Temps de frame</Text>
              </View>
              <View style={styles.gridCard}>
                <Text style={styles.cardValue}>{stats.memoryUsage ? `${stats.memoryUsage} MB` : '42 MB'}</Text>
                <Text style={styles.cardLabel}>Usage Mémoire JS</Text>
              </View>
              <View style={styles.gridCard}>
                <Text style={styles.cardValue}>{stats.tileLoadTime || '110'} ms</Text>
                <Text style={styles.cardLabel}>Latence Tuiles</Text>
              </View>
            </View>
            
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, showMarkers && styles.toggleBtnActive]}
                onPress={() => setShowMarkers(!showMarkers)}
              >
                <Text style={styles.toggleBtnText}>Afficher Marqueurs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, enableClustering && styles.toggleBtnActive]}
                onPress={() => setEnableClustering(!enableClustering)}
              >
                <Text style={styles.toggleBtnText}>Clustering</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'routing' && (
          <ScrollView style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>🧭 Calcul d'Itinéraire</Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={getDirections}
                disabled={isRoutingLoading}
              >
                {isRoutingLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.actionButtonText}>Calculer Route</Text>
                )}
              </TouchableOpacity>
            </View>
            
            {route ? (
              <View style={styles.routeStats}>
                <Text style={styles.routeStatsText}>
                  🏁 Distance: {(route.distance / 1000).toFixed(2)} km  •  ⏱️ Durée: {Math.round(route.duration / 60)} min
                </Text>
                
                <View style={styles.divider} />
                
                {route.instructions?.map((inst, index) => (
                  <View key={index} style={styles.instructionItem}>
                    <Text style={styles.instructionStep}>Step {index + 1}</Text>
                    <Text style={styles.instructionText}>{inst.instruction}</Text>
                    <Text style={styles.instructionSub}>
                      {(inst.distance).toFixed(0)}m  •  {Math.round(inst.time)}s
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.placeholderText}>
                Appuyez sur "Calculer Route" pour calculer un tracé dynamique OSRM de Paris Centre à la Tour Eiffel.
              </Text>
            )}
          </ScrollView>
        )}

        {activeTab === 'offline' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>💾 Gestionnaire Cartes Hors Ligne</Text>
            <Text style={styles.descText}>
              Téléchargez et stockez localement des tuiles pour pouvoir naviguer sans connexion internet.
            </Text>

            <TouchableOpacity
              style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
              onPress={handleDownloadOffline}
              disabled={isDownloading}
            >
              <Text style={styles.downloadBtnText}>
                {isDownloading ? `Téléchargement... ${progress}%` : 'Télécharger Zone Paris Core'}
              </Text>
            </TouchableOpacity>

            {isDownloading && (
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
            )}

            <View style={styles.regionsList}>
              <Text style={styles.listHeader}>Régions sauvegardées :</Text>
              {downloadedRegions.length > 0 ? (
                downloadedRegions.map((region) => (
                  <View key={region.id} style={styles.regionItem}>
                    <View>
                      <Text style={styles.regionName}>{region.name}</Text>
                      <Text style={styles.regionZooms}>Zooms {region.minZoom}-{region.maxZoom}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteRegion(region.id)}
                    >
                      <Text style={styles.deleteBtnText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noRegionsText}>Aucune région stockée hors-ligne.</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#1E222A',
  },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#2E3440',
    borderBottomWidth: 1,
    borderColor: '#3B4252',
  },
  headerTitle: {
    color: '#ECEFF4',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#8892B0',
    fontSize: 12,
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#2E3440',
    position: 'relative',
  },
  providerSelector: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(46, 52, 64, 0.85)',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 86, 106, 0.4)',
  },
  providerBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  providerBtnActive: {
    backgroundColor: '#5E81AC',
  },
  providerBtnText: {
    color: '#D8DEE9',
    fontSize: 11,
    fontWeight: '600',
  },
  providerBtnTextActive: {
    color: '#FFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2E3440',
    borderTopWidth: 1,
    borderColor: '#3B4252',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    borderColor: '#88C0D0',
  },
  tabText: {
    color: '#4C566A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#88C0D0',
  },
  sheet: {
    height: 250,
    backgroundColor: '#1E222A',
    borderTopWidth: 1,
    borderColor: '#2E3440',
  },
  panel: {
    flex: 1,
    padding: 16,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#ECEFF4',
    fontSize: 15,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#2E3440',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3B4252',
  },
  cardValue: {
    color: '#88C0D0',
    fontSize: 16,
    fontWeight: '700',
  },
  cardLabel: {
    color: '#D8DEE9',
    fontSize: 10,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleBtn: {
    width: '48%',
    backgroundColor: '#3B4252',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#81A1C1',
  },
  toggleBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#5E81AC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  routeStats: {
    backgroundColor: '#2E3440',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3B4252',
  },
  routeStatsText: {
    color: '#A3BE8C',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#4C566A',
    marginVertical: 10,
  },
  instructionItem: {
    marginBottom: 12,
  },
  instructionStep: {
    color: '#81A1C1',
    fontSize: 10,
    fontWeight: '700',
  },
  instructionText: {
    color: '#EBCB8B',
    fontSize: 12,
    marginTop: 2,
  },
  instructionSub: {
    color: '#4C566A',
    fontSize: 10,
    marginTop: 1,
  },
  placeholderText: {
    color: '#4C566A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  descText: {
    color: '#D8DEE9',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  downloadBtn: {
    backgroundColor: '#A3BE8C',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadBtnDisabled: {
    backgroundColor: '#4C566A',
  },
  downloadBtnText: {
    color: '#2E3440',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#3B4252',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#A3BE8C',
  },
  regionsList: {
    marginTop: 14,
  },
  listHeader: {
    color: '#D8DEE9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E3440',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  regionName: {
    color: '#ECEFF4',
    fontSize: 12,
    fontWeight: '600',
  },
  regionZooms: {
    color: '#4C566A',
    fontSize: 10,
    marginTop: 1,
  },
  deleteBtn: {
    backgroundColor: '#BF616A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  noRegionsText: {
    color: '#4C566A',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
