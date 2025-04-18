import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import {useCurrentUser} from "../hooks/useCurrentUser";
import {LOCATION_URL, SURVEY_URL} from "../api-url";

// New SurveyThumbnail component
const SurveyThumbnail = React.memo(({ thumbnailImage }) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  return (
    <View style={styles.thumbnailContainer}>
      {thumbnailImage ? (
        <>
          <Image 
            source={{ uri: thumbnailImage.url }}
            style={[
              styles.thumbnail,
              isImageLoading && styles.hiddenImage
            ]}
            onLoadStart={() => setIsImageLoading(true)}
            onLoad={() => setIsImageLoading(false)}
            onError={(error) => {
              console.error('Image loading error:', error);
              setImageError(true);
              setIsImageLoading(false);
            }}
          />
          {isImageLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color="#1976D2" />
            </View>
          )}
          {imageError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>!</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>📷</Text>
        </View>
      )}
    </View>
  );
});

export default function SurveyListScreen() {
  const [surveys, setSurveys] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const location = route.params?.location;
  const {currentUser} = useCurrentUser();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchSurveys().finally(() => setRefreshing(false));
  }, []);

  const fetchSurveys = async () => {
    try {
      setIsLoading(true);
      // Construct query parameters for filtering
      const queryParams = new URLSearchParams();
      
      // Add location filter if a location is assigned
      if (location?._id) {
        queryParams.append('location', location._id);
        queryParams.append('assignedTo', currentUser?.id);
      }
      const response = await fetch(`${SURVEY_URL}/api/surveys?${queryParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        // If location is assigned, only show surveys within the geofence
        if (location?.geofence?.coordinates[0]) {
          const filteredSurveys = result.data.filter(survey => {
            const surveyLat = survey.terrainData?.centerPoint?.coordinates[1];
            const surveyLng = survey.terrainData?.centerPoint?.coordinates[0];
            
            if (!surveyLat || !surveyLng) return false;
            
            // Check if the survey point is within the geofence polygon
            return isPointInPolygon(
              { lat: surveyLat, lng: surveyLng },
              location.geofence.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
            );
          });
          setSurveys(filteredSurveys);
        } else {
          setSurveys(result.data);
        }
      } else {
        console.log('Error', 'Failed to fetch surveys');
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
      Alert.alert('Error', 'Failed to fetch surveys');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check if a point is inside a polygon
  const isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat))
          && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  useEffect(() => {
    if (location) {
      // Set initial map region based on the assigned location
      setMapRegion({
        latitude: location.centerPoint.coordinates[1],
        longitude: location.centerPoint.coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [location]);

  useEffect(() => {
    if (isFocused) {
      setTimeout(() => {
        getCurrentLocation();
        fetchSurveys();
      }, 1000);

    }
  }, [isFocused, currentUser]);

  useEffect(() => {
    if (route.params?.newSurvey) {
      const existingIndex = surveys.findIndex(s => s.id === route.params.newSurvey.id);
      
      setSurveys(prevSurveys => {
        const updated = [...prevSurveys];
        if (existingIndex > -1) {
          updated[existingIndex] = route.params.newSurvey;
        } else {
          updated.push(route.params.newSurvey);
        }
        return updated;
      });
      
      // Clear the params after handling them
      navigation.setParams({ newSurvey: null });
    }
  }, [route.params?.newSurvey]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions to use this feature');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setCurrentLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // If no assigned location, center map on current location
      if (!location) {
        setMapRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert('Error', 'Unable to get your current location');
    }
  };

  const handleAddSurvey = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Please wait for your current location to be determined');
      return;
    }

    // If there's an assigned location with a geofence, validate the point
    if (location?.geofence?.coordinates[0]) {
      const isInside = isPointInPolygon(
        { 
          lat: currentLocation.latitude, 
          lng: currentLocation.longitude 
        },
        location.geofence.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
      );

      if (!isInside) {
        Alert.alert(
          'Invalid Location',
          'You can only add survey points within the assigned location area.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    navigation.navigate('SurveyForm', {
      currentLocation,
      location: route.params?.location,
    });
  };

  const handleEditSurvey = (survey) => {
    navigation.navigate('SurveyForm', { 
      existingSurvey: survey,
      currentLocation,
    });
  };

  const handleSubmitLocation = async (location) => {
    try {
      setIsSubmitting(true);
      // Make PUT request to update location status
      const response = await fetch(`${LOCATION_URL}/api/locations/${location._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          ...location,
          status: 'COMPLETED',
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error updating location:', errorText);
        Alert.alert('Error', 'Failed to update location status');
        return;
      }

      Alert.alert(
        'Success',
        'Location has been marked as completed',
        [
          {
            text: 'OK',
            onPress: () => {
              // Force immediate navigation
              navigation.reset({
                index: 0,
                routes: [{ name: 'SurveyorDashboard' }],
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error updating location status:', error);
      Alert.alert('Error', 'Failed to update location status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSurveyItem = ({ item }) => {
    // Add safety checks for nested properties
    const latitude = item?.terrainData?.centerPoint?.coordinates?.[1];
    const longitude = item?.terrainData?.centerPoint?.coordinates?.[0];
    const coordinates = latitude !== undefined && longitude !== undefined
      ? `📍 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      : '📍 Location not available';

    // Get the first image from mediaFiles to display as thumbnail
    const thumbnailImage = item?.mediaFiles?.find(file => file.fileType === 'IMAGE');
    const mediaCount = item?.mediaFiles?.length || 0;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleEditSurvey(item)}>
        <View style={styles.cardContent}>
          <SurveyThumbnail thumbnailImage={thumbnailImage} />
          <View style={styles.cardDetails}>
            <Text style={styles.title}>{item?.title || 'Untitled Survey'}</Text>
            <Text style={styles.coordinates}>{coordinates}</Text>
            <Text style={styles.detail}>Description: {item?.description?.slice(0, 50)}{item?.description?.length > 50 ? '...' : ''}</Text>
            <Text style={styles.terrainType}>Terrain: {item?.terrainData?.terrainType || 'Not specified'}</Text>
            <Text style={styles.status}>Status: {item?.status === 1 ? 'Active' : 'Inactive'}</Text>
            <Text style={styles.mediaCount}>📎 {mediaCount} attachment{mediaCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const toggleMapSize = () => {
    setIsMapExpanded(!isMapExpanded);
  };

  const fitMapToMarkers = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add current location
      if (currentLocation) {
        points.push(currentLocation);
      }
      
      // Add survey points
      surveys.forEach(survey => {
        if (survey.terrainData?.centerPoint?.coordinates) {
          points.push({
            latitude: survey.terrainData.centerPoint.coordinates[1],
            longitude: survey.terrainData.centerPoint.coordinates[0]
          });
        }
      });
      
      // Add geofence points if available
      if (location?.geofence?.coordinates[0]) {
        location.geofence.coordinates[0].forEach(([lng, lat]) => {
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

  const mapRef = React.useRef(null);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={[styles.map, isMapExpanded && styles.expandedMap]}
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

        {/* Show survey markers */}
        {surveys.map((survey, index) => (
          <Marker
            key={`survey-${index}`}
            coordinate={{
              latitude: survey.terrainData.centerPoint.coordinates[1],
              longitude: survey.terrainData.centerPoint.coordinates[0]
            }}
            pinColor="#1976D2"
          />
        ))}

        {/* Show assigned location geofence */}
        {location?.geofence?.coordinates[0]?.length > 0 && (
          <Polygon
            coordinates={location.geofence.coordinates[0].map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor="#FF0000"
            fillColor="rgba(255,0,0,0.2)"
            strokeWidth={2}
          />
        )}
      </MapView>

      <TouchableOpacity style={styles.zoomToggle} onPress={toggleMapSize}>
        <Text style={styles.fabText}>{isMapExpanded ? "Minimize Map" : "Expand Map"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fitMarkersBtn} onPress={fitMapToMarkers}>
        <Text style={styles.fabText}>Fit All Points</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.fab, isMapExpanded && styles.fabExpanded]} onPress={handleAddSurvey}>
        <Text style={styles.fabText}>+ Add Survey Point</Text>
      </TouchableOpacity>

      <View style={[styles.listContainer, isMapExpanded && styles.hiddenList]}>
        <Text style={styles.listHeader}>📋 Survey Points ({surveys.length})</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#1976D2" style={styles.loader} />
        ) : (
          <FlatList
            data={surveys}
            keyExtractor={(item) => item._id}
            renderItem={renderSurveyItem}
            contentContainerStyle={[styles.listContainer, isMapExpanded && styles.hiddenList]}
            ListEmptyComponent={
              !isLoading && (
                <Text style={styles.emptyText}>
                  No surveys found
                </Text>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1976D2']}
                tintColor="#1976D2"
              />
            }
          />
        )}
      </View>
      
      {location && !isMapExpanded && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={() => {
                handleSubmitLocation(location).then(navigation.goBack())
              }
            }
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit & Complete Location</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#fff',
  },
  map: { 
    height: Dimensions.get('window').height * 0.4,
  },
  expandedMap: { 
    height: Dimensions.get('window').height * 0.9,
  },
  fab: {
    position: 'absolute',
    bottom: Dimensions.get('window').height * 0.6 + 10,
    right: 16,
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
    zIndex: 10,
  },
  fabExpanded: {
    bottom: 20,
  },
  zoomToggle: {
    position: 'absolute',
    top: 10,
    right: 16,
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    zIndex: 10,
  },
  fitMarkersBtn: {
    position: 'absolute',
    top: 10,
    left: 16,
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    zIndex: 10,
  },
  fabText: { 
    color: '#fff',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  hiddenList: {
    display: 'none',
  },
  listHeader: { 
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
  },
  thumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  hiddenImage: {
    opacity: 0,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorText: {
    fontSize: 24,
    color: '#ff0000',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    fontSize: 24,
  },
  cardDetails: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  coordinates: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  terrainType: {
    color: '#444',
    marginTop: 4,
    fontWeight: '500',
  },
  status: {
    color: '#1976D2',
    marginTop: 4,
    fontWeight: '500',
  },
  mediaCount: {
    color: '#666',
    marginTop: 4,
    fontSize: 12,
  },
  loader: {
    marginTop: 20,
  },
  detail: {
    color: '#555',
    marginTop: 4,
    fontSize: 14,
  },
  emptyText: { 
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 4,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
