// src/utils/routing.ts
import { RoutingOptions, RouteResult } from '../types';

/**
 * Calculer la distance de grand cercle entre deux coordonnées géographiques
 */
const getDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // en mètres
};

/**
 * Calcule un itinéraire entre deux points en utilisant l'API publique OSRM
 * avec une récupération robuste en cas de panne réseau (tracé en ligne droite).
 */
export const calculateRoute = async (
  start: [number, number],
  end: [number, number],
  options: RoutingOptions = {}
): Promise<RouteResult> => {
  const profileMap = {
    driving: 'car',
    walking: 'foot',
    cycling: 'bicycle',
  };

  const profile = options.profile || 'driving';
  const osrmProfile = profileMap[profile] || 'car';
  
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 secondes de timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erreur HTTP OSRM: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`Aucun itinéraire trouvé: ${data.message || data.code}`);
    }

    const route = data.routes[0];
    const coordinates: [number, number][] = route.geometry.coordinates;
    const distance = route.distance; // en mètres
    const duration = route.duration; // en secondes

    // Extraire les instructions si présentes
    const instructions = route.legs?.[0]?.steps?.map((step: any) => {
      const location: [number, number] = step.maneuver.location;
      return {
        type: step.maneuver.type,
        instruction: step.maneuver.instruction || `${step.maneuver.modifier || 'continuer'} sur ${step.name || 'la route'}`,
        distance: step.distance,
        time: step.duration,
        coordinate: location,
      };
    }) || [];

    return {
      distance,
      duration,
      coordinates,
      instructions,
    };
  } catch (error) {
    console.warn(`Calcul d'itinéraire OSRM échoué, utilisation du fallback rectiligne:`, error);
    
    // Fallback : Ligne droite
    const distance = getDistance(start, end);
    // Vitesse moyenne estimée en m/s
    const speedMap = {
      driving: 13.8, // ~50 km/h
      walking: 1.4,  // ~5 km/h
      cycling: 4.2,  // ~15 km/h
    };
    const speed = speedMap[profile] || 13.8;
    const duration = distance / speed;

    return {
      distance,
      duration,
      coordinates: [start, end],
      instructions: [
        {
          type: 'depart',
          instruction: 'Départ du point d\'origine',
          distance: 0,
          time: 0,
          coordinate: start,
        },
        {
          type: 'arrivee',
          instruction: 'Arrivée à destination (tracé direct)',
          distance: distance,
          time: duration,
          coordinate: end,
        }
      ],
    };
  }
};
