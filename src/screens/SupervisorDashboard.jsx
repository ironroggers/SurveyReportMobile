import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import * as Location from 'expo-location';
import {LOCATION_URL, AUTH_URL} from "../api-url";
import { showFeedbackForm } from '../utils/instabug';

export default function SupervisorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [surveyors, setSurveyors] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
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
  }, [JSON.stringify(currentUser)]);

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


  const fetchAssignedLocations = async () => {
    try {
      const response = await fetch(`${LOCATION_URL}/api/locations`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        return;
      }
      
      const data = await response.json();
      const locations = data?.data || [];

      // Create a map of surveyorId to array of their assigned locations
      const locationMap = {};
      locations.forEach(location => {
        if (location?.assignedTo) {
          if (!locationMap[location.assignedTo]) {
            locationMap[location.assignedTo] = [];
          }
          locationMap[location.assignedTo].push(location);
        }
      });

      setAssignedLocations(locationMap);
    } catch (err) {
      console.log('Error fetching locations:', err);
      Alert.alert('Error', `Failed to fetch locations: ${err.message}`);
    }
  };

  const fetchSurveyors = async () => {
    try {
      const response = await fetch(`${AUTH_URL}/api/auth/users`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }
      
      const data = await response.json();
      const surveyors = Array.isArray(data?.data)
        ? data?.data.filter(user =>
            user?.role === "SURVEYOR" &&
            user?.reportingTo &&
            user?.reportingTo._id.toString() === currentUser.id
          )
        : [];
      setSurveyors(surveyors);
    } catch (err) {
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
    // Get array of locations for this surveyor
    const surveyorLocations = assignedLocations[item._id] || [];

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <Text style={styles.status}>Status: {item.status === 1 ? 'Active' : 'Inactive'}</Text>
        <Text style={styles.lastLogin}>Last Login: {new Date(item.lastLogin).toLocaleString()}</Text>
        
        {surveyorLocations.length > 0 ? (
          <>
            <View style={styles.locationsContainer}>
              <Text style={styles.locationHeader}>Assigned Locations ({surveyorLocations.length}):</Text>
              {surveyorLocations.map((location) => (
                location && (
                  <View key={location._id} style={styles.locationInfo}>
                    <Text style={styles.locationTitle}>📍 {location.title}</Text>
                    <Text style={styles.locationDetails}>
                      Center: ({location.centerPoint?.coordinates?.[1]?.toFixed(6) || 'N/A'}, 
                      {location.centerPoint?.coordinates?.[0]?.toFixed(6) || 'N/A'})
                    </Text>
                    <Text style={styles.locationDetails}>Status: {location.status || 'N/A'}</Text>
                    <Text style={styles.locationDetails}>Radius: {location.radius || 0}m</Text>
                  </View>
                )
              ))}
            </View>
            
            {/* Show Assign Another Location button only when there are existing locations */}
            <TouchableOpacity
              style={[styles.assignBtn, { marginTop: 8 }]}
              onPress={() => handleAssignLocation(item._id)}
            >
              <Text style={styles.btnText}>Assign Another Location</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Show single Assign Location button when no locations are assigned
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchSurveyors(),
      fetchAssignedLocations(),
      getCurrentLocation()
    ]).finally(() => setRefreshing(false));
  }, [currentUser]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Supervisor Dashboard</Text>
          <Text style={styles.headerSubtitle}>{currentUser?.name || 'Welcome'}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.reviewBtn]}
          onPress={() => navigation.navigate('ReviewSurvey')}
        >
          <Text style={styles.actionButtonText}>📋 Review Surveys</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading surveyors...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{presentSurveyors.length}</Text>
              <Text style={styles.statLabel}>Active Surveyors</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{surveyors.length}</Text>
              <Text style={styles.statLabel}>Total Surveyors</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => {
              try {
                showFeedbackForm();
              } catch (error) {
                Alert.alert('Feedback Unavailable', 'Feedback feature is not available in this version.');
              }
            }}
          >
            <Text style={styles.feedbackButtonText}>Send Feedback</Text>
          </TouchableOpacity>

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1976D2']}
                tintColor="#1976D2"
              />
            }
          />
        </>
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
    marginBottom: 24,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  reviewBtn: {
    backgroundColor: '#FF9800',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    height: 300,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  name: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#1976D2',
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
    color: '#333',
  },
  lastLogin: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  assignBtn: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  btnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  locationsContainer: {
    marginTop: 12,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  locationHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  locationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
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
  logoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  logoutBtnText: {
    color: '#f44336',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  feedbackButton: {
    backgroundColor: '#9C27B0',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  feedbackButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
