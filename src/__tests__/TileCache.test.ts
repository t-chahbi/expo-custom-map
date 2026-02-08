import { TileCache } from '../TileCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('TileCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('should initialize correctly with size and age limits', () => {
    const cache = new TileCache(50, 24 * 60 * 60 * 1000, false);
    const stats = cache.getStats();
    expect(stats.maxSizeMB).toBe(50);
    expect(stats.size).toBe(0);
    expect(stats.currentSizeMB).toBe(0);
  });

  it('should store and retrieve tiles in memory-only mode', async () => {
    const cache = TileCache.createMemoryOnlyCache(10);
    const tileInfo = { x: 1, y: 2, z: 3, url: 'http://test/3/1/2.png' };
    const tileData = 'test-image-data-base64';

    await cache.set(tileInfo, tileData);
    
    expect(cache.has(1, 2, 3)).toBe(true);
    expect(cache.get(1, 2, 3)).toBe(tileData);
    expect(cache.get(2, 2, 3)).toBeNull();
  });

  it('should delete tiles correctly', async () => {
    const cache = TileCache.createMemoryOnlyCache(10);
    const tileInfo = { x: 1, y: 2, z: 3, url: 'http://test/3/1/2.png' };
    const tileData = 'test-image-data';

    await cache.set(tileInfo, tileData);
    expect(cache.has(1, 2, 3)).toBe(true);

    await cache.delete(1, 2, 3);
    expect(cache.has(1, 2, 3)).toBe(false);
    expect(cache.get(1, 2, 3)).toBeNull();
  });

  it('should clear all cache elements', async () => {
    const cache = TileCache.createMemoryOnlyCache(10);
    
    await cache.set({ x: 1, y: 1, z: 1, url: 'http://t1' }, 'data1');
    await cache.set({ x: 2, y: 2, z: 2, url: 'http://t2' }, 'data2');

    expect(cache.getStats().size).toBe(2);

    await cache.clear();
    expect(cache.getStats().size).toBe(0);
  });
});
