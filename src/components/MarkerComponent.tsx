// src/components/MarkerComponent.tsx
import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MarkerProps } from '../types';

interface InternalMarkerProps extends MarkerProps {
  screenX?: number;
  screenY?: number;
  isVisible?: boolean;
}

const DefaultMarkerContent: React.FC<{ title?: string }> = ({ title }) => (
  <View style={styles.defaultMarker}>
    <View style={styles.markerPin} />
    <View style={styles.markerDot} />
    {title && (
      <View style={styles.markerLabel}>
        <Text style={styles.markerLabelText} numberOfLines={1}>
          {title}
        </Text>
      </View>
    )}
  </View>
);

const MarkerComponent: React.FC<InternalMarkerProps> = ({
  coordinate,
  title,
  description,
  children,
  onPress,
  draggable = false,
  onDragEnd,
  anchor = { x: 0.5, y: 1 },
  zIndex = 0,
  screenX = 0,
  screenY = 0,
  isVisible = true,
  ...props
}) => {
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  const handleDragEnd = useCallback((newCoordinate: [number, number]) => {
    if (onDragEnd) {
      onDragEnd(newCoordinate);
    }
  }, [onDragEnd]);

  if (!isVisible) {
    return null;
  }

  const markerStyle = [
    styles.marker,
    {
      left: screenX - (anchor.x * 40), // 40 est la largeur par défaut du marqueur
      top: screenY - (anchor.y * 40), // 40 est la hauteur par défaut du marqueur
      zIndex,
    },
  ];

  const MarkerWrapper = onPress ? TouchableOpacity : View;

  return (
    <MarkerWrapper
      style={markerStyle}
      onPress={onPress ? handlePress : undefined}
      activeOpacity={0.7}
      {...props}
    >
      {children || <DefaultMarkerContent title={title} />}
    </MarkerWrapper>
  );
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: 30,
    height: 30,
    backgroundColor: '#FF6B6B',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  markerLabel: {
    marginTop: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 120,
  },
  markerLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default memo(MarkerComponent);