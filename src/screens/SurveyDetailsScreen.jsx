import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import SafeMapView from '../components/SafeMapView';
import AttachmentViewer from '../components/AttachmentViewer';

export default function SurveyDetailsScreen({ route, navigation }) {
  const { survey } = route.params;

  const [details, setDetails] = useState(survey.details || '');
  const [attachments, setAttachments] = useState(survey.attachments || []);
  const [isAttachmentViewerVisible, setIsAttachmentViewerVisible] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);

  const mapRef = React.useRef(null);

  const fitMapToPoints = () => {
    if (mapRef.current && survey.location) {
      mapRef.current.fitToCoordinates([survey.location], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const handleUploadAttachments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Allow access to media library to upload attachments.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      // Format the attachments to be compatible with AttachmentViewer
      const formattedAttachments = result.assets.map(asset => ({
        url: asset.uri,
        fileType: 'IMAGE',
      }));
      setAttachments([...attachments, ...formattedAttachments]);
    }
  };

  const handleSaveChanges = () => {
    // Here you can send updated survey details back to LocationDetailsScreen via route or context
    Alert.alert('Saved', 'Survey updated successfully!');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.mapContainer}>
        <SafeMapView
          style={styles.map}
          region={{
            latitude: survey?.location?.coordinates?.[1] || 0,
            longitude: survey?.location?.coordinates?.[0] || 0,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          fallbackText="Map temporarily unavailable"
          fallbackSubText="Survey location data is still available"
        >
          {survey?.location?.coordinates && (
            <Marker
              coordinate={{
                latitude: survey.location.coordinates[1],
                longitude: survey.location.coordinates[0],
              }}
              title="Survey Location"
              pinColor="#1976D2"
            />
          )}
        </SafeMapView>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Survey Details:</Text>
        <TextInput
          style={styles.input}
          value={details}
          multiline
          onChangeText={setDetails}
          placeholder="Describe terrain, elevation, infra..."
        />

        <View style={styles.attachmentHeader}>
          <Text style={styles.label}>Attachments:</Text>
          <TouchableOpacity onPress={handleUploadAttachments}>
            <Text style={styles.uploadBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.attachmentsContainer}>
          {attachments.map((file, index) => (
            <TouchableOpacity 
              key={index} 
              onPress={() => {
                setSelectedAttachmentIndex(index);
                setIsAttachmentViewerVisible(true);
              }}
            >
              <Image source={{ uri: file.url || file.uri }} style={styles.attachment} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges}>
          <Text style={styles.saveText}>💾 Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
          <Text style={styles.btnText}>Fit All Points</Text>
        </TouchableOpacity>
      </View>
      
      {/* Attachment Viewer */}
      <AttachmentViewer
        visible={isAttachmentViewerVisible}
        attachments={attachments}
        initialIndex={selectedAttachmentIndex}
        onClose={() => setIsAttachmentViewerVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: {
    height: 300,
    width: '100%',
    marginBottom: 20,
  },
  map: { height: '100%', width: '100%' },
  content: { padding: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadBtn: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 16,
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  attachment: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  saveBtn: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  fitBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
