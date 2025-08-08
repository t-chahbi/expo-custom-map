import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CustomMapView from './src/CustomMapView';

export default function SimpleMapTest() {
  // Paris par défaut
  const lat = 48.8566;
  const lon = 2.3522;

  console.log('🗺️ Map center:', [lon, lat]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test de la carte</Text>
      <CustomMapView
        style={styles.map}
        center={[lon, lat]} // [longitude, latitude]
        zoom={15}
        tileUrlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        onRegionChange={(region) => console.log('✅ Region changed:', region)}
        onMapReady={() => console.log('✅ Map ready!')}
        markers={[{
          coordinate: [lon, lat],
          title: "Paris",
          children: (
            <View style={styles.marker}>
              <Text style={styles.markerText}>📍</Text>
            </View>
          )
        }]}
      />
      <View style={styles.debug}>
        <Text>Lat: {lat}</Text>
        <Text>Lon: {lon}</Text>
        <Text>Center: [{lon}, {lat}]</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    padding: 20,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f0f0f0',
  },
  map: {
    flex: 1,
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 24,
  },
  debug: {
    position: 'absolute',
    top: 80,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});
