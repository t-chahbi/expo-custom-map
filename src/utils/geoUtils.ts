// src/utils/geoUtils.ts
export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;
export const rad2deg = (rad: number): number => (rad * 180) / Math.PI;

export const latLonToTile = (lat: number, lon: number, zoom: number): { x: number; y: number } => {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
  return { x, y };
};

export const tileToLatLon = (x: number, y: number, zoom: number): { lat: number; lon: number } => {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const lat = rad2deg(Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))));
  return { lat, lon };
};

export const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(coord2[1] - coord1[1]);
  const dLon = deg2rad(coord2[0] - coord1[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1[1])) * Math.cos(deg2rad(coord2[1])) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateBearing = (start: [number, number], end: [number, number]): number => {
  const startLat = deg2rad(start[1]);
  const startLng = deg2rad(start[0]);
  const endLat = deg2rad(end[1]);
  const endLng = deg2rad(end[0]);

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  const bearing = rad2deg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

export const getGeoBounds = (coordinates: [number, number][]): {
  north: number;
  south: number;
  east: number;
  west: number;
} => {
  if (coordinates.length === 0) {
    throw new Error('Cannot calculate bounds of empty coordinates array');
  }

  let north = coordinates[0][1];
  let south = coordinates[0][1];
  let east = coordinates[0][0];
  let west = coordinates[0][0];

  coordinates.forEach(([lon, lat]) => {
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lon < west) west = lon;
  });

  return { north, south, east, west };
};

export const isPointInBounds = (
  point: [number, number],
  bounds: { north: number; south: number; east: number; west: number }
): boolean => {
  const [lon, lat] = point;
  return lat <= bounds.north && lat >= bounds.south && lon <= bounds.east && lon >= bounds.west;
};

export const getBoundsZoom = (
  bounds: { north: number; south: number; east: number; west: number },
  screenWidth: number,
  screenHeight: number,
  tileSize: number = 256
): number => {
  const latDiff = bounds.north - bounds.south;
  const lonDiff = bounds.east - bounds.west;

  const maxDiff = Math.max(latDiff, lonDiff);
  const zoom = Math.floor(Math.log2(360 / maxDiff));

  return Math.max(1, Math.min(18, zoom));
};

export const calculateTileBounds = (
  lat: number,
  lon: number,
  radiusKm: number,
  zoom: number
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const latRad = deg2rad(lat);
  const degreeDistance = 111; // km par degré approximatif

  const latDelta = radiusKm / degreeDistance;
  const lonDelta = radiusKm / (degreeDistance * Math.cos(latRad));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLon = lon - lonDelta;
  const maxLon = lon + lonDelta;

  const minTile = latLonToTile(minLat, minLon, zoom);
  const maxTile = latLonToTile(maxLat, maxLon, zoom);

  return {
    minX: Math.min(minTile.x, maxTile.x),
    maxX: Math.max(minTile.x, maxTile.x),
    minY: Math.min(minTile.y, maxTile.y),
    maxY: Math.max(minTile.y, maxTile.y),
  };
};

export const normalizeCoordinate = (coordinate: [number, number]): [number, number] => {
  let [lon, lat] = coordinate;
  
  // Normaliser la longitude (-180 to 180)
  lon = ((lon + 180) % 360) - 180;
  
  // Clamp la latitude (-90 to 90)
  lat = Math.max(-90, Math.min(90, lat));
  
  return [lon, lat];
};

export const interpolateCoordinates = (
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] => {
  const startLon = start[0];
  const startLat = start[1];
  const endLon = end[0];
  const endLat = end[1];

  const lon = startLon + (endLon - startLon) * progress;
  const lat = startLat + (endLat - startLat) * progress;

  return [lon, lat];
};