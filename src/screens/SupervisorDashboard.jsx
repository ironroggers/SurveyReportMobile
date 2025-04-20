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
  const { currentUser, loading: userLoading, fetchCurrentUser } = useCurrentUser();
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
    try {
      if (currentUser) {
        loadInitialData();
      } else if (!userLoading) {
        // If we're not loading user data but don't have a user, show error
        setError('User data not available. Please log in again.');
        setLoading(false);
      }
    } catch (err) {
      console.log('Error in useEffect:', err);
      setError('An error occurred while initializing the dashboard.');
      setLoading(false);
    }
  }, [currentUser, userLoading]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Run each function separately to prevent one failure from stopping others
      try {
        await fetchSurveyors();
      } catch (error) {
        console.log('Error fetching surveyors:', error);
      }
      
      try {
        await fetchAssignedLocations();
      } catch (error) {
        console.log('Error fetching locations:', error);
      }
      
      try {
        await getCurrentLocation();
      } catch (error) {
        console.log('Error getting current location:', error);
      }
    } catch (error) {
      console.log('Error loading initial data:', error);
      setError('Failed to load initial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (location && location.coords) {
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
      }
    } catch (error) {
      console.log('Error getting current location:', error);
      // Silent failure, don't show alert to prevent crashes
    }
  };

  const fitMapToMarkers = () => {
    try {
      if (!mapRef?.current) return;
      
      const points = [];
      
      // Add current location if available
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        points.push(currentLocation);
      }
      
      // Add surveyor locations with null checks
      if (Array.isArray(surveyors)) {
        surveyors.forEach(surveyor => {
          if (surveyor && surveyor.location && 
              surveyor.location.latitude && 
              surveyor.location.longitude) {
            points.push(surveyor.location);
          }
        });
      }
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.log('Error fitting map to markers:', error);
    }
  };

  const mapRef = React.useRef(null);


  const fetchAssignedLocations = async () => {
    try {
      if (!LOCATION_URL) {
        console.log('LOCATION_URL is undefined');
        setAssignedLocations({});
        return;
      }
      
      const response = await fetch(`${LOCATION_URL}/api/locations`);
      
      if (!response || !response.ok) {
        console.log('Error response from location API');
        setAssignedLocations({});
        return;
      }
      
      const data = await response.json();
      const locations = data && data.data ? data.data : [];

      // Create a map of surveyorId to array of their assigned locations
      const locationMap = {};
      if (Array.isArray(locations)) {
        locations.forEach(location => {
          if (location && location.assignedTo) {
            if (!locationMap[location.assignedTo]) {
              locationMap[location.assignedTo] = [];
            }
            locationMap[location.assignedTo].push(location);
          }
        });
      }

      setAssignedLocations(locationMap);
    } catch (err) {
      console.log('Error fetching locations:', err);
      setAssignedLocations({});
    }
  };

  const fetchSurveyors = async () => {
    // Set error to null at the start to clear any previous errors
    setError(null);
    
    try {
      if (!currentUser || !currentUser.id) {
        console.log('Cannot fetch surveyors: currentUser or currentUser.id is missing');
        setSurveyors([]);
        return;
      }

      if (!AUTH_URL) {
        console.log('AUTH_URL is undefined');
        setSurveyors([]);
        return;
      }

      const response = await fetch(`${AUTH_URL}/api/auth/users`);
      
      if (!response || !response.ok) {
        console.log('Error response from auth API');
        setSurveyors([]);
        return;
      }
      
      const data = await response.json();
      if (!data || !Array.isArray(data.data)) {
        console.log('Invalid surveyors data format:', data);
        setSurveyors([]);
        return;
      }
      
      // Add null checks for filtering
      const filteredSurveyors = data.data.filter(user =>
        user && 
        user.role === "SURVEYOR" &&
        user.reportingTo &&
        user.reportingTo._id &&
        currentUser && 
        currentUser.id && 
        user.reportingTo._id.toString() === currentUser.id
      );
      
      setSurveyors(filteredSurveyors || []);
    } catch (err) {
      console.log('Error fetching surveyors:', err);
      setSurveyors([]);
    }
  };

  // Consider users with status 1 as present
  const presentSurveyors = Array.isArray(surveyors) 
    ? surveyors.filter((s) => s && s.status === 1)
    : [];

  const handleAssignLocation = (surveyorId) => {
    try {
      if (!surveyorId) {
        console.log('Invalid surveyor ID');
        return;
      }
      
      if (!navigation) {
        console.log('Navigation prop is undefined');
        return;
      }
      
      navigation.navigate('AssignLocation', { 
        surveyorId,
        onLocationAssigned: () => {
          fetchAssignedLocations();
        }
      });
    } catch (error) {
      console.log('Error navigating to AssignLocation:', error);
    }
  };

  const handleLogout = () => {
    try {
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
            onPress: () => {
              if (typeof logout === 'function') {
                logout();
              } else {
                console.log('Logout function not available');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.log('Error during logout:', error);
    }
  };

  const renderSurveyor = ({ item }) => {
    try {
      if (!item) return null;
      
      // Get array of locations for this surveyor with null checks
      const surveyorLocations = item._id && assignedLocations && 
                               assignedLocations[item._id] ? 
                               assignedLocations[item._id] : [];

      return (
        <View style={styles.card}>
          <Text style={styles.name}>{item.username || 'Unknown'}</Text>
          <Text style={styles.email}>{item.email || 'No email'}</Text>
          <Text style={styles.status}>Status: {item.status === 1 ? 'Active' : 'Inactive'}</Text>
          <Text style={styles.lastLogin}>
            Last Login: {item.lastLogin ? new Date(item.lastLogin).toLocaleString() : 'Unknown'}
          </Text>
          
          {Array.isArray(surveyorLocations) && surveyorLocations.length > 0 ? (
            <>
              <View style={styles.locationsContainer}>
                <Text style={styles.locationHeader}>
                  Assigned Locations ({surveyorLocations.length}):
                </Text>
                {surveyorLocations.map((location) => (
                  location && location._id ? (
                    <View key={location._id} style={styles.locationInfo}>
                      <Text style={styles.locationTitle}>📍 {location.title || 'Unnamed Location'}</Text>
                      <Text style={styles.locationDetails}>
                        Center: ({
                          location.centerPoint && 
                          location.centerPoint.coordinates && 
                          location.centerPoint.coordinates[1] ? 
                          location.centerPoint.coordinates[1].toFixed(6) : 'N/A'
                        },
                        {
                          location.centerPoint && 
                          location.centerPoint.coordinates && 
                          location.centerPoint.coordinates[0] ? 
                          location.centerPoint.coordinates[0].toFixed(6) : 'N/A'
                        })
                      </Text>
                      <Text style={styles.locationDetails}>Status: {location.status || 'N/A'}</Text>
                      <Text style={styles.locationDetails}>Radius: {location.radius || 0}m</Text>
                    </View>
                  ) : null
                ))}
              </View>
              
              {item._id && (
                <TouchableOpacity
                  style={[styles.assignBtn, { marginTop: 8 }]}
                  onPress={() => handleAssignLocation(item._id)}
                >
                  <Text style={styles.btnText}>Assign Another Location</Text>
                </TouchableOpacity>
              )}
            </>
          ) : item._id ? (
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => handleAssignLocation(item._id)}
            >
              <Text style={styles.btnText}>Assign Location</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    } catch (error) {
      console.log('Error rendering surveyor:', error);
      return (
        <View style={styles.card}>
          <Text style={styles.errorText}>Error displaying this surveyor</Text>
        </View>
      );
    }
  };

  const onRefresh = useCallback(() => {
    try {
      setRefreshing(true);
      setError(null);
      
      const refreshData = async () => {
        try {
          // First refresh user data in case it changed
          if (typeof fetchCurrentUser === 'function') {
            await fetchCurrentUser();
          }
          
          // Run each function separately to prevent one failure from stopping others
          try {
            await fetchSurveyors();
          } catch (error) {
            console.log('Error refreshing surveyors:', error);
          }
          
          try {
            await fetchAssignedLocations();
          } catch (error) {
            console.log('Error refreshing locations:', error);
          }
          
          try {
            await getCurrentLocation();
          } catch (error) {
            console.log('Error refreshing location:', error);
          }
        } catch (error) {
          console.log('Error refreshing data:', error);
        } finally {
          setRefreshing(false);
        }
      };
      
      refreshData();
    } catch (error) {
      console.log('Error in onRefresh:', error);
      setRefreshing(false);
    }
  }, [currentUser]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Supervisor Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {currentUser && currentUser.name ? currentUser.name : 'Welcome'}
          </Text>
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
          onPress={() => {
            if (navigation) {
              navigation.navigate('ReviewSurvey');
            }
          }}
        >
          <Text style={styles.actionButtonText}>📋 Review Surveys</Text>
        </TouchableOpacity>
      </View>

      {loading || userLoading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading surveyors...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Array.isArray(presentSurveyors) ? presentSurveyors.length : 0}
              </Text>
              <Text style={styles.statLabel}>Active Surveyors</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Array.isArray(surveyors) ? surveyors.length : 0}
              </Text>
              <Text style={styles.statLabel}>Total Surveyors</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => {
              try {
                if (typeof showFeedbackForm === 'function') {
                  showFeedbackForm();
                } else {
                  console.log('Feedback form function not available');
                }
              } catch (error) {
                console.log('Error showing feedback form:', error);
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
              onRegionChangeComplete={(region) => {
                if (region) setMapRegion(region);
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              zoomControlEnabled={true}
            >
              {/* Show current location marker */}
              {currentLocation && 
               currentLocation.latitude && 
               currentLocation.longitude && (
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                  pinColor="#4CAF50"
                />
              )}

              {/* Show surveyor markers */}
              {Array.isArray(presentSurveyors) && presentSurveyors.map((s) => (
                s && s._id && s.location && 
                s.location.latitude && s.location.longitude && (
                  <Marker
                    key={s._id}
                    coordinate={s.location}
                    title={s.username || 'Unknown'}
                    description="Current Location"
                    pinColor="#1976D2"
                  />
                )
              ))}
            </MapView>

            <TouchableOpacity 
              style={styles.fitBtn} 
              onPress={fitMapToMarkers}
            >
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
            data={Array.isArray(surveyors) ? surveyors : []}
            keyExtractor={(item) => item && item._id ? item._id : Math.random().toString()}
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
  retryButton: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
    minWidth: 120,
  },
  retryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
});
