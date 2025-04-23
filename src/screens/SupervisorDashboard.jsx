import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Marker } from 'react-native-maps';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import * as Location from 'expo-location';
import {LOCATION_URL, AUTH_URL} from "../api-url";
import { showFeedbackForm } from '../utils/instabug';
import SafeMapView from '../components/SafeMapView';
import { MaterialIcons } from '@expo/vector-icons';

// Logging utility to consistently format logs
const logEvent = (eventName, data = null) => {
  const logMessage = `[SupervisorDashboard] ${eventName}`;
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

export default function SupervisorDashboard({ navigation }) {
  logEvent('Component Mounted');
  
  const { logout } = useContext(AuthContext);
  const { currentUser, loading: userLoading, fetchCurrentUser } = useCurrentUser();
  
  logEvent('Current User', currentUser);
  logEvent('User Loading State', userLoading);
  
  const [surveyors, setSurveyors] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapRegion, setMapRegion] = useState({
    latitude: 17.385,
    longitude: 78.4867,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    logEvent('useEffect [currentUser, userLoading] triggered');
    
    try {
      if (currentUser) {
        logEvent('Current user exists, loading initial data');
        loadInitialData();
      } else if (!userLoading) {
        logEvent('No current user and not loading', { userLoading });
        // If we're not loading user data but don't have a user, show error
        setError('User data not available. Please log in again.');
        setLoading(false);
      }
    } catch (err) {
      logEvent('Error in useEffect', err);
      setError('An error occurred while initializing the dashboard.');
      setLoading(false);
    }
  }, [currentUser, userLoading]);

  const loadInitialData = async () => {
    logEvent('loadInitialData started');
    setLoading(true);
    try {
      // Run each function separately to prevent one failure from stopping others
      try {
        logEvent('Fetching surveyors');
        await fetchSurveyors();
        logEvent('Surveyors fetched successfully');
      } catch (error) {
        logEvent('Error fetching surveyors', error);
      }
      
      try {
        logEvent('Fetching assigned locations');
        await fetchAssignedLocations();
        logEvent('Assigned locations fetched successfully');
      } catch (error) {
        logEvent('Error fetching locations', error);
      }
      
      try {
        logEvent('Getting current location');
        await getCurrentLocation();
        logEvent('Current location retrieved successfully');
      } catch (error) {
        logEvent('Error getting current location', error);
      }
      
      logEvent('All initial data loaded');
    } catch (error) {
      logEvent('Error loading initial data', error);
      setError('Failed to load initial data. Please try again.');
    } finally {
      logEvent('Setting loading to false');
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    logEvent('getCurrentLocation started');
    try {
      logEvent('Requesting location permission');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logEvent('Location permission denied', { status });
        return;
      }
      
      logEvent('Getting current position');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      logEvent('Current position returned', { 
        hasLocation: !!location, 
        hasCoords: !!(location && location.coords),
        coords: location?.coords
      });

      if (location && location.coords) {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        logEvent('Setting current location', newLocation);
        setCurrentLocation(newLocation);
        
        logEvent('Setting map region');
        setMapRegion({
          ...newLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      logEvent('Error getting current location', error);
      // Silent failure, don't show alert to prevent crashes
    }
  };

  const fitMapToMarkers = () => {
    logEvent('fitMapToMarkers called');
    try {
      if (!mapRef?.current) {
        logEvent('Map ref is null, cannot fit to markers');
        return;
      }
      
      const points = [];
      
      // Add current location if available
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        logEvent('Adding current location to map points', currentLocation);
        points.push(currentLocation);
      }
      
      // Add surveyor locations with null checks
      if (Array.isArray(surveyors)) {
        logEvent('Processing surveyor locations', { surveyorsCount: surveyors.length });
        surveyors.forEach(surveyor => {
          if (surveyor && surveyor.location && 
              surveyor.location.latitude && 
              surveyor.location.longitude) {
            logEvent('Adding surveyor location to map points', {
              surveyorId: surveyor._id,
              location: surveyor.location
            });
            points.push(surveyor.location);
          }
        });
      }
      
      logEvent('Points for map fitting', { count: points.length, points });
      
      if (points.length > 0) {
        logEvent('Fitting map to coordinates');
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
        logEvent('Map fitted to coordinates');
      } else {
        logEvent('No points to fit map to');
      }
    } catch (error) {
      logEvent('Error fitting map to markers', error);
    }
  };

  const mapRef = React.useRef(null);

  const fetchAssignedLocations = async () => {
    logEvent('fetchAssignedLocations started');
    try {
      if (!LOCATION_URL) {
        logEvent('LOCATION_URL is undefined');
        setAssignedLocations({});
        return;
      }
      
      const apiUrl = `${LOCATION_URL}/api/locations`;
      logEvent('Fetching from URL', apiUrl);
      
      const response = await fetch(apiUrl);
      logEvent('Response received', { 
        ok: response?.ok, 
        status: response?.status 
      });
      
      if (!response || !response.ok) {
        logEvent('Error response from location API', {
          status: response?.status,
          statusText: response?.statusText
        });
        setAssignedLocations({});
        return;
      }
      
      const data = await response.json();
      logEvent('Location data parsed', { 
        hasData: !!data,
        dataLength: data?.data?.length || 0
      });
      
      const locations = data && data.data ? data.data : [];
      logEvent('Locations extracted', { count: locations.length });

      // Create a map of surveyorId to array of their assigned locations
      const locationMap = {};
      if (Array.isArray(locations)) {
        locations.forEach(location => {
          if (location && location.assignedTo) {
            logEvent('Processing location assignment', {
              locationId: location._id,
              assignedTo: location.assignedTo
            });
            
            if (!locationMap[location.assignedTo]) {
              locationMap[location.assignedTo] = [];
            }
            locationMap[location.assignedTo].push(location);
          }
        });
      }

      logEvent('Location map created', { 
        surveyorCount: Object.keys(locationMap).length 
      });
      
      setAssignedLocations(locationMap);
      logEvent('Assigned locations state updated');
    } catch (err) {
      logEvent('Error fetching locations', err);
      setAssignedLocations({});
    }
  };

  const fetchSurveyors = async () => {
    const url = `${AUTH_URL}/api/users?role=SURVEYOR`;
    console.log("url", url);
    logEvent('Fetching surveyors from URL', url);
    try {
      const response = await fetch(url);

      
      if (!response.ok) {
        throw new Error(`Failed to fetch surveyors: ${response.status}`);
      }
      
      const data = await response.json();
      logEvent('Surveyors fetched successfully', { count: data.length });
      setSurveyors(data);
      return data;
    } catch (err) {
      logEvent('Error fetching surveyors', err);
      throw err;
    }
  };

  // Function to filter surveyors based on search query
  const getFilteredSurveyors = useCallback(() => {
    logEvent('Filtering surveyors with query', { searchQuery });
    
    if (!searchQuery || searchQuery.trim() === '') {
      return surveyors;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return surveyors.filter(surveyor => {
      // Check if surveyor name matches
      const nameMatch = surveyor?.username?.toLowerCase().includes(query) || 
                       surveyor?.email?.toLowerCase().includes(query);
      
      if (nameMatch) return true;
      
      // Check if any of the assigned locations match
      if (surveyor?._id && assignedLocations[surveyor._id]) {
        return assignedLocations[surveyor._id].some(location => 
          location?.title?.toLowerCase().includes(query)
        );
      }
      
      return false;
    });
  }, [surveyors, assignedLocations, searchQuery]);
  
  // Get filtered surveyors based on search query
  const filteredSurveyors = getFilteredSurveyors();

  // Consider users with status 1 as present (from filtered surveyors)
  const presentSurveyors = Array.isArray(filteredSurveyors) 
    ? filteredSurveyors.filter((s) => s && s.status === 1)
    : [];
  
  logEvent('Present surveyors count', { 
    total: filteredSurveyors?.length || 0, 
    active: presentSurveyors?.length || 0 
  });

  const handleAssignLocation = (surveyorId) => {
    logEvent('handleAssignLocation called', { surveyorId });
    try {
      if (!surveyorId) {
        logEvent('Invalid surveyor ID');
        return;
      }
      
      if (!navigation) {
        logEvent('Navigation prop is undefined');
        return;
      }
      
      logEvent('Navigating to AssignLocation', { surveyorId });
      navigation.navigate('AssignLocation', { 
        surveyorId,
        onLocationAssigned: () => {
          logEvent('Location assigned callback triggered');
          fetchAssignedLocations();
        }
      });
    } catch (error) {
      logEvent('Error navigating to AssignLocation', error);
    }
  };

  const handleLogout = () => {
    logEvent('handleLogout called');
    try {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => logEvent('Logout canceled')
          },
          {
            text: 'Logout',
            onPress: () => {
              logEvent('Logout confirmed');
              if (typeof logout === 'function') {
                logout();
                logEvent('Logout function called');
              } else {
                logEvent('Logout function not available');
              }
            }
          }
        ]
      );
    } catch (error) {
      logEvent('Error during logout', error);
    }
  };

  const onRefresh = useCallback(() => {
    logEvent('onRefresh called');
    try {
      setRefreshing(true);
      setError(null);
      
      const refreshData = async () => {
        try {
          logEvent('Refreshing data started');
          // First refresh user data in case it changed
          if (typeof fetchCurrentUser === 'function') {
            logEvent('Refreshing current user');
            await fetchCurrentUser();
          }
          
          // Run each function separately to prevent one failure from stopping others
          try {
            logEvent('Refreshing surveyors');
            await fetchSurveyors();
          } catch (error) {
            logEvent('Error refreshing surveyors', error);
          }
          
          try {
            logEvent('Refreshing locations');
            await fetchAssignedLocations();
          } catch (error) {
            logEvent('Error refreshing locations', error);
          }
          
          try {
            logEvent('Refreshing current location');
            await getCurrentLocation();
          } catch (error) {
            logEvent('Error refreshing location', error);
          }
          
          logEvent('Refresh completed successfully');
        } catch (error) {
          logEvent('Error refreshing data', error);
        } finally {
          logEvent('Setting refreshing to false');
          setRefreshing(false);
        }
      };
      
      refreshData();
    } catch (error) {
      logEvent('Error in onRefresh', error);
      setRefreshing(false);
    }
  }, [currentUser]);

  // Log when render is called
  logEvent('Rendering component', {
    loading,
    userLoading,
    hasError: !!error,
    surveyorsCount: surveyors?.length,
    presentSurveyorsCount: presentSurveyors?.length
  });

  // Function to render a single surveyor card (previously used in FlatList)
  const renderSurveyorCard = (item) => {
    try {
      if (!item) {
        logEvent('renderSurveyorCard: null item, returning null');
        return null;
      }
      
      logEvent('Rendering surveyor', { 
        id: item._id, 
        username: item.username 
      });
      
      // Get array of locations for this surveyor with null checks
      const surveyorLocations = item._id && assignedLocations && 
                               assignedLocations[item._id] ? 
                               assignedLocations[item._id] : [];
      
      logEvent('Surveyor locations', { 
        surveyorId: item._id, 
        locationCount: surveyorLocations?.length || 0 
      });

      return (
        <View key={item._id || Math.random().toString()} style={styles.card}>
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
      logEvent('Error rendering surveyor', error);
      return (
        <View key={Math.random().toString()} style={styles.card}>
          <Text style={styles.errorText}>Error displaying this surveyor</Text>
        </View>
      );
    }
  };

  // Add a function to navigate to personal attendance
  const navigateToAttendance = () => {
    navigation.navigate('Attendance');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Supervisor Dashboard</Text>
              <Text style={styles.headerSubtitle}>
                {currentUser && currentUser.name ? currentUser.name : 'Welcome'}
              </Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.attendanceButton}
                onPress={navigateToAttendance}
              >
                <MaterialIcons name="access-time" size={24} color="#fff" />
                <Text style={styles.attendanceButtonText}>Attendance</Text>
              </TouchableOpacity>
            
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <MaterialIcons name="logout" size={24} color="#F44336" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewBtn]}
              onPress={() => {
                logEvent('Review Surveys button pressed');
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
                    {Array.isArray(filteredSurveyors) ? filteredSurveyors.length : 0}
                  </Text>
                  <Text style={styles.statLabel}>Total Surveyors</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.feedbackButton}
                onPress={() => {
                  logEvent('Feedback button pressed');
                  try {
                    if (typeof showFeedbackForm === 'function') {
                      showFeedbackForm();
                      logEvent('Feedback form opened');
                    } else {
                      logEvent('Feedback form function not available');
                    }
                  } catch (error) {
                    logEvent('Error showing feedback form', error);
                  }
                }}
              >
                <Text style={styles.feedbackButtonText}>Send Feedback</Text>
              </TouchableOpacity>

              <View style={styles.mapContainer}>
                <SafeMapView
                  ref={mapRef}
                  style={styles.map}
                  region={mapRegion}
                  onRegionChangeComplete={(region) => {
                    if (region) {
                      logEvent('Map region changed', region);
                      setMapRegion(region);
                    }
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  showsCompass={true}
                  zoomControlEnabled={true}
                  fallbackText="Map temporarily unavailable"
                  fallbackSubText={`Active surveyors: ${Array.isArray(presentSurveyors) ? presentSurveyors.length : 0}`}
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
                </SafeMapView>

                <TouchableOpacity 
                  style={styles.fitBtn} 
                  onPress={fitMapToMarkers}
                >
                  <Text style={styles.btnText}>Fit All Points</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by surveyor name or location"
                  value={searchQuery}
                  onChangeText={text => {
                    logEvent('Search query changed', { text });
                    setSearchQuery(text);
                  }}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity 
                    style={styles.clearButton}
                    onPress={() => {
                      logEvent('Clear search pressed');
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.surveyorsContainer}>
                <Text style={styles.sectionTitle}>
                  Surveyors {searchQuery ? `(${filteredSurveyors.length} results)` : ''}
                </Text>
                {filteredSurveyors.length > 0 ? (
                  filteredSurveyors.map(surveyor => renderSurveyorCard(surveyor))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      {searchQuery ? 'No surveyors found matching your search.' : 'No surveyors found.'}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 8,
    marginBottom: 6,
  },
  attendanceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginLeft: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  logoutButtonText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  surveyorsContainer: {
    marginTop: 10,
  },
  emptyState: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
  },
  searchContainer: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
