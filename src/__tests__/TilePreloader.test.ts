import { TilePreloader } from '../TilePreloader';
import { TileCache } from '../TileCache';

describe('TilePreloader', () => {
  let cache: TileCache;
  let preloader: TilePreloader;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    cache = TileCache.createMemoryOnlyCache(10);
    preloader = new TilePreloader(cache);
    
    mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('simulated-tile-binary-data'),
      })
    );
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should preload tiles around center coordinate', async () => {
    const lat = 48.8566; // Paris
    const lon = 2.3522;
    const zoom = 10;
    const radius = 1; // 3x3 tiles = 9 tiles

    await preloader.preloadTilesAroundCenter(lat, lon, zoom, radius, 'http://test/{z}/{x}/{y}.png');

    // Fetch should be called for tiles in the radius
    expect(mockFetch).toHaveBeenCalled();
    
    // Check that some tiles are now in the cache
    const stats = cache.getStats();
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should preload tiles for a region path route', async () => {
    const route: [number, number][] = [
      [2.3522, 48.8566], // Paris
      [2.2944, 48.8584], // La Defense
    ];
    const zoom = 12;

    await preloader.preloadTilesForRoute(route, zoom, 500, 'http://test/{z}/{x}/{y}.png');

    expect(mockFetch).toHaveBeenCalled();
    expect(cache.getStats().size).toBeGreaterThan(0);
  });

  it('should cancel preloading properly', async () => {
    const lat = 48.8566;
    const lon = 2.3522;
    const zoom = 10;

    // Start preload region and immediately cancel
    const preloadPromise = preloader.preloadTilesForRegion(lat, lon, zoom, {
      radius: 2,
      delay: 50,
      tileUrlTemplate: 'http://test/{z}/{x}/{y}.png',
    });

    preloader.cancelPreloading();
    const result = await preloadPromise;

    expect(preloader.isCurrentlyPreloading()).toBe(false);
    expect(preloader.getQueueSize()).toBe(0);
  });
});
