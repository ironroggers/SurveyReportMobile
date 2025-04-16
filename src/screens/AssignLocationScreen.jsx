import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text, Alert, ScrollView, FlatList } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import * as LocationGeocoding from 'expo-location';
import {useCurrentUser} from "../hooks/useCurrentUser";
import {LOCATION_URL} from "../api-url";

export default function AssignLocationScreen({ route, navigation }) {
  const { surveyorId } = route.params;
  const [searchText, setSearchText] = useState('');
  const [title, setTitle] = useState('');
  const [radius, setRadius] = useState('500');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const {currentUser} = useCurrentUser();
  const [region, setRegion] = useState({
    latitude: 17.385044,  // Default to Hyderabad
    longitude: 78.486671,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    getCurrentLocation();
    fetchAssignedLocations();
  }, []);

  const fetchAssignedLocations = async () => {
    try {
      const response = await fetch(`${LOCATION_URL}/api/locations?assignedTo=${surveyorId}`);
      const data = await response.json();
      if (data.success) {
        setAssignedLocations(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching assigned locations:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions to use this feature');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(newLocation);
      setRegion({
        ...newLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    }
  };

  const handleSearch = async () => {
    try {
      const results = await LocationGeocoding.geocodeAsync(searchText);
      if (results.length > 0) {
        const loc = results[0];
        const coords = {
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
        setSelectedLocation(coords);
        setRegion({
          ...region,
          ...coords,
        });
        // Reset polygon points when searching new location
        setPolygonPoints([]);
      } else {
        Alert.alert('Location not found');
      }
    } catch (err) {
      Alert.alert('Error searching location');
    }
  };

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    setPolygonPoints(prevPoints => {
      // If we already have 4 points, don't add more
      if (prevPoints.length >= 4) {
        return prevPoints;
      }
      
      // Add the new point
      const newPoints = [...prevPoints, coordinate];
      
      // If this was the fourth point, automatically add the first point to close the polygon
      if (newPoints.length === 4) {
        return [...newPoints, newPoints[0]];
      }
      
      return newPoints;
    });
  };

  const calculateCenterPoint = (points) => {
    if (points.length === 0) return null;
    
    const latitudes = points.map(p => p.latitude);
    const longitudes = points.map(p => p.longitude);
    
    return {
      latitude: latitudes.reduce((a, b) => a + b) / points.length,
      longitude: longitudes.reduce((a, b) => a + b) / points.length,
    };
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the location');
      return;
    }

    if (polygonPoints.length < 4) {
      Alert.alert('Error', 'Please draw a complete polygon on the map');
      return;
    }

    const centerPoint = calculateCenterPoint(polygonPoints);

    const locationData = {
      title,
      geofence: {
        type: 'Polygon',
        coordinates: [[...polygonPoints.map(point => [point.longitude, point.latitude])]]
      },
      centerPoint: {
        type: 'Point',
        coordinates: [centerPoint.longitude, centerPoint.latitude]
      },
      radius: parseInt(radius, 10),
      assignedTo: surveyorId,
      status: 'INACTIVE',
      createdBy: currentUser.id
    };

    try {
      const response = await fetch(`${LOCATION_URL}/api/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData)
      });

      const responseData = await response.json();

      if (response.ok) {
        // Update the local state with the new location
        setAssignedLocations([...assignedLocations, responseData.data]);
        
        // Reset form fields
        setTitle('');
        setPolygonPoints([]);
        
        Alert.alert('Success', 'Location assigned successfully!');
        
        // Clear the form but stay on the screen to allow more assignments
        resetForm();
      } else {
        Alert.alert('Error', responseData.message || 'Failed to assign location');
      }
    } catch (error) {
      console.error('Error assigning location:', error);
      Alert.alert('Error', 'Failed to assign location. Please try again.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setPolygonPoints([]);
    setSelectedLocation(null);
  };

  const handleFinish = () => {
    if (route.params?.onLocationAssigned) {
      route.params.onLocationAssigned();
    }
    navigation.goBack();
  };

  const renderAssignedLocation = ({ item }) => (
    <View style={styles.assignedLocationCard}>
      <Text style={styles.locationTitle}>{item.title}</Text>
      <Text style={styles.locationDetails}>
        Status: {item.status}
      </Text>
    </View>
  );

  const resetPolygon = () => {
    setPolygonPoints([]);
  };

  const fitMapToPoints = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add current location if available
      if (currentLocation) {
        points.push(currentLocation);
      }
      
      // Add selected location if available
      if (selectedLocation) {
        points.push(selectedLocation);
      }
      
      // Add polygon points
      points.push(...polygonPoints);
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  const mapRef = React.useRef(null);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assign Multiple Locations</Text>
      </View>

      {/* Assigned Locations List */}
      <View style={styles.assignedLocationsContainer}>
        <Text style={styles.sectionTitle}>Assigned Locations</Text>
        <FlatList
          data={assignedLocations}
          renderItem={renderAssignedLocation}
          keyExtractor={(item) => item._id}
          horizontal={true}
          style={styles.assignedLocationsList}
        />
      </View>

      <TextInput
        placeholder="Search location"
        value={searchText}
        onChangeText={setSearchText}
        style={styles.input}
      />
      <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
        <Text style={styles.btnText}>Search</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Location Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <TextInput
        placeholder="Radius (meters)"
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
        style={styles.input}
      />

      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          region={region}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          zoomControlEnabled={true}
        >
          {selectedLocation && (
            <Marker coordinate={selectedLocation} title="Selected Location" pinColor="#1976D2" />
          )}
          {currentLocation && (
            <Marker coordinate={currentLocation} title="Your Location" pinColor="#4CAF50" />
          )}
          {polygonPoints.length > 0 && (
            <Polygon
              coordinates={polygonPoints}
              strokeColor="#F00"
              fillColor="rgba(255,0,0,0.2)"
              strokeWidth={2}
            />
          )}
        </MapView>

        <TouchableOpacity onPress={resetPolygon} style={styles.resetBtn}>
          <Text style={styles.btnText}>Reset Polygon</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation}>
          <Text style={styles.btnText}>Update Location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
          <Text style={styles.btnText}>Fit All Points</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instructions}>
        Tap on the map to draw a polygon. Connect back to the first point to complete.
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Assign Location</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.submitButton, styles.finishButton]} 
          onPress={handleFinish}
        >
          <Text style={styles.buttonText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  input: {
    height: 45,
    margin: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  mapContainer: {
    height: 400,
    margin: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  searchBtn: {
    backgroundColor: '#1976D2',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  resetBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 8,
  },
  locationBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 8,
  },
  fitBtn: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 8,
  },
  submitBtn: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  instructions: {
    margin: 10,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  assignedLocationsContainer: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  assignedLocationsList: {
    flexGrow: 0,
  },
  assignedLocationCard: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 150,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  finishButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
