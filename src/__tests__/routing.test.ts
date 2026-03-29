import { calculateRoute } from '../utils/routing';

describe('calculateRoute', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should compute OSRM route successfully', async () => {
    const start: [number, number] = [2.3522, 48.8566]; // Paris
    const end: [number, number] = [2.2944, 48.8584];   // La Defense

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'Ok',
            routes: [
              {
                distance: 5200,
                duration: 650,
                geometry: {
                  coordinates: [start, [2.32, 48.86], end],
                },
                legs: [
                  {
                    steps: [
                      {
                        maneuver: {
                          location: start,
                          type: 'depart',
                          instruction: 'Depart',
                        },
                        distance: 0,
                        duration: 0,
                        name: 'Route 1',
                      },
                    ],
                  },
                ],
              },
            ],
          }),
      })
    );

    const result = await calculateRoute(start, end, { profile: 'driving' });

    expect(mockFetch).toHaveBeenCalled();
    expect(result.distance).toBe(5200);
    expect(result.coordinates).toHaveLength(3);
    expect(result.instructions).toHaveLength(1);
  });

  it('should fall back to straight line route on fetch failure', async () => {
    const start: [number, number] = [2.3522, 48.8566];
    const end: [number, number] = [2.2944, 48.8584];

    mockFetch.mockRejectedValue(new Error('Network offline'));

    const result = await calculateRoute(start, end);

    // Should return fallback result
    expect(result.distance).toBeGreaterThan(0);
    expect(result.coordinates).toHaveLength(2);
    expect(result.coordinates[0]).toEqual(start);
    expect(result.coordinates[1]).toEqual(end);
    expect(result.instructions).toHaveLength(2);
  });
});
