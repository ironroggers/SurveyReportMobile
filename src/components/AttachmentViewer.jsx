import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Text, Dimensions, Linking, Platform } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { Ionicons } from '@expo/vector-icons';

/**
 * A reusable component for viewing attachments in fullscreen
 * 
 * @param {boolean} visible - Whether the viewer is visible
 * @param {Array} attachments - Array of attachments to display
 * @param {number} initialIndex - Initial index to display
 * @param {function} onClose - Function to call when the viewer is closed
 * @returns {JSX.Element} - The component
 */
export default function AttachmentViewer({ visible, attachments, initialIndex = 0, onClose }) {
  // Format attachments for ImageViewing component
  const formattedImages = attachments
    .filter(item => item.fileType === 'IMAGE')
    .map(item => ({ 
      uri: item.url,
      // Pass along the geoLocation data
      geoLocation: item.geoLocation
    }));

  // Function to open location in maps app
  const openInMaps = (latitude, longitude) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`
    });
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to Google Maps web URL
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
      }
    });
  };

  return (
    <ImageViewing
      images={formattedImages}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      FooterComponent={({ imageIndex }) => {
        const currentImage = formattedImages[imageIndex];
        const hasGeoLocation = currentImage && currentImage.geoLocation;
        
        return (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {imageIndex + 1} / {formattedImages.length}
            </Text>
            
            {hasGeoLocation && (
              <View style={styles.geoLocationContainer}>
                <Ionicons name="location" size={16} color="#fff" />
                <Text style={styles.geoLocationText}>
                  {currentImage.geoLocation.latitude.toFixed(6)}, {currentImage.geoLocation.longitude.toFixed(6)}
                </Text>
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => openInMaps(
                    currentImage.geoLocation.latitude, 
                    currentImage.geoLocation.longitude
                  )}
                >
                  <Text style={styles.mapButtonText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
      HeaderComponent={({ imageIndex }) => (
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    width: width,
    position: 'absolute',
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  footerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  geoLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    padding: 6,
    backgroundColor: 'rgba(25, 118, 210, 0.5)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  geoLocationText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
    marginRight: 10,
  },
  mapButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
}); 