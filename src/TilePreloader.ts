// src/TilePreloader.ts
import { TileCache } from './TileCache';
import { latLonToTile } from './utils';

export interface TilePreloadOptions {
  /** Rayon de préchargement en nombre de tuiles */
  radius?: number;
  /** Niveaux de zoom à précharger */
  zoomLevels?: number[];
  /** Délai entre les préchargements (ms) */
  delay?: number;
  /** Nombre maximum de téléchargements simultanés */
  maxConcurrent?: number;
  /** Template d'URL de tuile */
  tileUrlTemplate?: string;
}

export interface PreloadProgress {
  /** Nombre total de tuiles à précharger */
  total: number;
  /** Nombre de tuiles déjà préchargées */
  loaded: number;
  /** Nombre de tuiles en erreur */
  errors: number;
  /** Pourcentage de progression */
  progress: number;
}

export interface PreloadQueueItem {
  x: number;
  y: number;
  z: number;
  url: string;
}

export class TilePreloader {
  private cache: TileCache;
  private downloadQueue: PreloadQueueItem[] = [];
  private currentDownloads: Set<string> = new Set();
  private maxConcurrentDownloads: number = 4;
  private downloadDelay: number = 50;
  private isPreloading: boolean = false;
  private preloadAbortController?: AbortController;
  private defaultTileUrlTemplate: string = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  constructor(cache: TileCache, defaultTileUrlTemplate?: string) {
    this.cache = cache;
    if (defaultTileUrlTemplate) {
      this.defaultTileUrlTemplate = defaultTileUrlTemplate;
    }
  }

  /**
   * Précharge les tuiles pour une région donnée
   */
  async preloadTilesForRegion(
    latitude: number,
    longitude: number,
    zoom: number,
    options: TilePreloadOptions = {}
  ): Promise<PreloadProgress> {
    const {
      radius = 2,
      zoomLevels = [zoom],
      delay = this.downloadDelay,
      maxConcurrent = this.maxConcurrentDownloads,
      tileUrlTemplate = this.defaultTileUrlTemplate,
    } = options;

    // Annuler le préchargement précédent
    this.cancelPreloading();

    this.downloadDelay = delay;
    this.maxConcurrentDownloads = maxConcurrent;
    this.isPreloading = true;
    this.preloadAbortController = new AbortController();

    const tilesToPreload = this.calculateTilesToPreload(
      latitude,
      longitude,
      zoomLevels,
      radius,
      tileUrlTemplate
    );

    const progress: PreloadProgress = {
      total: tilesToPreload.length,
      loaded: 0,
      errors: 0,
      progress: 0,
    };

    // Filtrer les tuiles déjà en cache
    const tilesToDownload = tilesToPreload.filter((tile) => {
      return !this.cache.has(tile.x, tile.y, tile.z);
    });

    progress.total = tilesToDownload.length;

    if (tilesToDownload.length === 0) {
      progress.progress = 100;
      this.isPreloading = false;
      return progress;
    }

    // Remplir la queue de téléchargement
    this.downloadQueue = [...tilesToDownload];

    // Démarrer le téléchargement des tuiles
    const downloadPromises: Promise<void>[] = [];
    
    for (let i = 0; i < Math.min(this.maxConcurrentDownloads, tilesToDownload.length); i++) {
      downloadPromises.push(this.processDownloadQueue(progress));
    }

    try {
      await Promise.all(downloadPromises);
    } catch (error) {
      console.warn('Erreur lors du préchargement des tuiles:', error);
    } finally {
      this.isPreloading = false;
      this.downloadQueue = [];
      this.currentDownloads.clear();
    }

    progress.progress = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 100;
    return progress;
  }

  /**
   * Précharge les tuiles autour d'un centre donné
   */
  async preloadTilesAroundCenter(
    centerLat: number,
    centerLon: number,
    zoom: number,
    radius: number = 2,
    tileUrlTemplate: string = this.defaultTileUrlTemplate
  ): Promise<void> {
    const tilesToPreload: PreloadQueueItem[] = [];
    const centerTile = latLonToTile(centerLat, centerLon, zoom);

    // Générer les tuiles dans le rayon spécifié
    for (let x = centerTile.x - radius; x <= centerTile.x + radius; x++) {
      for (let y = centerTile.y - radius; y <= centerTile.y + radius; y++) {
        if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
          const tileUrl = this.buildTileUrl(tileUrlTemplate, x, y, zoom);
          tilesToPreload.push({ x, y, z: zoom, url: tileUrl });
        }
      }
    }

    // Précharger les tuiles en parallèle avec limitation
    const promises: Promise<void>[] = [];
    const semaphore = this.createSemaphore(this.maxConcurrentDownloads);

    for (const tile of tilesToPreload) {
      if (!this.cache.has(tile.x, tile.y, tile.z)) {
        promises.push(
          semaphore.acquire().then(async (release) => {
            try {
              await this.downloadAndCacheTile(tile);
            } finally {
              release();
            }
          })
        );
      }
    }

