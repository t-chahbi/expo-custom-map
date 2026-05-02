import { useOfflineMap } from '../hooks/useOfflineMap';

describe('useOfflineMap hook', () => {
  it('should be defined as a hook function', () => {
    expect(useOfflineMap).toBeDefined();
    expect(typeof useOfflineMap).toBe('function');
  });
});
