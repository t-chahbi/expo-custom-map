// src/types/MapTypes.ts

/**
 * Configuration spécifique pour les cartes
 */
export interface MapConfiguration {
  /** Taille par défaut des tuiles en pixels */
  tileSize: number;
  /** Niveau de zoom minimum autorisé */
  minZoom: number;
  /** Niveau de zoom maximum autorisé */
  maxZoom: number;
  /** Rayon de préchargement des tuiles en nombre de tuiles */
  preloadRadius: number;
  /** Taille maximum du cache en MB */
  maxCacheSize: number;
  /** Durée d'animation par défaut en millisecondes */
  animationDuration: number;
  /** Mode debug activé */
  debugMode: boolean;
  /** Activer le rendu haute définition */
  enableHighDPI: boolean;
}

/**
 * Viewport de la carte
 */
export interface MapViewport {
  /** Centre de la carte [longitude, latitude] */
  center: [number, number];
  /** Niveau de zoom actuel */
  zoom: number;
  /** Rotation de la carte en degrés */
  bearing: number;
  /** Inclinaison de la carte en degrés */
  pitch: number;
  /** Largeur du viewport en pixels */
  width: number;
  /** Hauteur du viewport en pixels */
  height: number;
}

/**
 * Limites géographiques
 */
export interface GeographicBounds {
  /** Limite nord (latitude maximum) */
  north: number;
  /** Limite sud (latitude minimum) */
  south: number;
  /** Limite est (longitude maximum) */
  east: number;
  /** Limite ouest (longitude minimum) */
  west: number;
}

/**
 * Tuile de carte
 */
export interface MapTile {
  /** Coordonnée X de la tuile */
  x: number;
  /** Coordonnée Y de la tuile */
  y: number;
  /** Niveau de zoom de la tuile */
  z: number;
  /** URL de la tuile */
  url: string;
  /** Taille de la tuile en pixels */
  size: number;
  /** Timestamp de création/chargement */
  timestamp: number;
  /** État de chargement */
  loading: boolean;
  /** Tuile chargée avec succès */
  loaded: boolean;
  /** Erreur de chargement */
  error?: Error;
}

/**
 * Gestionnaire de fournisseur de tuiles
 */
export interface TileProviderConfig {
  /** Nom du fournisseur */
  name: string;
  /** Template d'URL avec placeholders {x}, {y}, {z} */
  urlTemplate: string;
  /** Attribution requise */
  attribution?: string;
  /** Zoom minimum supporté */
  minZoom?: number;
  /** Zoom maximum supporté */
  maxZoom?: number;
  /** Sous-domaines disponibles */
  subdomains?: string[];
  /** Headers HTTP personnalisés */
  headers?: Record<string, string>;
  /** Timeout de requête en millisecondes */
  timeout?: number;
}

/**
 * Événement de changement de région
 */
export interface RegionChangeEventData {
  /** Nouvelle région */
  region: MapViewport;
  /** Changement initié par l'utilisateur */
  isUserInteraction: boolean;
  /** Changement en cours (pendant le geste) */
  isAnimating: boolean;
  /** Raison du changement */
  reason: 'user' | 'programmatic' | 'animation';
}

/**
 * Événement de pression sur la carte
 */
export interface MapPressEventData {
  /** Coordonnées géographiques du point pressé */
  coordinate: [number, number];
  /** Position en pixels sur l'écran */
  screenPoint: { x: number; y: number };
  /** Type de pression */
  type: 'single' | 'double' | 'long';
}

/**
 * Styles de carte prédéfinis
 */
export enum MapStyle {
  /** Style de rue standard */
  STREET = 'street',
  /** Style satellite */
  SATELLITE = 'satellite',
  /** Style hybride (satellite + labels) */
  HYBRID = 'hybrid',
  /** Style terrain */
  TERRAIN = 'terrain',
  /** Style sombre */
  DARK = 'dark',
  /** Style clair */
  LIGHT = 'light',
  /** Style en niveaux de gris */
  GRAYSCALE = 'grayscale',
}

/**
 * Options de géolocalisation
 */
