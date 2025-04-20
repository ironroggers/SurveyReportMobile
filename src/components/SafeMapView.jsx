import React, { forwardRef, useState, useEffect } from 'react';
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
  
  // Effect to catch any potential errors during initialization
  useEffect(() => {
    return () => {
      // Cleanup on unmount if needed
    };
  }, []);

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
    // Let the framework decide which provider is best to use by default
    // Rather than explicitly setting provider="google"
    const safeProps = {...mapProps};
    
    // If provider is explicitly set, make sure it's supported on the platform
    if (safeProps.provider === 'google' && Platform.OS === 'ios') {
      // iOS needs additional setup for Google Maps
      try {
        // Check if Google Maps is properly initialized
        const GoogleMapsModule = require('react-native').NativeModules.AIRGoogleMapManager;
        if (!GoogleMapsModule) {
          console.warn('[SafeMapView] Google Maps module not available, falling back to default provider');
          delete safeProps.provider; // Remove provider prop to use default
        }
      } catch (e) {
        console.warn('[SafeMapView] Error checking Google Maps availability:', e);
        delete safeProps.provider; // Remove provider prop to use default
      }
    }

    return (
      <MapView
        ref={ref}
        style={style}
        {...safeProps}
        onError={(error) => {
          console.error('[SafeMapView] Map error:', error);
          setHasError(true);
        }}
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