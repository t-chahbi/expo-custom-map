// src/components/ClusterMarker.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ClusterMarkerProps } from '../types';

interface InternalClusterMarkerProps extends ClusterMarkerProps {
  screenX?: number;
  screenY?: number;
  isVisible?: boolean;
}

const ClusterMarker: React.FC<InternalClusterMarkerProps> = ({
  coordinate,
  count,
  markers,
  onPress,
  style,
  screenX = 0,
  screenY = 0,
  isVisible = true,
}) => {
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  // Calculer la taille du cluster basée sur le nombre de marqueurs
  const clusterSize = useMemo(() => {
    if (count < 10) return 'small';
    if (count < 100) return 'medium';
    return 'large';
  }, [count]);

  // Calculer la couleur du cluster basée sur la densité
  const clusterColor = useMemo(() => {
    if (count < 10) return '#4ECDC4';
    if (count < 50) return '#45B7D1';
    if (count < 100) return '#F39C12';
    return '#E74C3C';
  }, [count]);

  // Formater le nombre pour l'affichage
  const displayCount = useMemo(() => {
    if (count < 1000) return count.toString();
    if (count < 10000) return `${Math.floor(count / 100) / 10}K`;
    return `${Math.floor(count / 1000)}K`;
  }, [count]);

  if (!isVisible || count <= 1) {
    return null;
  }

  const clusterStyle = [
    styles.cluster,
    styles[clusterSize],
    {
      backgroundColor: clusterColor,
      left: screenX - (styles[clusterSize].width / 2),
      top: screenY - (styles[clusterSize].height / 2),
    },
    style,
  ];

  const textStyle = [
    styles.clusterText,
    styles[`${clusterSize}Text`],
  ];

  return (
    <TouchableOpacity
      style={clusterStyle}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={textStyle} numberOfLines={1}>
        {displayCount}
      </Text>
      
      {/* Effet de pulse pour indiquer l'interactivité */}
      <View style={[styles.pulseRing, { backgroundColor: clusterColor }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cluster: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  small: {
    width: 40,
    height: 40,
  },
  medium: {
    width: 50,
    height: 50,
  },
  large: {
    width: 60,
    height: 60,
  },
  clusterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.3,
    width: '120%',
    height: '120%',
    zIndex: -1,
  },
});

export default memo(ClusterMarker);