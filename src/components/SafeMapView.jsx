import React, { forwardRef, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

/**
 * SafeMapView - A wrapper around MapView with error handling
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
  const [hasError, setHasError] = useState(false);
  
  // Log the platform for debugging
  console.log(`[SafeMapView] Rendering on platform: ${Platform.OS}`);
  
  if (hasError) {
    // Show fallback UI when map encounters an error
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

  // Render the actual map for all platforms and builds
  try {
    return (
      <MapView
        ref={ref}
        style={style}
        {...mapProps}
        onError={() => setHasError(true)}
      >
        {children}
      </MapView>
    );
  } catch (error) {
    console.error('[SafeMapView] Error rendering map:', error);
    setHasError(true);
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