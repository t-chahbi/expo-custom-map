// src/hooks/useOfflineMap.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { TileCache } from '../TileCache';
import { TilePreloader } from '../TilePreloader';
import { OfflineRegion } from '../types';

let AsyncStorage: any;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  AsyncStorage = undefined;
}

const REGIONS_STORAGE_KEY = '@expo-custom-map/offline-regions';

// Lazy initialize cache globale persistante
let sharedCache: TileCache | null = null;
let sharedPreloader: TilePreloader | null = null;

const getSharedInstances = () => {
  if (!sharedCache) {
    sharedCache = new TileCache(200, 30 * 24 * 60 * 60 * 1000, true); // 200MB, 30 jours
    sharedPreloader = new TilePreloader(sharedCache);
  }
  return { cache: sharedCache!, preloader: sharedPreloader! };
};

export const useOfflineMap = () => {
  const [downloadedRegions, setDownloadedRegions] = useState<OfflineRegion[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeRegionIdRef = useRef<string | null>(null);

  const { cache, preloader } = getSharedInstances();

  // Charger les régions enregistrées
  const loadRegions = useCallback(async () => {
    if (!AsyncStorage) return;
    try {
      const stored = await AsyncStorage.getItem(REGIONS_STORAGE_KEY);
      if (stored) {
        setDownloadedRegions(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erreur lors du chargement des régions hors ligne:', e);
    }
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const saveRegions = useCallback(async (regions: OfflineRegion[]) => {
    if (!AsyncStorage) return;
    try {
      await AsyncStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(regions));
      setDownloadedRegions(regions);
    } catch (e) {
      console.warn('Erreur lors de la sauvegarde des régions hors ligne:', e);
    }
  }, []);

  const downloadRegion = useCallback(async (
    region: Omit<OfflineRegion, 'downloadProgress' | 'isComplete'> & { tileUrlTemplate?: string }
  ) => {
    if (isDownloading) {
      throw new Error('Un téléchargement est déjà en cours');
    }

    setIsDownloading(true);
    setProgress(0);
    activeRegionIdRef.current = region.id;

    // Ajouter ou mettre à jour la région dans la liste
    const newRegion: OfflineRegion = {
      ...region,
      downloadProgress: 0,
      isComplete: false,
    };
    
    let currentRegions = [...downloadedRegions];
    const index = currentRegions.findIndex(r => r.id === region.id);
    if (index >= 0) {
      currentRegions[index] = newRegion;
    } else {
      currentRegions.push(newRegion);
    }
    await saveRegions(currentRegions);

    try {
      await preloader.preloadTilesForBounds(
        region.bounds,
        region.minZoom,
        region.maxZoom,
        {
          tileUrlTemplate: region.tileUrlTemplate,
          onProgress: (p) => {
            setProgress(p.progress);
            // Mettre à jour l'état local pour le retour UI en temps réel
            setDownloadedRegions(prev => 
              prev.map(r => r.id === region.id ? { ...r, downloadProgress: p.progress } : r)
            );
          }
        }
      );

      // Téléchargement complété avec succès
      const finalRegions = currentRegions.map(r => 
        r.id === region.id ? { ...r, downloadProgress: 100, isComplete: true } : r
      );
      await saveRegions(finalRegions);
    } catch (error) {
      console.warn(`Téléchargement de la région ${region.name} échoué:`, error);
      const finalRegions = currentRegions.map(r => 
        r.id === region.id ? { ...r, downloadProgress: 0, isComplete: false } : r
      );
      await saveRegions(finalRegions);
      throw error;
    } finally {
      setIsDownloading(false);
      activeRegionIdRef.current = null;
    }
  }, [downloadedRegions, isDownloading, preloader, saveRegions]);

  const cancelDownload = useCallback(() => {
    if (!isDownloading) return;
    
    preloader.cancelPreloading();
    setIsDownloading(false);
    
    if (activeRegionIdRef.current) {
      const regionId = activeRegionIdRef.current;
      setDownloadedRegions(prev => 
        prev.map(r => r.id === regionId ? { ...r, downloadProgress: 0, isComplete: false } : r)
      );
      activeRegionIdRef.current = null;
    }
  }, [isDownloading, preloader]);

  const deleteRegion = useCallback(async (id: string) => {
    const filtered = downloadedRegions.filter(r => r.id !== id);
    await saveRegions(filtered);
  }, [downloadedRegions, saveRegions]);

  return {
    downloadRegion,
    isDownloading,
    progress,
    cancelDownload,
    downloadedRegions,
    deleteRegion,
    cache,
  };
};
