// TestMapFixed.tsx - Component to test the fixed map implementation
import React from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import CustomMapViewFixed from './src/CustomMapViewFixed';

const TestMapFixed = () => {
  // OpenStreetMap tile template (free to use)
  const tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  // Paris coordinates
  const center: [number, number] = [2.3522, 48.8566];
  const zoom = 12;

  // Sample markers
  const markers = [
    {
      id: '1',
      coordinate: [2.3522, 48.8566] as [number, number],
      title: 'Paris Center',
      description: 'Center of Paris',
    },
    {
      id: '2', 
      coordinate: [2.2945, 48.8584] as [number, number],
      title: 'Eiffel Tower',
      description: 'Famous tower in Paris',
    },
    {
      id: '3',
      coordinate: [2.3376, 48.8606] as [number, number], 
      title: 'Louvre Museum',
      description: 'World famous museum',
    },
  ];

  const handleRegionChange = (region: any) => {
    console.log('Region changed:', region);
  };

  const handleMapPress = (coordinate: [number, number]) => {
    Alert.alert(
      'Map Pressed',
      `Coordinates: ${coordinate[1].toFixed(4)}, ${coordinate[0].toFixed(4)}`
    );
  };

  const handleMapReady = () => {
    console.log('Map is ready!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fixed Custom Map Test</Text>
      <View style={styles.mapContainer}>
        <CustomMapViewFixed
          style={styles.map}
          center={center}
          zoom={zoom}
          minZoom={3}
          maxZoom={18}
          tileUrlTemplate={tileUrlTemplate}
          onRegionChange={handleRegionChange}
          onMapPress={handleMapPress}
          onMapReady={handleMapReady}
          markers={markers}
          enableClustering={false}
          tileSize={256}
          cacheSize={150}
        />
      </View>
      <Text style={styles.instructions}>
        • Pan: Drag to move the map{'\n'}
        • Zoom: Pinch to zoom in/out{'\n'}
        • Tap: Press anywhere to see coordinates{'\n'}
        • Markers: Red dots show sample locations
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 10,
    backgroundColor: '#f8f8f8',
  },
  mapContainer: {
    flex: 1,
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  instructions: {
    padding: 15,
    backgroundColor: '#f0f0f0',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default TestMapFixed;
