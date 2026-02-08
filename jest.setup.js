import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@shopify/react-native-skia', () => {
  const SkiaMock = {
    Path: {
      make: jest.fn(() => ({
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        addCircle: jest.fn(),
        close: jest.fn(),
      })),
    },
  };
  return {
    Canvas: 'Canvas',
    Image: 'Image',
    Path: 'Path',
    Circle: 'Circle',
    useImage: jest.fn(),
    Skia: SkiaMock,
  };
});

const mockStorage = new Map();
const mockAsyncStorage = {
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Array.from(mockStorage.keys()))),
  multiGet: jest.fn((keys) => Promise.resolve(keys.map(key => [key, mockStorage.get(key) || null]))),
  multiRemove: jest.fn((keys) => {
    keys.forEach(key => mockStorage.delete(key));
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);