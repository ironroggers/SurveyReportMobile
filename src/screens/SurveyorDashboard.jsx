import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, RefreshControl, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import {LOCATION_URL} from "../api-url";
import { showFeedbackForm } from '../utils/instabug';
import SafeMapView from '../components/SafeMapView';

export default function SurveyorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser } = useCurrentUser();
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const isFocused = useIsFocused();

  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const filteredLocations = locations.filter(location => {
    if (selectedFilter === 'ALL') return true;
    return location.status === selectedFilter;
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
      console.log('Error getting location:', error);
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
      const response = await fetch(`${LOCATION_URL}/api/locations?assignedTo=${currentUser?.id}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.log('API Error:', errorData);
        Alert.alert('Error', 'Failed to fetch assigned locations');
        setLocations([]);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data?.data)) {
        console.log('Invalid location data format:', data);
        Alert.alert('Error', 'Invalid data format received from server');
        setLocations([]);
        setLoading(false);
        return;
      }

      // Validate location structure
      const validLocations = data.data.filter(location => {
        const isValid = location && 
          location.centerPoint?.coordinates?.length === 2 &&
          location.geofence?.coordinates?.[0]?.length > 0;
        
        if (!isValid) {
          console.log('Invalid location structure:', location);
        }
        return isValid;
      });

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
      Alert.alert('Error', 'Unable to get locations');
      setLocations([]);
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
      // Check if there's any active survey
      const activeLocation = locations.find(loc => loc.status === 'ACTIVE');
      if (activeLocation) {
        Alert.alert(
          'Active Survey Exists',
          'Please complete the active survey before starting a new one.',
          [
            {
              text: 'View Active Survey',
              onPress: () => navigation.navigate('SurveyList', { location: activeLocation })
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

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
        return;
      }

      // Navigate to survey list after successful update
      navigation.navigate('SurveyList', { location });
    } catch (error) {
      console.log('Error updating location status:', error);
      Alert.alert('Error', 'Failed to update location status');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchAssignedLocations(),
        getCurrentLocation()
      ]);
    } catch (error) {
      console.log('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  // Add useEffect for screen focus
  useEffect(() => {
    if (isFocused) {
      onRefresh();
    }
  }, [isFocused]);

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
          ) : (item.status === 'COMPLETED' || item.status === 'APPROVED') ? (
            <TouchableOpacity
              style={[styles.surveyBtn, { backgroundColor: '#FF9800' }]}
              onPress={() => navigation.navigate('ReviewDetails', { 
                locationId: item._id, 
                status: item.status, 
                reviewComment: item.reviewComment,
                isViewOnly: true 
              })}
            >
              <Text style={styles.btnText}>View Survey</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.surveyBtn}
              onPress={() => handleStartSurvey(item)}
            >
              <Text style={styles.btnText}>Start Survey</Text>
            </TouchableOpacity>
          )
        ) : (
          (item.status === 'COMPLETED' || item.status === 'APPROVED') ? (
            <TouchableOpacity
              style={[styles.surveyBtn, { backgroundColor: '#FF9800' }]}
              onPress={() => navigation.navigate('ReviewDetails', { 
                locationId: item._id, 
                status: item.status, 
                reviewComment: item.reviewComment,
                isViewOnly: true 
              })}
            >
              <Text style={styles.btnText}>View Survey</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.markNote}>Mark attendance to begin survey.</Text>
          )
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Surveyor Dashboard</Text>
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
            style={[styles.actionButton, styles.attendanceViewBtn]}
            onPress={() => navigation.navigate('Attendance')}
          >
            <Text style={styles.actionButtonText}>View Attendance</Text>
          </TouchableOpacity>

          {!attendanceMarked && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.markAttendanceBtn]}
              onPress={handleMarkAttendance}
            >
              <Text style={styles.actionButtonText}>Mark Attendance</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, styles.feedbackBtn]}
            onPress={() => {
              try {
                showFeedbackForm();
              } catch (error) {
                Alert.alert('Feedback Unavailable', 'Feedback feature is not available in this version.');
              }
            }}
          >
            <Text style={styles.actionButtonText}>Send Feedback</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <SafeMapView
            ref={mapRef}
            style={styles.map}
            region={initialRegion}
            onRegionChangeComplete={region => setInitialRegion(region)}
            showsUserLocation={true}
            fallbackText="Map temporarily unavailable"
            fallbackSubText={`${filteredLocations.length} assigned locations`}
          >
            {/* Current Location Marker */}
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
                description="Your current position"
                pinColor="#4CAF50"
              />
            )}

            {/* Location Markers and Polygons */}
            {filteredLocations.map((location) => {
              // Check if location has valid coordinates
              if (!location?.centerPoint?.coordinates || 
                 !location?.geofence?.coordinates?.[0] ||
                 location.geofence.coordinates[0].length < 3) {
                console.log('Invalid location data for polygon:', location._id);
                return null;
              }

              // Create polygon coordinates array
              const polygonCoords = location.geofence.coordinates[0].map(([lng, lat]) => ({
                latitude: lat,
                longitude: lng,
              }));

              // Create center point coordinates
              const centerCoord = {
                latitude: location.centerPoint.coordinates[1],
                longitude: location.centerPoint.coordinates[0],
              };

              return (
                <React.Fragment key={location._id}>
                  <Marker
                    coordinate={centerCoord}
                    title={location.title}
                    description={`Status: ${location.status}`}
                    pinColor={location._id === selectedLocation?._id ? '#FF9800' : '#1976D2'}
                    onPress={() => handleLocationPress(location)}
                  />
                  <Polygon
                    coordinates={polygonCoords}
                    strokeColor={location._id === selectedLocation?._id ? '#FF9800' : '#1976D2'}
                    fillColor={location._id === selectedLocation?._id ? 'rgba(255, 152, 0, 0.2)' : 'rgba(25, 118, 210, 0.2)'}
                    strokeWidth={2}
                    tappable
                    onPress={() => handleLocationPress(location)}
                  />
                </React.Fragment>
              );
            })}
          </SafeMapView>

          <TouchableOpacity
            style={styles.fitBtn}
            onPress={fitMapToPoints}
            activeOpacity={0.8}
          >
            <Text style={styles.fitBtnText}>Fit Map</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  selectedFilter === option.value && styles.filterButtonActive
                ]}
                onPress={() => setSelectedFilter(option.value)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedFilter === option.value && styles.filterButtonTextActive
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <Text>Loading assigned locations...</Text>
          </View>
        ) : filteredLocations.length === 0 ? (
          <View style={styles.centerContent}>
            <Text>No {selectedFilter !== 'ALL' ? selectedFilter.toLowerCase() : ''} locations found.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </ScrollView>
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
    gap: 12,
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
  attendanceViewBtn: {
    backgroundColor: '#2196F3',
  },
  markAttendanceBtn: {
    backgroundColor: '#4CAF50',
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
  fitBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  filterButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackBtn: {
    backgroundColor: '#9C27B0',
    marginTop: 10,
  },
});
