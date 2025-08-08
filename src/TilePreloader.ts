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

export class TilePreloader {
  private cache: TileCache;
  private downloadQueue: Set<string> = new Set();
  private currentDownloads: Set<string> = new Set();
  private maxConcurrentDownloads: number = 4;
  private downloadDelay: number = 50;
  private isPreloading: boolean = false;
  private preloadAbortController?: AbortController;

  constructor(cache: TileCache) {
    this.cache = cache;
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
      radius
    );

    const progress: PreloadProgress = {
      total: tilesToPreload.length,
      loaded: 0,
      errors: 0,
      progress: 0,
    };

    // Filtrer les tuiles déjà en cache
    const tilesToDownload = tilesToPreload.filter((tileKey) => {
      const [z, x, y] = tileKey.replace('tile-', '').split('-').map(Number);
      return !this.cache.has(x, y, z);
    });

    progress.total = tilesToDownload.length;

    if (tilesToDownload.length === 0) {
      progress.progress = 100;
      this.isPreloading = false;
      return progress;
    }

    // Ajouter les tuiles à la queue de téléchargement
    tilesToDownload.forEach((tileUrl) => {
      this.downloadQueue.add(tileUrl);
    });

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
      this.downloadQueue.clear();
      this.currentDownloads.clear();
    }

    progress.progress = Math.round((progress.loaded / progress.total) * 100);
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
    tileUrlTemplate?: string
  ): Promise<void> {
    if (!tileUrlTemplate) {
      throw new Error('Template d\'URL de tuile requis pour le préchargement');
    }

    const tilesToPreload: string[] = [];
    const centerTile = latLonToTile(centerLat, centerLon, zoom);

    // Générer les URLs des tuiles dans le rayon spécifié
    for (let x = centerTile.x - radius; x <= centerTile.x + radius; x++) {
      for (let y = centerTile.y - radius; y <= centerTile.y + radius; y++) {
        if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
          const tileUrl = this.buildTileUrl(tileUrlTemplate, x, y, zoom);
          tilesToPreload.push(tileUrl);
        }
      }
    }

    // Précharger les tuiles en parallèle avec limitation
    const promises: Promise<void>[] = [];
    const semaphore = this.createSemaphore(this.maxConcurrentDownloads);

    for (const tileUrl of tilesToPreload) {
      const [z, x, y] = tileUrl.replace('tile-', '').split('-').map(Number);
      if (!this.cache.has(x, y, z)) {
        promises.push(
          semaphore.acquire().then(async (release) => {
            try {
              await this.downloadAndCacheTile(tileUrl);
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
    tileUrlTemplate?: string
  ): Promise<void> {
    if (!tileUrlTemplate) {
      throw new Error('Template d\'URL de tuile requis pour le préchargement');
    }

    const tilesToPreload = new Set<string>();

    // Pour chaque segment de l'itinéraire
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];

      // Calculer les points le long du segment
      const distance = this.calculateDistance(start, end);
      const steps = Math.ceil(distance / 100); // un point tous les 100 mètres

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
              tilesToPreload.add(tileUrl);
            }
          }
        }
      }
    }

    // Précharger toutes les tuiles collectées
    const promises = Array.from(tilesToPreload)
      .filter(tileUrl => {
        const [z, x, y] = tileUrl.replace('tile-', '').split('-').map(Number);
        return !this.cache.has(x, y, z);
      })
      .map(tileUrl => this.downloadAndCacheTile(tileUrl));

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
    this.downloadQueue.clear();
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
    return this.downloadQueue.size;
  }

  // Méthodes privées

  private calculateTilesToPreload(
    latitude: number,
    longitude: number,
    zoomLevels: number[],
    radius: number
  ): string[] {
    const tiles: string[] = [];

    zoomLevels.forEach((zoom) => {
      const centerTile = latLonToTile(latitude, longitude, zoom);
      
      for (let x = centerTile.x - radius; x <= centerTile.x + radius; x++) {
        for (let y = centerTile.y - radius; y <= centerTile.y + radius; y++) {
          if (x >= 0 && y >= 0 && x < Math.pow(2, zoom) && y < Math.pow(2, zoom)) {
            const tileUrl = `tile-${zoom}-${x}-${y}`;
            tiles.push(tileUrl);
          }
        }
      }
    });

    return tiles;
  }

  private async processDownloadQueue(progress: PreloadProgress): Promise<void> {
    while (this.downloadQueue.size > 0 && this.isPreloading) {
      const tileUrl = this.downloadQueue.values().next().value;
      if (!tileUrl) break;

      this.downloadQueue.delete(tileUrl);

      if (this.currentDownloads.has(tileUrl)) {
        continue;
      }

      this.currentDownloads.add(tileUrl);

      try {
        await this.downloadAndCacheTile(tileUrl);
        progress.loaded++;
      } catch (error) {
        progress.errors++;
        console.warn(`Erreur de téléchargement pour la tuile ${tileUrl}:`, error);
      } finally {
        this.currentDownloads.delete(tileUrl);
      }

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

  private async downloadAndCacheTile(tileUrl: string): Promise<void> {
    try {
      // Simuler le téléchargement d'une tuile
      // Dans une vraie implémentation, ceci ferait un fetch vers l'URL de la tuile
      const response = await fetch(tileUrl, {
        signal: this.preloadAbortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const tileData = await response.text();
      
      // Extraire les coordonnées de la tuile depuis l'URL
      const [z, x, y] = tileUrl.replace('tile-', '').split('-').map(Number);
      
      // Stocker dans le cache
      await this.cache.set({ x, y, z, url: tileUrl }, tileData);
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
    const R = 6371000; // Rayon de la Terre en mètres
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