export interface GeolocationOptions {
  /** Activer la haute précision */
  enableHighAccuracy: boolean;
  /** Timeout en millisecondes */
  timeout: number;
  /** Âge maximum de la position en millisecondes */
  maximumAge: number;
  /** Distance minimale pour déclencher une mise à jour en mètres */
  distanceFilter: number;
}

/**
 * Résultat de géolocalisation
 */
export interface GeolocationResult {
  /** Coordonnées [longitude, latitude] */
  coordinate: [number, number];
  /** Précision en mètres */
  accuracy: number;
  /** Altitude en mètres */
  altitude?: number;
  /** Précision de l'altitude en mètres */
  altitudeAccuracy?: number;
  /** Cap en degrés */
  heading?: number;
  /** Vitesse en m/s */
  speed?: number;
  /** Timestamp de la mesure */
  timestamp: number;
}

/**
 * Configuration d'animation
 */
export interface AnimationConfig {
  /** Durée de l'animation en millisecondes */
  duration: number;
  /** Fonction d'easing */
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
  /** Paramètres du spring (si easing = 'spring') */
  springConfig?: {
    tension: number;
    friction: number;
  };
}

/**
 * Gestionnaire de couches personnalisées
 */
export interface CustomLayer {
  /** ID unique de la couche */
  id: string;
  /** Type de couche */
  type: 'raster' | 'vector' | 'custom';
  /** Ordre d'affichage (z-index) */
  zIndex: number;
  /** Visibilité de la couche */
  visible: boolean;
  /** Opacité de la couche (0-1) */
  opacity: number;
  /** Zoom minimum pour afficher la couche */
  minZoom?: number;
  /** Zoom maximum pour afficher la couche */
  maxZoom?: number;
}

/**
 * Métriques de performance
 */
export interface MapPerformanceMetrics {
  /** FPS actuel */
  fps: number;
  /** Temps de rendu du frame en millisecondes */
  frameTime: number;
  /** Temps de chargement des tuiles en millisecondes */
  tileLoadTime: number;
  /** Taux de réussite du cache (0-1) */
  cacheHitRate: number;
  /** Utilisation mémoire en MB */
  memoryUsage: number;
  /** Nombre de tuiles en cache */
  cachedTiles: number;
  /** Nombre de tuiles en cours de chargement */
  loadingTiles: number;
  /** Nombre d'erreurs de chargement */
  tileErrors: number;
}

/**
 * Configuration de débogage
 */
export interface DebugConfig {
  /** Afficher les limites des tuiles */
  showTileBounds: boolean;
  /** Afficher les coordonnées des tuiles */
  showTileCoordinates: boolean;
  /** Afficher les métriques de performance */
  showPerformanceStats: boolean;
  /** Afficher les informations de géolocalisation */
  showLocationInfo: boolean;
  /** Couleur des éléments de debug */
  debugColor: string;
  /** Taille de police pour le debug */
  debugFontSize: number;
}

/**
 * Limites d'utilisation
 */
export interface UsageLimits {
  /** Nombre maximum de requêtes par minute */
  requestsPerMinute: number;
  /** Nombre maximum de tuiles en cache */
  maxCachedTiles: number;
  /** Taille maximum d'une seule tuile en bytes */
  maxTileSize: number;
  /** Timeout de requête réseau en millisecondes */
  networkTimeout: number;
}

/**
 * Interface principale pour la configuration complète d'une carte
 */
export interface CompleteMapConfig {
  /** Configuration de base */
  config: MapConfiguration;
  /** Viewport initial */
  initialViewport: MapViewport;
  /** Fournisseur de tuiles */
  tileProvider: TileProviderConfig;
  /** Style de carte */
  style: MapStyle | string;
  /** Options de géolocalisation */
  geolocation?: GeolocationOptions;
  /** Configuration d'animation */
  animation?: AnimationConfig;
  /** Couches personnalisées */
  customLayers?: CustomLayer[];
  /** Configuration de débogage */
  debug?: DebugConfig;
  /** Limites d'utilisation */
  limits?: UsageLimits;
}