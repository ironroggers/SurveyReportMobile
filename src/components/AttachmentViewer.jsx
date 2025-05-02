import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Text, Dimensions } from 'react-native';
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
    .map(item => ({ uri: item.url }));

  return (
    <ImageViewing
      images={formattedImages}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      FooterComponent={({ imageIndex }) => (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {imageIndex + 1} / {formattedImages.length}
          </Text>
        </View>
      )}
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
    height: 64,
    position: 'absolute',
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 20,
  },
  footerText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
}); 