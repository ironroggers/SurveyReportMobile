import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import uuid from 'react-native-uuid';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Picker } from '@react-native-picker/picker';
import {SURVEY_URL} from "../api-url";

export default function SurveyFormScreen() {
  const [location, setLocation] = useState(null);
  const [attachments, setAttachments] = useState([]);
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

  const TERRAIN_TYPES = ['URBAN', 'RURAL', 'SUBURBAN', 'FOREST', 'MOUNTAIN'];
  const INFRASTRUCTURE_TYPES = ['POLES', 'DUCTS', 'TOWERS', 'FIBER', 'NONE'];

  const mapRef = React.useRef(null);

  useEffect(() => {
    if (route.params?.existingSurvey) {
      const { existingSurvey } = route.params;
      const latitude = existingSurvey?.terrainData?.centerPoint?.coordinates?.[1];
      const longitude = existingSurvey?.terrainData?.centerPoint?.coordinates?.[0];
      setAttachments(existingSurvey.attachments || []);
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
    });

    if (!result.canceled) {
      setAttachments([...attachments, ...result.assets]);
    }
  };

  const handleSubmit = async () => {
    if (!location || attachments.length === 0 || !details || !title || !elevation) {
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
        assignedBy: currentUser.reportingTo
      };

      const isUpdate = route.params?.existingSurvey;
      const url = isUpdate 
        ? `${SURVEY_URL}/api/surveys/${route.params.existingSurvey._id}`
        : `${SURVEY_URL}/api/surveys`;

      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(surveyData)
      });

      if (!response.ok) {
        const errorData = await response.json();
      }

      const result = await response.json();
      
      // Go back to previous screen with the new/updated survey data
      navigation.goBack();
      navigation.setParams({ newSurvey: result.data });
      
    } catch (error) {
      console.error(`Error ${route.params?.existingSurvey ? 'updating' : 'creating'} survey:`, error);
      Alert.alert('Error', error.message || `Failed to ${route.params?.existingSurvey ? 'update' : 'create'} survey`);
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
        {attachments.map((file, idx) => (
          <Image key={idx} source={{ uri: file.uri }} style={styles.attachment} />
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
  attachment: {
    width: 90,
    height: 90,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 6,
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
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
