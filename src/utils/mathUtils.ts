// src/utils/mathUtils.ts

/**
 * Clamp une valeur entre un minimum et un maximum
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Interpolation linéaire entre deux valeurs
 */
export const lerp = (start: number, end: number, progress: number): number => {
  return start + (end - start) * progress;
};

/**
 * Interpolation inverse - trouve le facteur de progression entre deux valeurs
 */
export const inverseLerp = (start: number, end: number, value: number): number => {
  if (start === end) return 0;
  return (value - start) / (end - start);
};

/**
 * Remap une valeur d'une plage à une autre
 */
export const remap = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number => {
  const progress = inverseLerp(fromMin, fromMax, value);
  return lerp(toMin, toMax, progress);
};

/**
 * Arrondir à un nombre spécifique de décimales
 */
export const roundToDecimals = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Vérifier si un nombre est dans une plage (inclusif)
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Calculer la distance euclidienne entre deux points 2D
 */
export const distance2D = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculer la distance euclidienne au carré (plus rapide si on n'a pas besoin de la racine)
 */
export const distanceSquared2D = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

/**
 * Normaliser un angle en radians entre 0 et 2π
 */
export const normalizeAngleRadians = (angle: number): number => {
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  return angle;
};

/**
 * Normaliser un angle en degrés entre 0 et 360
 */
export const normalizeAngleDegrees = (angle: number): number => {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
};

/**
 * Calculer la différence entre deux angles (résultat entre -π et π)
 */
export const angleDifference = (angle1: number, angle2: number): number => {
  const diff = angle2 - angle1;
  return Math.atan2(Math.sin(diff), Math.cos(diff));
};

/**
 * Interpolation d'angle (prend le chemin le plus court)
 */
export const lerpAngle = (start: number, end: number, progress: number): number => {
  const diff = angleDifference(start, end);
  return start + diff * progress;
};

/**
 * Vérifier si un point est dans un rectangle
 */
export const isPointInRect = (
  pointX: number,
  pointY: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean => {
  return (
    pointX >= rectX &&
    pointX <= rectX + rectWidth &&
    pointY >= rectY &&
    pointY <= rectY + rectHeight
  );
};

/**
 * Vérifier si un point est dans un cercle
 */
export const isPointInCircle = (
  pointX: number,
  pointY: number,
  circleX: number,
  circleY: number,
  radius: number
): boolean => {
  return distanceSquared2D(pointX, pointY, circleX, circleY) <= radius * radius;
};

/**
 * Calculer l'aire d'un polygone (formule du lacet)
 */
export const polygonArea = (vertices: [number, number][]): number => {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  const n = vertices.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  
  return Math.abs(area) / 2;
};

/**
 * Vérifier si un point est dans un polygone (ray casting algorithm)
 */
export const isPointInPolygon = (
  point: [number, number],
  vertices: [number, number][]
): boolean => {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i];
    const [xj, yj] = vertices[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

/**
 * Fonction easing pour les animations
 */
export const easing = {
  linear: (t: number): number => t,
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  easeInOutCubic: (t: number): number => 
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInSine: (t: number): number => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: (t: number): number => Math.sin(t * Math.PI / 2),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
};

/**
 * Générer un hash simple pour un nombre (utile pour les seeds)
 */
export const simpleHash = (value: number): number => {
  let hash = Math.abs(Math.floor(value));
  hash = ((hash << 5) - hash + hash) & 0xffffffff;
  return hash;
};

/**
 * Générer un nombre pseudo-aléatoire avec une seed
 */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

/**
 * Calculer le facteur de zoom optimal pour afficher une zone
 */
export const calculateOptimalZoom = (
  bounds: { width: number; height: number },
  containerSize: { width: number; height: number },
  maxZoom: number = 18,
  padding: number = 0.1
): number => {
  const paddedWidth = containerSize.width * (1 - padding);
  const paddedHeight = containerSize.height * (1 - padding);
  
  const widthZoom = Math.log2(paddedWidth / bounds.width);
  const heightZoom = Math.log2(paddedHeight / bounds.height);
  
  return Math.min(Math.floor(Math.min(widthZoom, heightZoom)), maxZoom);
};

/**
 * Calculer le niveau de détail (LOD) basé sur la distance
 */
export const calculateLOD = (distance: number, maxDistance: number, maxLOD: number = 5): number => {
  if (distance >= maxDistance) return 0;
  const normalizedDistance = 1 - (distance / maxDistance);
  return Math.floor(normalizedDistance * maxLOD);
};

/**
 * Throttle pour limiter la fréquence d'exécution d'une fonction
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};

/**
 * Debounce pour retarder l'exécution d'une fonction
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};