    await Promise.all(promises);
  }


  /**
   * Précharge les tuiles le long d'un itinéraire
   */
  async preloadTilesForRoute(
    coordinates: [number, number][],
    zoom: number,
    corridor: number = 1000, // corridor en mètres
    tileUrlTemplate: string = this.defaultTileUrlTemplate
  ): Promise<void> {
    const tilesToPreloadMap = new Map<string, PreloadQueueItem>();

    // Pour chaque segment de l'itinéraire
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];

      // Calculer les points le long du segment (les coordonnées sont [lon, lat])
      const distance = this.calculateDistance(start, end);
      const steps = Math.max(1, Math.ceil(distance * 10)); // d est en km, donc un point environ tous les 100m

      for (let step = 0; step <= steps; step++) {
        const ratio = step / steps;
        const lat = start[1] + (end[1] - start[1]) * ratio;
        const lon = start[0] + (end[0] - start[0]) * ratio;

        // Calculer le rayon en tuiles basé sur le corridor
        const metersPerTile = (40075017 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
        const radiusInTiles = Math.ceil(corridor / metersPerTile);

        // Ajouter les tuiles dans le corridor
        const centerTile = latLonToTile(lat, lon, zoom);
        for (let x = centerTile.x - radiusInTiles; x <= centerTile.x + radiusInTiles; x++) {
          for (let y = centerTile.y - radiusInTiles; y <= centerTile.y + radiusInTiles; y++) {
            if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
              const tileUrl = this.buildTileUrl(tileUrlTemplate, x, y, zoom);
              const key = `${zoom}-${x}-${y}`;
              tilesToPreloadMap.set(key, { x, y, z: zoom, url: tileUrl });
            }
          }
        }
      }
    }

    // Précharger toutes les tuiles collectées
    const promises = Array.from(tilesToPreloadMap.values())
      .filter(tile => !this.cache.has(tile.x, tile.y, tile.z))
      .map(tile => this.downloadAndCacheTile(tile).catch(err => {
        console.warn(`Erreur de préchargement de tuile itinéraire:`, err);
      }));

    await Promise.all(promises);
  }

  /**
   * Annule le préchargement en cours
   */
  cancelPreloading(): void {
    if (this.preloadAbortController) {
      this.preloadAbortController.abort();
    }
    this.isPreloading = false;
    this.downloadQueue = [];
    this.currentDownloads.clear();
  }

  /**
   * Vérifie si le préchargement est en cours
   */
  isCurrentlyPreloading(): boolean {
    return this.isPreloading;
  }

  /**
   * Obtient le nombre de tuiles en queue de téléchargement
   */
  getQueueSize(): number {
    return this.downloadQueue.length;
  }

  // Méthodes privées

  private calculateTilesToPreload(
    latitude: number,
    longitude: number,
    zoomLevels: number[],
    radius: number,
    tileUrlTemplate: string
  ): PreloadQueueItem[] {
    const tiles: PreloadQueueItem[] = [];

    zoomLevels.forEach((zoom) => {
      const centerTile = latLonToTile(latitude, longitude, zoom);
      
      for (let x = centerTile.x - radius; x <= centerTile.x + radius; x++) {
        for (let y = centerTile.y - radius; y <= centerTile.y + radius; y++) {
          if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
            const tileUrl = this.buildTileUrl(tileUrlTemplate, x, y, zoom);
            tiles.push({ x, y, z: zoom, url: tileUrl });
          }
        }
      }
    });

    return tiles;
  }

  private async processDownloadQueue(progress: PreloadProgress): Promise<void> {
    while (this.downloadQueue.length > 0 && this.isPreloading) {
      const tile = this.downloadQueue.shift();
      if (!tile) break;

      if (this.currentDownloads.has(tile.url)) {
        continue;
      }

      this.currentDownloads.add(tile.url);

      try {
        await this.downloadAndCacheTile(tile);
        progress.loaded++;
      } catch (error) {
        progress.errors++;
        console.warn(`Erreur de téléchargement pour la tuile ${tile.url}:`, error);
      } finally {
        this.currentDownloads.delete(tile.url);
      }

      // Mettre à jour la progression globale
      progress.progress = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 100;

      // Délai entre les téléchargements
      if (this.downloadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.downloadDelay));
      }

      // Vérifier si le préchargement a été annulé
      if (this.preloadAbortController?.signal.aborted) {
        break;
      }
    }
  }

  private async downloadAndCacheTile(tile: PreloadQueueItem): Promise<void> {
    try {
      const response = await fetch(tile.url, {
        signal: this.preloadAbortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const tileData = await response.text();
      
      // Stocker dans le cache
      await this.cache.set({ x: tile.x, y: tile.y, z: tile.z, url: tile.url }, tileData);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Opération annulée
      }
      throw error;
    }
  }

  private buildTileUrl(template: string, x: number, y: number, z: number): string {
    return template
      .replace('{x}', x.toString())
      .replace('{y}', y.toString())
      .replace('{z}', z.toString())
      .replace('{s}', ['a', 'b', 'c'][Math.floor(Math.random() * 3)]);
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371; // Rayon de la Terre en km (geoUtils utilise km)
    const lat1Rad = (coord1[1] * Math.PI) / 180;
    const lat2Rad = (coord2[1] * Math.PI) / 180;
    const deltaLatRad = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const deltaLonRad = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private createSemaphore(maxConcurrent: number) {
    let current = 0;
    const queue: Array<() => void> = [];

    return {
      acquire: (): Promise<() => void> => {
        return new Promise((resolve) => {
          const tryAcquire = () => {
            if (current < maxConcurrent) {
              current++;
              resolve(() => {
                current--;
                if (queue.length > 0) {
                  const next = queue.shift();
                  next?.();
                }
              });
            } else {
              queue.push(tryAcquire);
            }
          };
          tryAcquire();
        });
      },
    };
  }
}
