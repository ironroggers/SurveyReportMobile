import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import * as Location from 'expo-location';
import {LOCATION_URL, AUTH_URL} from "../api-url";

export default function SupervisorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [surveyors, setSurveyors] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 17.385,
    longitude: 78.4867,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    if (currentUser) {
      fetchSurveyors();
      fetchAssignedLocations();
      getCurrentLocation();
    }
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
      setMapRegion({
        ...newLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    }
  };

  const fitMapToMarkers = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add current location if available
      if (currentLocation) {
        points.push(currentLocation);
      }
      
      // Add surveyor locations
      surveyors.forEach(surveyor => {
        if (surveyor.location) {
          points.push(surveyor.location);
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

  console.log("logging the current user", currentUser);

  const fetchAssignedLocations = async () => {
    try {
      console.log('Fetching locations from:', `${LOCATION_URL}/api/locations`);
      const response = await fetch(`${LOCATION_URL}/api/locations`);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch locations: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Fetched locations data:', data);
      
      // Create a map of surveyorId to their assigned location
      const locationMap = {};
      if (Array.isArray(data)) {
        data.forEach(location => {
          if (location.assignedTo) {
            locationMap[location.assignedTo] = location;
          }
        });
      } else if (data.data && Array.isArray(data.data)) {
        data.data.forEach(location => {
          if (location.assignedTo) {
            locationMap[location.assignedTo] = location;
          }
        });
      }
      
      console.log('Created location map:', locationMap);
      setAssignedLocations(locationMap);
    } catch (err) {
      console.error('Error fetching locations:', err.message);
      Alert.alert('Error', `Failed to fetch locations: ${err.message}`);
    }
  };

  const fetchSurveyors = async () => {
    try {
      console.log('Fetching surveyors from:', `${AUTH_URL}/api/auth/users`);
      const response = await fetch(`${AUTH_URL}/api/auth/users`);
      console.log('Surveyors response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch surveyors: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log("logging the data-------------38",data.data);
      const surveyors = Array.isArray(data?.data)
        ? data?.data.filter(user =>
            user?.role === "SURVEYOR" &&
            user?.reportingTo &&
            user?.reportingTo._id.toString() === currentUser.id
          )
        : [];
      console.log("logging the surveyors length :",surveyors.length);
      setSurveyors(surveyors);
    } catch (err) {
      console.error('Error fetching surveyors:', err.message);
      setError('Failed to load surveyors');
      Alert.alert('Error', `Failed to fetch surveyors: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Consider users with status 1 as present
  const presentSurveyors = Array.isArray(surveyors) 
    ? surveyors.filter((s) => s.status === 1) 
    : [];

  const handleAssignLocation = (surveyorId) => {
    if (!surveyorId) {
      Alert.alert('Error', 'Invalid surveyor selected');
      return;
    }
    navigation.navigate('AssignLocation', { 
      surveyorId,
      onLocationAssigned: () => {
        fetchAssignedLocations();
      }
    });
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

  const renderSurveyor = ({ item }) => {
    console.log('Rendering surveyor:', item._id);
    console.log('Assigned locations:', assignedLocations);
    const assignedLocation = assignedLocations[item._id];
    console.log('Found assigned location:', assignedLocation);

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <Text style={styles.status}>Status: {item.status === 1 ? 'Active' : 'Inactive'}</Text>
        <Text style={styles.lastLogin}>Last Login: {new Date(item.lastLogin).toLocaleString()}</Text>
        
        {assignedLocation ? (
          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>📍 {assignedLocation.title}</Text>
            <Text style={styles.locationDetails}>
              Center: ({assignedLocation.centerPoint?.coordinates[1]?.toFixed(6) || 'N/A'}, 
              {assignedLocation.centerPoint?.coordinates[0]?.toFixed(6) || 'N/A'})
            </Text>
            <Text style={styles.locationDetails}>Status: {assignedLocation.status}</Text>
            <Text style={styles.locationDetails}>Radius: {assignedLocation.radius}m</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => handleAssignLocation(item._id)}
          >
            <Text style={styles.btnText}>Assign Location</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Supervisor Dashboard</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.reviewBtn}
        onPress={() => navigation.navigate('ReviewSurvey')}
      >
        <Text style={styles.reviewBtnText}>📋 Review Survey Reports</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centerContent}>
          <Text>Loading surveyors...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.subHeader}>Active Supervisors: {presentSurveyors.length}</Text>

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
              {/* Show current location marker */}
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                  pinColor="#4CAF50"
                />
              )}

              {/* Show surveyor markers */}
              {presentSurveyors.map((s) => (
                s.location && (
                  <Marker
                    key={s._id}
                    coordinate={s.location}
                    title={s.username}
                    description="Current Location"
                    pinColor="#1976D2"
                  />
                )
              ))}
            </MapView>

            <TouchableOpacity style={styles.fitBtn} onPress={fitMapToMarkers}>
              <Text style={styles.btnText}>Fit All Points</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.locationBtn} 
              onPress={getCurrentLocation}
            >
              <Text style={styles.btnText}>Update Location</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={surveyors}
            keyExtractor={(item) => item._id}
            renderItem={renderSurveyor}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subHeader: { fontSize: 16, marginBottom: 12 },
  mapContainer: {
    height: 300,
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  card: {
    backgroundColor: '#f2f2f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  name: { 
    fontSize: 18, 
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    marginBottom: 4,
  },
  lastLogin: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  assignBtn: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  locationDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  reviewBtn: {
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  reviewBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  fitBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
  },
  locationBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
  },
});
