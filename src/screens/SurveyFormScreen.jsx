import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Dimensions, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import uuid from 'react-native-uuid';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Picker } from '@react-native-picker/picker';
import {SURVEY_URL} from "../api-url";
import * as FileSystem from 'expo-file-system';

export default function SurveyFormScreen() {
  const [location, setLocation] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [details, setDetails] = useState('');
  const [mapRegion, setMapRegion] = useState(null);
  const [title, setTitle] = useState('');
  const [terrainType, setTerrainType] = useState('URBAN');
  const [elevation, setElevation] = useState('');
  const [existingInfrastructure, setExistingInfrastructure] = useState(['POLES']);
  const navigation = useNavigation();
  const route = useRoute();
  const assignedLocation = route.params?.existingSurvey?.location || route.params?.location._id;
  const currentLocation = route.params?.currentLocation;
  const { currentUser } = useCurrentUser();
  const [isUploading, setIsUploading] = useState(false);

  const TERRAIN_TYPES = ['URBAN', 'RURAL', 'SUBURBAN', 'FOREST', 'MOUNTAIN'];
  const INFRASTRUCTURE_TYPES = ['POLES', 'DUCTS', 'TOWERS', 'FIBER', 'NONE'];

  const mapRef = React.useRef(null);

  useEffect(() => {
    if (route.params?.existingSurvey) {
      const { existingSurvey } = route.params;
      const latitude = existingSurvey?.terrainData?.centerPoint?.coordinates?.[1];
      const longitude = existingSurvey?.terrainData?.centerPoint?.coordinates?.[0];
      setMediaFiles(existingSurvey.mediaFiles || []);
      setDetails(existingSurvey.description || '');
      setTitle(existingSurvey.title || '');
      setTerrainType(existingSurvey.terrainData?.terrainType || 'URBAN');
      setElevation(existingSurvey.terrainData?.elevation?.toString() || '');
      setExistingInfrastructure(existingSurvey.terrainData?.existingInfrastructure || ['POLES']);
      
      if (latitude && longitude) {
        setLocation({ latitude, longitude });
        setMapRegion({
          latitude: latitude,
          longitude: longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } else if (currentLocation?.latitude && currentLocation?.longitude) {
      setLocation(currentLocation);
      
      setMapRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [route.params]);

  const handleUploadAttachments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Allow access to media library to upload attachments.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newMediaFiles = result.assets.map(asset => ({
        url: asset.uri,
        fileType: getFileType(asset.type || getMimeType(asset.uri)),
        description: '',
        uploadedAt: new Date()
      }));
      setMediaFiles([...mediaFiles, ...newMediaFiles]);
    }
  };

  const getFileType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'DOCUMENT';
  };

  const getMimeType = (fileName) => {
    const extension = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'heic': 'image/heic',
      'heif': 'image/heif',
      // Videos
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'webm': 'video/webm',
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  };

  const uploadFile = async (fileUri) => {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.log('File does not exist');
      }

      // Get the file name from the URI
      const fileName = fileUri.split('/').pop();
      
      // Determine mime type based on file extension
      const mimeType = getMimeType(fileName);
      console.log('Uploading file:', { fileName, mimeType });
      
      // Create form data
      const formData = new FormData();
      
      // Properly format the file object for multipart/form-data
      formData.append('file', {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        type: mimeType,
        name: fileName,
      });

      console.log('Sending request to:', `${SURVEY_URL}/api/upload`);
      
      // Upload to your server with timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(`${SURVEY_URL}/api/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            // Don't set Content-Type header, let fetch set it with the boundary
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
          console.log('Upload failed:', errorData);
          console.log(errorData.message || `Upload failed with status ${response.status}`);
        }

        const data = await response.json().catch(e => {
          console.log('Failed to parse response:', e);
          console.log('Failed to parse server response');
        });
        
        console.log('Upload successful:', data);

        return {
          url: data.data.url,
          fileType: data.data.fileType || getFileType(mimeType),
          description: '',
          uploadedAt: new Date()
        };
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Upload timed out. Please check your internet connection and try again.');
        }
         error;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.log('Error in uploadFile:', error);
       error;
    }
  };

  const handleSubmit = async () => {
    if (!location || mediaFiles.length === 0 || !details || !title || !elevation) {
      Alert.alert('Incomplete', 'Please fill all required fields (title, location, attachments, elevation, and details).');
      return;
    }

    // Check if the location is within the geofence
    if (assignedLocation?.geofence?.coordinates[0]) {
      const point = [location.longitude, location.latitude];
      const polygon = assignedLocation.geofence.coordinates[0];
      
      if (!isPointInPolygon(point, polygon)) {
        Alert.alert('Invalid Location', 'The survey point must be within the assigned area (red polygon).');
        return;
      }
    }

    try {
      setIsUploading(true);

      // First, upload all media files
      const uploadedMediaFiles = [];
      for (const file of mediaFiles) {
        if (!file.url.startsWith('http')) { // Only upload files that haven't been uploaded yet
          try {
            const uploadResult = await uploadFile(file.url);
            uploadedMediaFiles.push({
              ...uploadResult,
              description: file.description || '',
            });
          } catch (error) {
            console.log('Error uploading file:', file.url, error);
            Alert.alert(
              'Upload Error',
              `Failed to upload file. ${error.message}`
            );
            setIsUploading(false);
            return;
          }
        } else {
          uploadedMediaFiles.push(file); // Keep already uploaded files as is
        }
      }

      const surveyData = {
        title: title,
        description: details,
        location: assignedLocation,
        terrainData: {
          terrainType: terrainType,
          elevation: parseInt(elevation),
          centerPoint: {
            type: "Point",
            coordinates: [location.longitude, location.latitude]
          },
          existingInfrastructure: existingInfrastructure
        },
        assignedTo: currentUser.id,
        assignedBy: currentUser.reportingTo,
        mediaFiles: uploadedMediaFiles
      };

      console.log('Sending survey data:', surveyData);

      const isUpdate = route.params?.existingSurvey;
      const url = isUpdate 
        ? `${SURVEY_URL}/api/surveys/${route.params.existingSurvey._id}`
        : `${SURVEY_URL}/api/surveys`;

      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(surveyData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
        console.log(errorData.message || `Failed to submit survey (${response.status})`);
      }

      const result = await response.json();
      
      // Go back to previous screen with the new/updated survey data
      navigation.goBack();
      navigation.setParams({ newSurvey: result.data });
      
    } catch (error) {
      console.log('Error in handleSubmit:', error);
      Alert.alert(
        'Error',
        `Failed to ${route.params?.existingSurvey ? 'update' : 'create'} survey: ${error.message}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Ray casting algorithm to check if point is inside polygon
  const isPointInPolygon = (point, polygon) => {
    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
      if (intersect) inside = !inside;
    }

    return inside;
  };

  const toggleInfrastructure = (type) => {
    if (existingInfrastructure.includes(type)) {
      setExistingInfrastructure(existingInfrastructure.filter(t => t !== type));
    } else {
      setExistingInfrastructure([...existingInfrastructure, type]);
    }
  };

  const fitMapToPoints = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add survey point if available
      if (location) {
        points.push(location);
      }
      
      // Add geofence points if available
      if (assignedLocation?.geofence?.coordinates[0]?.length > 0) {
        assignedLocation.geofence.coordinates[0].forEach(([lng, lat]) => {
          points.push({ latitude: lat, longitude: lng });
        });
      }
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          zoomControlEnabled={true}
        >
          {location && (
            <Marker
              coordinate={{
                latitude: location.latitude || 0,
                longitude: location.longitude || 0
              }}
              title="Survey Point"
              pinColor="#1976D2"
              draggable
              onDragEnd={(e) => setLocation(e.nativeEvent.coordinate)}
            />
          )}

          {assignedLocation?.geofence?.coordinates[0]?.length > 0 && (
            <Polygon
              coordinates={assignedLocation.geofence.coordinates[0].map(([lng, lat]) => ({
                latitude: lat,
                longitude: lng,
              }))}
              strokeColor="#FF0000"
              fillColor="rgba(255,0,0,0.2)"
              strokeWidth={2}
            />
          )}
        </MapView>

        <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
          <Text style={styles.btnText}>Fit All Points</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.titleInput}
        placeholder="Enter survey point title"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Survey Location</Text>
      <Text style={styles.coordinates}>
        {location ? 
          `Latitude: ${location.latitude?.toFixed(6)}, Longitude: ${location.longitude?.toFixed(6)}` :
          'No location selected'
        }
      </Text>

      <Text style={styles.label}>Terrain Type</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={terrainType}
          onValueChange={(value) => setTerrainType(value)}
          style={styles.picker}
        >
          {TERRAIN_TYPES.map((type) => (
            <Picker.Item key={type} label={type} value={type} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Elevation (meters)</Text>
      <TextInput
        style={styles.titleInput}
        placeholder="Enter elevation in meters"
        value={elevation}
        onChangeText={setElevation}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Existing Infrastructure</Text>
      <View style={styles.infrastructureContainer}>
        {INFRASTRUCTURE_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.infrastructureButton,
              existingInfrastructure.includes(type) && styles.infrastructureButtonSelected
            ]}
            onPress={() => toggleInfrastructure(type)}
          >
            <Text style={[
              styles.infrastructureButtonText,
              existingInfrastructure.includes(type) && styles.infrastructureButtonTextSelected
            ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Survey Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter terrain, elevation, infra info..."
        multiline
        value={details}
        onChangeText={setDetails}
      />

      <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadAttachments}>
        <Text style={styles.btnText}>📷 Upload Attachments</Text>
      </TouchableOpacity>

      <View style={styles.attachmentsContainer}>
        {mediaFiles.map((file, idx) => (
          <View key={idx} style={styles.mediaFileContainer}>
            {file.fileType === 'IMAGE' ? (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ 
                    uri: file.url,
                    headers: {
                      'Cache-Control': 'no-cache',
                      'Pragma': 'no-cache'
                    }
                  }}
                  style={styles.attachment}
                  defaultSource={require('../assets/image-placeholder.png')}
                  onError={(error) => {
                    const errorMessage = error?.nativeEvent?.error || 'Failed to load image';
                    console.log('Image loading error:', errorMessage);
                    if (errorMessage.includes('403')) {
                      // If the image URL has expired, we might want to refresh it
                      Alert.alert(
                        'Image Access Error',
                        'The image link has expired. Please try re-uploading the image.',
                        [
                          {
                            text: 'Remove Image',
                            onPress: () => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))
                          },
                          {
                            text: 'Cancel',
                            style: 'cancel'
                          }
                        ]
                      );
                    }
                  }}
                />
                <View style={styles.imageOverlay}>
                  <Text style={styles.imageStatus}>
                    {file.url.startsWith('http') ? '✓ Uploaded' : 'Pending Upload'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.attachment, styles.fileTypeIndicator]}>
                <Text style={styles.fileTypeText}>
                  {file.fileType === 'VIDEO' ? '🎥' : '📄'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitText}>✅ {route.params?.existingSurvey ? 'Update' : 'Submit'} Survey</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: 300,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  label: { 
    fontWeight: 'bold',
    marginBottom: 8,
  },
  titleInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  coordinates: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginBottom: 16,
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  infrastructureContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  infrastructureButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  infrastructureButtonSelected: {
    backgroundColor: '#1976D2',
  },
  infrastructureButtonText: {
    color: '#1976D2',
  },
  infrastructureButtonTextSelected: {
    color: '#fff',
  },
  uploadBtn: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnText: { 
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  mediaFileContainer: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  imageContainer: {
    position: 'relative',
    width: 90,
    height: 90,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
  },
  imageStatus: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  attachment: {
    width: 90,
    height: 90,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  submitBtn: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
  },
  submitText: { 
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
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
  fileTypeIndicator: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileTypeText: {
    fontSize: 24,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
