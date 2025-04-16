import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import {LOCATION_URL} from "../api-url";

export default function SurveyorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser } = useCurrentUser();
  console.log("Here is the current User :",currentUser);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 17.385044,
    longitude: 78.486671,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    fetchAssignedLocations();
    getCurrentLocation();
  }, [currentUser]);

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
      setInitialRegion({
        ...newLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    }
  };

  const fitMapToPoints = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add current location if available
      if (currentLocation) {
        points.push(currentLocation);
      }
      
      // Add all assigned locations
      locations.forEach(location => {
        if (location.centerPoint?.coordinates) {
          points.push({
            latitude: location.centerPoint.coordinates[1],
            longitude: location.centerPoint.coordinates[0],
          });
        }
      });
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  const mapRef = React.useRef(null);

  const fetchAssignedLocations = async () => {
    try {
      const response = await fetch(`${LOCATION_URL}/api/locations?assignedTo=${currentUser?.id}`);
      if (!response.ok) {
        const errorData = await response.text();
        console.log('API Error:', errorData);
      }
      const data = await response.json();
      console.log("Logging the assigned location data:", data);
      
      if (!Array.isArray(data?.data)) {
        console.log('Invalid location data format:', data);
      }

      // Validate location structure
      const validLocations = data.data.filter(location => {
        const isValid = location && 
          location.centerPoint?.coordinates?.length === 2 &&
          location.geofence?.coordinates?.[0]?.length > 0;
        
        if (!isValid) {
          console.warn('Invalid location structure:', location);
        }
        return isValid;
      });

      console.log('Valid locations count:', validLocations);
      setLocations(validLocations);

      // If we have locations, update the map to show all of them
      if (validLocations.length > 0) {
        // Calculate the center point of all locations
        const bounds = validLocations.reduce((acc, location) => {
          // Consider all geofence points for bounds calculation
          location.geofence.coordinates[0].forEach(([lng, lat]) => {
            acc.minLat = Math.min(acc.minLat, lat);
            acc.maxLat = Math.max(acc.maxLat, lat);
            acc.minLng = Math.min(acc.minLng, lng);
            acc.maxLng = Math.max(acc.maxLng, lng);
          });
          return acc;
        }, {
          minLat: 90,
          maxLat: -90,
          minLng: 180,
          maxLng: -180,
        });

        // Set initial region to show all locations with padding
        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;
        const latDelta = (bounds.maxLat - bounds.minLat) * 1.5; // 1.5 for padding
        const lngDelta = (bounds.maxLng - bounds.minLng) * 1.5;

        setInitialRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: Math.max(0.05, latDelta),
          longitudeDelta: Math.max(0.05, lngDelta),
        });
      } else {
        console.log('No assigned locations found for user:', currentUser?.id);
      }
    } catch (err) {
      console.log('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = () => {
    Alert.alert('Attendance Marked', 'You can now start surveying locations.');
    setAttendanceMarked(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: () => logout()
        }
      ]
    );
  };

  const handleLocationPress = (location) => {
    setSelectedLocation(location);
  };

  const handleStartSurvey = async (location) => {
    try {
      // Make PUT request to update location status
      const response = await fetch(`${LOCATION_URL}/api/locations/${location._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...location,
          status: 'ACTIVE'
        })
      });

      if (!response.ok) {
        console.log('Failed to update location status');
        Alert.alert('Error', 'Failed to update location status');
      }

      // Navigate to survey list after successful update
      navigation.navigate('SurveyList', { location });
    } catch (error) {
      console.error('Error updating location status:', error);
      Alert.alert('Error', 'Failed to update location status');
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedLocation?._id === item._id;

    return (
      <TouchableOpacity 
        style={[styles.card, isSelected && styles.selectedCard]}
        onPress={() => handleLocationPress(item)}
      >
        <Text style={styles.name}>📍 {item.title}</Text>
        <Text style={styles.locationDetails}>
          Center: ({item.centerPoint.coordinates[1].toFixed(6)}, 
          {item.centerPoint.coordinates[0].toFixed(6)})
        </Text>
        <Text style={styles.locationDetails}>Radius: {item?.radius}m</Text>
        <Text style={styles.statusDetails}>Status: {item?.status}</Text>

        {attendanceMarked ? (
          item.status === 'ACTIVE' ? (
            <TouchableOpacity
              style={[styles.surveyBtn, { backgroundColor: '#2E7D32' }]}
              onPress={() => navigation.navigate('SurveyList', { location: item })}
            >
              <Text style={styles.btnText}>Edit Survey</Text>
            </TouchableOpacity>
          ) : (item.status === 'COMPLETED' || item.status === 'APPROVED') ? null : (
            <TouchableOpacity
              style={styles.surveyBtn}
              onPress={() => handleStartSurvey(item)}
            >
              <Text style={styles.btnText}>Start Survey</Text>
            </TouchableOpacity>
          )
        ) : (
          (item.status === 'COMPLETED' || item.status === 'APPROVED') ? (<Text style={styles.markNote}>Survey Completed</Text>) :
          <Text style={styles.markNote}>Mark attendance to begin survey.</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surveyor Dashboard</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.viewAttendanceBtn}
        onPress={() => navigation.navigate('Attendance')}
      >
        <Text style={styles.btnText}>View Attendance</Text>
      </TouchableOpacity>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onMapReady={() => {
            console.log('Map is ready, showing', locations.length, 'locations');
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          zoomControlEnabled={true}
        >
          {locations.map((location) => (
            <React.Fragment key={location._id}>
              <Marker
                coordinate={{
                  latitude: location.centerPoint.coordinates[1],
                  longitude: location.centerPoint.coordinates[0],
                }}
                title={location.title}
                onPress={() => handleLocationPress(location)}
                pinColor={selectedLocation?._id === location._id ? "#FF0000" : "#1976D2"}
              />
              {location.geofence?.coordinates[0]?.length > 0 && (
                <Polygon
                  coordinates={location.geofence.coordinates[0].map(([lng, lat]) => ({
                    latitude: lat,
                    longitude: lng,
                  }))}
                  strokeColor={selectedLocation?._id === location._id ? "#FF0000" : "#1976D2"}
                  fillColor={selectedLocation?._id === location._id ? "rgba(255,0,0,0.2)" : "rgba(25,118,210,0.2)"}
                  strokeWidth={2}
                />
              )}
            </React.Fragment>
          ))}
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              title="Your Location"
              pinColor="#4CAF50"
            />
          )}
        </MapView>

        <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation}>
          <Text style={styles.btnText}>Update Location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
          <Text style={styles.btnText}>Fit All Points</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <Text>Loading assigned locations...</Text>
        </View>
      ) : locations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text>No locations assigned yet.</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {!attendanceMarked && (
        <TouchableOpacity style={styles.attendanceBtn} onPress={handleMarkAttendance}>
          <Text style={styles.btnText}>Mark Attendance</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    paddingTop: 20, 
    paddingHorizontal: 16 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
  attendanceBtn: {
    backgroundColor: '#388E3C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 16,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
    borderWidth: 1,
  },
  name: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#1976D2',
  },
  locationDetails: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4 
  },
  statusDetails: {
    fontSize: 14,
    color: '#880000',
    marginTop: 4
  },
  surveyBtn: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  btnText: { 
    color: '#fff', 
    textAlign: 'center', 
    fontWeight: '600' 
  },
  markNote: {
    marginTop: 10,
    fontStyle: 'italic',
    color: 'gray',
  },
  viewAttendanceBtn: {
    backgroundColor: '#FFA000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  logoutBtn: {
    backgroundColor: '#f44336',
    padding: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    top: 10,
    right: 10,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 8,
  },
});
