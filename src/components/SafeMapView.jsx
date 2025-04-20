import React, { forwardRef } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

/**
 * SafeMapView - A wrapper around MapView that prevents crashes on Android production builds
 * 
 * @param {Object} props - All regular MapView props plus:
 * @param {String} fallbackText - Optional text to display when map is unavailable
 * @param {String} fallbackSubText - Optional subtext to display when map is unavailable
 * @param {Object} style - Style for the map container
 * @param {React.Node} children - MapView children (Markers, etc.)
 */
const SafeMapView = forwardRef(({
  fallbackText = 'Map temporarily unavailable',
  fallbackSubText,
  style,
  children,
  ...mapProps
}, ref) => {
  // Log the platform for debugging
  console.log(`[SafeMapView] Rendering on platform: ${Platform.OS}`);
  
  if (Platform.OS === 'android' && !__DEV__) {
    // In Android production builds, use a fallback view instead of MapView
    return (
      <View
        style={[
          styles.fallbackContainer,
          style,
        ]}
      >
        <Text style={styles.fallbackText}>{fallbackText}</Text>
        {fallbackSubText && (
          <Text style={styles.fallbackSubText}>{fallbackSubText}</Text>
        )}
      </View>
    );
  }

  // For iOS or during development, use the actual MapView
  return (
    <MapView
      ref={ref}
      style={style}
      {...mapProps}
    >
      {children}
    </MapView>
  );
});

const styles = StyleSheet.create({
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fallbackSubText: {
    fontSize: 12,
    marginTop: 8,
    color: '#999',
    textAlign: 'center',
  },
});

export default SafeMapView; 