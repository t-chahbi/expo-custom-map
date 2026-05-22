import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import useMapPerformance from '../hooks/useMapPerformance';

describe('useMapPerformance hook', () => {
  let hookResults: any = null;

  const TestComponent = () => {
    hookResults = useMapPerformance();
    return null;
  };

  beforeEach(() => {
    hookResults = null;
    act(() => {
      TestRenderer.create(React.createElement(TestComponent));
    });
  });

  it('should initialize with default performance and cache stats', () => {
    expect(hookResults).not.toBeNull();
    expect(hookResults.isMonitoring).toBe(false);
    expect(hookResults.stats.fps).toBe(0);
    expect(hookResults.stats.frameTime).toBe(0);
    expect(hookResults.stats.tileLoadTime).toBe(0);
    expect(hookResults.cache.size).toBe(0);
    expect(hookResults.cache.hitRate).toBe(0);
  });

  it('should toggle monitoring state and register frame render loop', () => {
    const mockRequestAnimationFrame = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 1);
    const mockCancelAnimationFrame = jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});

    act(() => {
      hookResults.startMonitoring();
    });
    expect(hookResults.isMonitoring).toBe(true);
    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    act(() => {
      hookResults.stopMonitoring();
    });
    expect(hookResults.isMonitoring).toBe(false);
    expect(mockCancelAnimationFrame).toHaveBeenCalled();

    mockRequestAnimationFrame.mockRestore();
    mockCancelAnimationFrame.mockRestore();
  });

  it('should log cache hits and misses correctly', () => {
    act(() => {
      hookResults.recordCacheHit();
    });
    expect(hookResults.stats.cacheHitRate).toBe(1);

    act(() => {
      hookResults.recordCacheMiss();
    });
    // 1 hit, 1 miss = 0.5 hit rate
    expect(hookResults.stats.cacheHitRate).toBe(0.5);
  });
});
