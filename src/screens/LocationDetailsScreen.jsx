import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, SafeAreaView, ActivityIndicator, Platform, FlatList, RefreshControl, StatusBar, Modal, PanResponder, Animated } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCurrentUser } from "../hooks/useCurrentUser";
import { LOCATION_URL, SURVEY_URL, AUTH_URL } from "../api-url";
import SafeMapView from '../components/SafeMapView';
import { Marker, Polyline } from 'react-native-maps';
import axios from 'axios';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';

// Google Maps API keys for different platforms
const GOOGLE_MAPS_API_KEYS = {
  ios: 'AIzaSyC2pds2TL5_lGUM-7Y1CFiGq8Wrn0oULr0', // Replace with your iOS API key
  android: 'AIzaSyC2pds2TL5_lGUM-7Y1CFiGq8Wrn0oULr0', // Replace with your Android API key
};

export default function LocationDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const locationId = route.params?.location?._id;
  const newSurvey = route.params?.newSurvey;
  console.log("Route params", route.params);
  const { currentUser } = useCurrentUser();
  const mapRef = useRef(null);
  
  // Check if user is a supervisor
  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  console.log("Current user role:", currentUser?.role, "Is supervisor:", isSupervisor);
  
  // Get the appropriate API key based on platform
  const getGoogleMapsApiKey = () => {
    return Platform.OS === 'ios' 
      ? GOOGLE_MAPS_API_KEYS.ios 
      : GOOGLE_MAPS_API_KEYS.android;
  };
  
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationData, setLocationData] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [walkingDirections, setWalkingDirections] = useState([]);
  const [mapError, setMapError] = useState(null);
  const [directionsError, setDirectionsError] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state variables for assignment modal
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSurveyor, setSelectedSurveyor] = useState(null);
  const [surveyors, setSurveyors] = useState([]);
  const [loadingSurveyors, setLoadingSurveyors] = useState(false);
  
  // New state variables for reportees
  const [reportees, setReportees] = useState([]);
  const [selectedReportee, setSelectedReportee] = useState(null);
  const [loadingReportees, setLoadingReportees] = useState(false);
  
  // Track whether the submit button is visible for debugging
  const [buttonVisible, setButtonVisible] = useState(true);
  
  // New state for resizable containers with animated values
  const [mapHeight, setMapHeight] = useState(height * 0.4); // Default map height - 40% of screen
  const animatedMapHeight = useRef(new Animated.Value(height * 0.4)).current;
  const [dragging, setDragging] = useState(false);
  const animatedHandleOpacity = useRef(new Animated.Value(1)).current;
  
  // Create panResponder for resizing with improved handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setDragging(true);
        // Store the current height value to avoid jumps
        animatedMapHeight.__lastValue = mapHeight;
        // Animate the handle to be more visible during drag
        Animated.timing(animatedHandleOpacity, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new height within bounds
        const newHeight = Math.max(
          height * 0.2, // Minimum map height (20% of screen)
          Math.min(height * 0.75, animatedMapHeight.__lastValue + gestureState.dy) // Maximum map height (75% of screen)
        );
        
        // Directly set the animated value without updating state during drag
        animatedMapHeight.setValue(newHeight);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setDragging(false);
        // Get the final height from the animated value
        const finalHeight = animatedMapHeight._value || animatedMapHeight.__getValue();
        
        // Update the state once at the end of the drag
        setMapHeight(finalHeight);
        
        // Animate the handle back to normal
        Animated.timing(animatedHandleOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
        
        // Fit map to coordinates after resize with a small delay
        if (mapRef.current && routeCoordinates.length > 0) {
          setTimeout(() => fitAllPoints(), 100);
        }
      }
    })
  ).current;
  
  // Fetch location data
  const fetchLocationData = useCallback(async () => {
    console.log("LocationDetailsScreen: fetching data for ID:", locationId);

    // Request location permissions regardless of locationId
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log("Location permission denied");
        Alert.alert("Permission Denied", "Location permission is required to show your current position on the map.");
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
    }

    if (!locationId) {
      console.log("LocationDetailsScreen: No locationId provided");
      // Default to user's current location if no ID provided
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = location.coords;
          console.log("LocationDetailsScreen: Using current location:", latitude, longitude);
          
          setMapRegion({
            latitude,
            longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      } catch (error) {
        console.error("Error getting current location:", error);
      }
      setIsLoading(false);
      return;
    }
    
    try {
      console.log("LocationDetailsScreen: Fetching from API:", `${LOCATION_URL}/api/locations/${locationId}`);
      const response = await axios.get(`${LOCATION_URL}/api/locations/${locationId}`);
      console.log("LocationDetailsScreen: API response received");
      
      if (response.data && response.data.success) {
        const data = response.data.data;
        console.log("LocationDetailsScreen: Location data received:", JSON.stringify(data, null, 2));
        setLocationData(data);
        
        if (!data.route || data.route.length === 0) {
          console.warn("LocationDetailsScreen: No route data found in API response");
          setMapError("No route data available for this location");
          setIsLoading(false);
          return;
        }
        
        // Extract and validate route points from the new format
        const routePoints = [];
        
        data.route.forEach((waypoint, index) => {
          // Check if waypoint has valid latitude and longitude
          if (waypoint.latitude !== undefined && waypoint.longitude !== undefined) {
            const latitude = parseFloat(waypoint.latitude);
            const longitude = parseFloat(waypoint.longitude);
            
            if (!isNaN(latitude) && !isNaN(longitude)) {
              routePoints.push({
                latitude,
                longitude,
                title: waypoint.place || `Point ${index + 1}`,
                description: waypoint.type || '',
                id: `waypoint-${index}`
              });
              console.log(`Point ${index}:`, latitude, longitude);
            } else {
              console.warn(`Invalid coordinates at index ${index}:`, waypoint);
            }
          } else {
            console.warn(`Missing latitude/longitude at index ${index}:`, waypoint);
          }
        });
        
        console.log("LocationDetailsScreen: Extracted route points:", routePoints.length);
        
        if (routePoints.length === 0) {
          console.warn("LocationDetailsScreen: No valid coordinates found in route data");
          setMapError("Invalid coordinates in route data");
          
          // Set default region as fallback
          setMapRegion({
            latitude: 10.118542, // Default location
            longitude: 76.248265,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          
          setIsLoading(false);
          return;
        }
        
        // Set route coordinates
        setRouteCoordinates(routePoints);
        
        // Set initial map region to the first point
        const initialRegion = {
          latitude: routePoints[0].latitude,
          longitude: routePoints[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        console.log("LocationDetailsScreen: Setting map region:", initialRegion);
        setMapRegion(initialRegion);
        
        // Calculate optimal walking route
        calculateWalkingDirections(routePoints);
      } else {
        console.warn("API returned success=false:", response.data);
        setMapError("API returned an unsuccessful response");
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching location data:', error);
      setMapError(`Failed to fetch location data: ${error.message}`);
      Alert.alert('Error', 'Failed to fetch location data');
      
      // Set default map region
      setMapRegion({
        latitude: 10.118542, // Default from the sample data
        longitude: 76.248265,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setIsLoading(false);
    }
  }, [locationId]);

  // Fetch surveys for this location
  const fetchSurveysForLocation = useCallback(async () => {
    if (!locationId) return;
    
    try {
      setSurveysLoading(true);
      console.log(`Fetching surveys for location ${locationId}`, "URL :", `${SURVEY_URL}/api/surveys?location=${locationId}`);
      
      const response = await fetch(`${SURVEY_URL}/api/surveys?location=${locationId}`);
      
      if (!response.ok) {
        console.error(`Error fetching surveys: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log(`Found ${data.data?.length || 0} surveys for this location`);
      setSurveys(data.data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setSurveysLoading(false);
      setRefreshing(false); // End refreshing state
    }
  }, [locationId]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    console.log('Pull-to-refresh triggered');
    setRefreshing(true);
    fetchSurveysForLocation();
  }, [fetchSurveysForLocation]);

  // Update data when screen is focused and when a new survey is added
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, refreshing data");
      setIsLoading(true);
      fetchLocationData();
      fetchSurveysForLocation();
    }, [fetchLocationData, fetchSurveysForLocation])
  );

  // This useEffect handles updating when newSurvey is passed in params
  useEffect(() => {
    if (newSurvey) {
      console.log('New survey added, refreshing survey list:', newSurvey);
      
      // If we already have this survey in the list, update it
      // Otherwise, add it to the beginning of the list
      const existingSurveyIndex = surveys.findIndex(s => s._id === newSurvey._id);
      
      if (existingSurveyIndex >= 0) {
        console.log('Updating existing survey in list');
        const updatedSurveys = [...surveys];
        updatedSurveys[existingSurveyIndex] = newSurvey;
        setSurveys(updatedSurveys);
      } else {
        console.log('Adding new survey to list');
        setSurveys(prevSurveys => [newSurvey, ...prevSurveys]);
      }
      
      // Clean up the newSurvey param after handling it
      navigation.setParams({ newSurvey: null });
    }
  }, []);

  // Calculate walking directions
  const calculateWalkingDirections = async (routePoints) => {
    try {
      console.log("LocationDetailsScreen: Calculating walking directions");
      if (!routePoints || routePoints.length < 2) {
        console.warn("Not enough points to calculate directions");
        setDirectionsError(true);
        setIsLoading(false);
        return;
      }
      
      // Get the appropriate API key
      const apiKey = getGoogleMapsApiKey();
      console.log(`LocationDetailsScreen: Using ${Platform.OS} API key`);
      
      // Set initial walking directions with direct paths (fallback)
      const directPaths = [];
      for (let i = 0; i < routePoints.length - 1; i++) {
        directPaths.push(routePoints[i], routePoints[i+1]);
      }
      
      // Close the loop
      if (routePoints.length > 1) {
        directPaths.push(routePoints[routePoints.length - 1], routePoints[0]);
      }
      
      setWalkingDirections(directPaths);
      setIsLoading(false);
      
      // For Google Directions API with optimizeWaypoints
      try {
        // First point is origin
        const origin = `${routePoints[0].latitude},${routePoints[0].longitude}`;
        // Last point is also origin to form a loop (like web implementation)
        const destination = origin;
        
        // Build waypoints string (all points except first)
        let waypointsStr = '';
        if (routePoints.length > 2) {
          const waypoints = routePoints.slice(1).map(point => 
            `${point.latitude},${point.longitude}`
          );
          waypointsStr = `&waypoints=optimize:true|${waypoints.join('|')}`;
        }
        
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsStr}&mode=walking&key=${apiKey}`;
        
        console.log("LocationDetailsScreen: Fetching optimized route with waypoints");
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.routes.length > 0) {
          // Get waypoint order from response (Google's optimization)
          const waypointOrder = response.data.routes[0].waypoint_order || [];
          console.log("Optimized waypoint order:", waypointOrder);
          
          // Create a new ordered array of points based on Google's optimization
          let optimizedPoints = [routePoints[0]]; // Start with origin
          
          // Add waypoints in the order returned by the API
          if (waypointOrder.length > 0 && routePoints.length > 2) {
            waypointOrder.forEach(index => {
              // Add 1 because waypoints are all points except the first
              optimizedPoints.push(routePoints[index + 1]);
            });
          } else if (routePoints.length > 1) {
            // If no optimization was done, just add the remaining points in order
            optimizedPoints = optimizedPoints.concat(routePoints.slice(1));
          }
          
          // Update the route coordinates to show the optimized order
          setRouteCoordinates(optimizedPoints);
          
          // Calculate total distance and duration
          let totalDistance = 0;
          let totalDuration = 0;
          
          response.data.routes[0].legs.forEach(leg => {
            if (leg.distance && leg.distance.value) {
              totalDistance += leg.distance.value;
            }
            if (leg.duration && leg.duration.value) {
              totalDuration += leg.duration.value;
            }
          });
          
          setRouteDistance(totalDistance);
          setRouteDuration(totalDuration);
          console.log(`Total route: ${totalDistance}m, ${totalDuration}s`);
          
          // Extract all legs from the route
          let allPathPoints = [];
          response.data.routes[0].legs.forEach(leg => {
            if (leg.steps) {
              leg.steps.forEach(step => {
                if (step.polyline && step.polyline.points) {
                  const decodedPoints = decodePolyline(step.polyline.points);
                  allPathPoints = [...allPathPoints, ...decodedPoints];
                }
              });
            }
          });
          
          // If no points were extracted from steps, try to use the overview_polyline
          if (allPathPoints.length === 0 && response.data.routes[0].overview_polyline && response.data.routes[0].overview_polyline.points) {
            allPathPoints = decodePolyline(response.data.routes[0].overview_polyline.points);
            console.log(`Using overview_polyline with ${allPathPoints.length} points`);
          }
          
          if (allPathPoints.length > 0) {
            setWalkingDirections(allPathPoints);
            console.log(`Got ${allPathPoints.length} points for complete route`);
          } else {
            console.warn("No path points extracted from the response");
            setDirectionsError(true);
          }
        } else {
          console.warn("Failed to get optimized directions:", response.data.status);
          setDirectionsError(true);
          
          // Fallback to our own TSP optimization if Google API fails
          const optimalRouteOrder = solveTSP(routePoints);
          const optimizedRoutePoints = optimalRouteOrder.map(index => routePoints[index]);
          setRouteCoordinates(optimizedRoutePoints);
        }
      } catch (error) {
        console.error("Error fetching optimized directions:", error);
        setDirectionsError(true);
        
        // Fallback to our own TSP optimization
        const optimalRouteOrder = solveTSP(routePoints);
        const optimizedRoutePoints = optimalRouteOrder.map(index => routePoints[index]);
        setRouteCoordinates(optimizedRoutePoints);
      }
    } catch (error) {
      console.error('Error calculating walking directions:', error);
      setDirectionsError(true);
      setIsLoading(false);
    }
  };
  
  // Solve Traveling Salesman Problem to find optimal route
  const solveTSP = (points) => {
    if (!points || points.length <= 1) return [0];
    
    // Calculate distance matrix
    const distanceMatrix = [];
    for (let i = 0; i < points.length; i++) {
      distanceMatrix[i] = [];
      for (let j = 0; j < points.length; j++) {
        if (i === j) {
          distanceMatrix[i][j] = 0;
        } else {
          distanceMatrix[i][j] = calculateDistance(
            points[i].latitude, 
            points[i].longitude, 
            points[j].latitude, 
            points[j].longitude
          );
        }
      }
    }
    
    // Get initial solution using nearest neighbor
    let tour = nearestNeighborTSP(distanceMatrix);
    
    // Improve solution using 2-opt
    tour = twoOptImprovement(tour, distanceMatrix);
    
    return tour;
  };
  
  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };
  
  // Nearest Neighbor algorithm to solve TSP
  const nearestNeighborTSP = (distanceMatrix) => {
    const n = distanceMatrix.length;
    const visited = Array(n).fill(false);
    const tour = [0]; // Start with node 0
    visited[0] = true;
    
    // Visit n-1 more cities
    for (let i = 1; i < n; i++) {
      let lastCity = tour[tour.length - 1];
      let minDistance = Infinity;
      let nearestCity = -1;
      
      // Find nearest unvisited city
      for (let j = 0; j < n; j++) {
        if (!visited[j] && distanceMatrix[lastCity][j] < minDistance) {
          minDistance = distanceMatrix[lastCity][j];
          nearestCity = j;
        }
      }
      
      if (nearestCity !== -1) {
        tour.push(nearestCity);
        visited[nearestCity] = true;
      }
    }
    
    return tour;
  };
  
  // 2-opt improvement algorithm
  const twoOptImprovement = (tour, distanceMatrix) => {
    const n = tour.length;
    let improved = true;
    let bestTour = [...tour];
    let bestDistance = calculateTourDistance(bestTour, distanceMatrix);
    
    // Maximum number of iterations to prevent infinite loops
    const maxIterations = 100;
    let iterations = 0;
    
    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (let i = 0; i < n - 2; i++) {
        for (let j = i + 2; j < n; j++) {
          // Skip if this would create invalid tour (for last and first edge)
          if (j === n - 1 && i === 0) continue;
          
          // Try swapping edges
          const newTour = twoOptSwap(bestTour, i, j);
          const newDistance = calculateTourDistance(newTour, distanceMatrix);
          
          // If the new tour is better, keep it
          if (newDistance < bestDistance) {
            bestTour = [...newTour];
            bestDistance = newDistance;
            improved = true;
            // Break the inner loop when an improvement is found
            break;
          }
        }
        // Break the outer loop if an improvement is found
        if (improved) break;
      }
    }
    
    console.log(`2-opt completed after ${iterations} iterations`);
    return bestTour;
  };
  
  // Calculate total tour distance
  const calculateTourDistance = (tour, distanceMatrix) => {
    let distance = 0;
    for (let i = 0; i < tour.length - 1; i++) {
      distance += distanceMatrix[tour[i]][tour[i + 1]];
    }
    // Add distance back to start (complete the loop)
    distance += distanceMatrix[tour[tour.length - 1]][tour[0]];
    return distance;
  };
  
  // Perform 2-opt swap: reverse the segment between i and j
  const twoOptSwap = (tour, i, j) => {
    const result = [];
    
    // Add the first part of the tour (0 to i-1)
    for (let k = 0; k <= i; k++) {
      result.push(tour[k]);
    }
    
    // Add the reversed segment (j down to i+1)
    for (let k = j; k > i; k--) {
      result.push(tour[k]);
    }
    
    // Add the last part of the tour (j+1 to end)
    for (let k = j + 1; k < tour.length; k++) {
      result.push(tour[k]);
    }
    
    return result;
  };
  
  // Decode Google Maps encoded polyline
  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    
    const poly = [];
    let index = 0, lat = 0, lng = 0;
    
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      
      shift = 0;
      result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      
      const point = {
        latitude: lat * 1e-5,
        longitude: lng * 1e-5
      };
      
      poly.push(point);
    }
    
    return poly;
  };

  // Updated to directly use current location
  const handlePinLocation = async () => {
    // Only allow pinning a location if the user is not a supervisor
    if (isSupervisor) {
      Alert.alert('Permission Denied', 'Supervisors cannot pin locations. Please contact a surveyor.');
      return;
    }
    
    try {
      // Request permission and get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to pin your current location.');
        return;
      }
      
      // Show loading indicator
      setIsLoading(true);
      
      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      console.log('Using current location for survey:', currentLocation);
      
      // Navigate directly to SurveyForm with the current location
      navigation.navigate('SurveyForm', {
        location: currentLocation,
        locationData: locationData,
        isViewOnly: false // Surveyors can edit
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // We no longer need handleMapPress to set selectedLocation for pinning
  const handleMapPress = (event) => {
    // This function is kept for potential future use, but we're no longer using
    // it for the pin location feature
  };
  
  const fitAllPoints = () => {
    if (!mapRef.current) {
      console.log("Cannot fit to points - map ref is null");
      return;
    }
    
    console.log("Fitting map to show all points");
    try {
      // Collect all coordinates to include in the fit
      const allPoints = [];
      
      // Add route coordinates
      if (routeCoordinates && routeCoordinates.length > 0) {
        allPoints.push(...routeCoordinates);
      }
      
      // Add survey point coordinates
      if (surveys && surveys.length > 0) {
        surveys.forEach(survey => {
          if (survey.latlong && survey.latlong.length >= 2) {
            const lat = parseFloat(survey.latlong[0]);
            const lng = parseFloat(survey.latlong[1]);
            
            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
              allPoints.push({
                latitude: lat,
                longitude: lng
              });
            }
          }
        });
      }
      
      // Add selected location if available
      if (selectedLocation) {
        allPoints.push(selectedLocation);
      }
      
      if (allPoints.length === 0) {
        console.log("No points to fit to");
        return;
      }
      
      console.log(`Fitting map to ${allPoints.length} points`);
      
      // Use the map's fitToCoordinates method to adjust the visible region
      mapRef.current.fitToCoordinates(allPoints, {
        edgePadding: {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50
        },
        animated: true
      });
    } catch (error) {
      console.error("Error fitting to coordinates:", error);
      Alert.alert("Map Error", "Unable to adjust map view. Please try again.");
    }
  };

  // Format distance for display
  const formatDistance = (meters) => {
    if (!meters) return 'Unknown';
    return meters < 1000 ? `${meters.toFixed(0)} m` : `${(meters / 1000).toFixed(2)} km`;
  };
  
  // Format time for display
  const formatTime = (seconds) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Handle survey deletion
  const handleDeleteSurvey = (surveyId) => {
    // Check if user is a surveyor and location is active (status 3)
    if (currentUser?.role !== 'SURVEYOR') {
      Alert.alert('Permission Denied', 'Only surveyors can delete surveys.');
      return;
    }
    
    if (!locationData || locationData.status !== 3) {
      Alert.alert('Action Not Allowed', 'Surveys can only be deleted when the location is in active status.');
      return;
    }

    Alert.alert(
      'Delete Survey',
      'Are you sure you want to delete this survey? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await axios.delete(`${SURVEY_URL}/api/surveys/${surveyId}`);
              
              if (response.data && response.data.success) {
                // Remove the deleted survey from the list
                setSurveys(prevSurveys => prevSurveys.filter(survey => survey._id !== surveyId));
                Alert.alert('Success', 'Survey deleted successfully');
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to delete survey');
              }
            } catch (error) {
              console.error('Error deleting survey:', error);
              Alert.alert('Error', `Failed to delete survey: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  // Updated to handle the new location schema format
  const renderSurveyItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.surveyItem}
      onPress={() => navigation.navigate('SurveyForm', { 
        existingSurvey: item,
        locationData: locationData,
        location: { 
          latitude: item.latlong?.[0] || 0,
          longitude: item.latlong?.[1] || 0 
        },
        isViewOnly: isSupervisor || (locationData && (locationData.status === 4 || locationData.status === 5)) // View-only for supervisors or status 4,5
      })}
    >
      <View style={styles.surveyContent}>
        <Text style={styles.surveyTitle}>{item.title || 'Untitled Survey'}</Text>
        <Text style={styles.surveyDetails}>
          {item.terrainData?.type || 'Unknown terrain'} · {item?.rowAuthority || '--'}
        </Text>
        <Text style={styles.surveyDate}>
          Created: {formatDate(item.createdAt)}
        </Text>
      </View>
      <View style={styles.surveyActions}>
        {currentUser?.role === 'SURVEYOR' && locationData?.status === 3 && (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteSurvey(item._id);
            }}
          >
            <MaterialIcons name="delete" size={24} color="#C62828" />
          </TouchableOpacity>
        )}
        <View style={styles.surveyArrow}>
          <Text>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Function to fetch surveyors reporting to current user
  const fetchSurveyors = useCallback(async () => {
    if (!currentUser?._id) return;
    
    try {
      setLoadingSurveyors(true);
      console.log("Fetching surveyors reporting to current user");
      
      // Use the endpoint to get surveyors reporting to the current user
      const apiUrl = `${AUTH_URL}/api/auth/users?reportingTo=${currentUser?._id}`;
      console.log("Fetching surveyors from:", apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.error(`Error fetching surveyors: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log(`Found ${data.data?.length || 0} surveyors`);
      
      if (Array.isArray(data.data)) {
        // Filter only active surveyors with SURVEYOR role
        const activeSurveyors = data.data.filter(user => 
          user.status === 1 && user.role === 'SURVEYOR'
        );
        setSurveyors(activeSurveyors);
        setReportees(activeSurveyors); // Set reportees to the same list
        
        // Set default selected surveyor and reportee if available
        if (activeSurveyors.length > 0) {
          setSelectedSurveyor(activeSurveyors[0]._id);
          setSelectedReportee(activeSurveyors[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching surveyors:', error);
      Alert.alert('Error', 'Failed to fetch surveyors');
    } finally {
      setLoadingSurveyors(false);
    }
  }, [currentUser?._id]);

  // Handle due date change
  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dueDate;
    setShowDatePicker(Platform.OS === 'ios');
    setDueDate(currentDate);
  };

  // Handle opening the assignment modal
  const handleOpenAssignmentModal = () => {
    fetchSurveyors();
    setAssignmentModalVisible(true);
  };

  // Format date for display
  const formatDateForDisplay = (date) => {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Updated function to handle location assignment
  const handleAssignLocation = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    if (!selectedSurveyor) {
      Alert.alert('Error', 'Please select a surveyor');
      return;
    }

    if (!selectedReportee) {
      Alert.alert('Error', 'Please select a reportee');
      return;
    }

    // Calculate due date string in YYYY-MM-DD format
    const formattedDueDate = dueDate.toISOString().split('T')[0];

    // Show confirmation dialog
    Alert.alert(
      'Confirm Assignment',
      `Are you sure you want to assign this location to the selected surveyor with due date ${formatDateForDisplay(dueDate)}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Assign',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              // Make API call to update location
              console.log("Assign Location Payload :", {
                surveyor: selectedSurveyor,
                assigned_to: selectedSurveyor,
                reportee: selectedReportee,
                supervisor: currentUser?._id,
                due_date: formattedDueDate,
                status: 2 // Mark as assigned
              })
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                surveyor: selectedSurveyor,
                assigned_to: selectedSurveyor,
                reportee: selectedReportee,
                supervisor: currentUser?._id,
                due_date: formattedDueDate,
                status: 2 // Mark as assigned
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Location has been assigned', [
                  { text: 'OK', onPress: () => {
                    setAssignmentModalVisible(false);
                    navigation.goBack();
                  }}
                ]);
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to assign location');
              }
            } catch (error) {
              console.error('Error assigning location:', error);
              Alert.alert('Error', `Failed to assign location: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Add function to handle starting a new location survey
  const handleStartSurvey = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    Alert.alert(
      'Start Survey',
      'Are you sure you want to start a survey for this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                status: 3 // Change to active survey status
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Survey has been started');
                
                // Refresh data after successfully starting the survey
                fetchLocationData();
                fetchSurveysForLocation();
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to start survey');
              }
            } catch (error) {
              console.error('Error starting survey:', error);
              Alert.alert('Error', `Failed to start survey: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Add function to handle restarting a rejected location survey
  const handleRestartSurvey = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    Alert.alert(
      'Restart Survey',
      'Are you sure you want to restart the survey for this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Restart',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                status: 3 // Revert to active survey status
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Survey has been restarted');
                
                // Refresh data after successful restart
                fetchLocationData();
                fetchSurveysForLocation();
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to restart survey');
              }
            } catch (error) {
              console.error('Error restarting survey:', error);
              Alert.alert('Error', `Failed to restart survey: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Add functions to handle location approval and rejection
  const handleApproveLocation = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    Alert.alert(
      'Approve Location',
      'Are you sure you want to approve this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                status: 5 // Mark as approved
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Location has been approved', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to approve location');
              }
            } catch (error) {
              console.error('Error approving location:', error);
              Alert.alert('Error', `Failed to approve location: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleRejectLocation = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    Alert.alert(
      'Reject Location',
      'Are you sure you want to reject this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reject',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                status: 6 // Mark as rejected
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Location has been rejected', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to reject location');
              }
            } catch (error) {
              console.error('Error rejecting location:', error);
              Alert.alert('Error', `Failed to reject location: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Add function to handle location submission
  const handleSubmitLocation = async () => {
    if (!locationId) {
      Alert.alert('Error', 'Location ID is required');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Submission',
      'Are you sure you want to mark this location as completed?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              
              // Make API call to update location status
              const response = await axios.put(`${LOCATION_URL}/api/locations/${locationId}`, {
                status: 4 // Mark as completed
              });
              
              if (response.data && response.data.success) {
                Alert.alert('Success', 'Location has been marked as completed', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                console.error('API returned unsuccessful response:', response.data);
                Alert.alert('Error', 'Failed to update location status');
              }
            } catch (error) {
              console.error('Error submitting location:', error);
              Alert.alert('Error', `Failed to update location: ${error.message}`);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Add debug logging in useEffect to check roles and component rendering
  useEffect(() => {
    console.log("Location Details Screen Mounted");
    console.log("Current user role:", currentUser?.role);
    console.log("Is supervisor:", isSupervisor);
    console.log("Submit button should be visible to all users");
  }, []);

  useEffect(() => {
    console.log("Button visibility state:", buttonVisible);
    // Force the button to be visible in case something is hiding it
    setButtonVisible(true);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading map and route data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.mapContainer, { height: animatedMapHeight }]}>
          {mapError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {mapError}</Text>
            </View>
          )}
          
          {mapRegion ? (
            <View style={styles.mapWrapper}>
              <SafeMapView
                ref={mapRef}
                style={styles.map}
                initialRegion={mapRegion}
                onPress={handleMapPress}
                provider="google"
                showsUserLocation={true}
                followsUserLocation={true}
                showsMyLocationButton={true}
                showsCompass={true}
                showsScale={true}
                showsTraffic={false}
                toolbarEnabled={true}
                moveOnMarkerPress={true}
                loadingEnabled={true}
                loadingIndicatorColor="#2196F3"
                loadingBackgroundColor="#FFFFFF"
              >
                {/* Route markers */}
                {routeCoordinates.map((point, index) => (
                  <Marker
                    key={point.id || `marker-${index}`}
                    coordinate={{
                      latitude: point.latitude,
                      longitude: point.longitude
                    }}
                    title={point.title || `Point ${index + 1}`}
                    description={point.description || ''}
                    pinColor={index === 0 ? 'green' : (index === routeCoordinates.length - 1 ? 'red' : '#2196F3')}
                  />
                ))}
                
                {/* Survey point markers (yellow) */}
                {surveys.map((survey, index) => {
                  // Check if survey has valid coordinates
                  if (survey.latlong && survey.latlong.length >= 2) {
                    // Check if coordinates are valid numbers
                    const lat = parseFloat(survey.latlong[0]);
                    const lng = parseFloat(survey.latlong[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                      return (
                        <Marker
                          key={`survey-${survey._id || index}`}
                          coordinate={{
                            latitude: lat,
                            longitude: lng
                          }}
                          title={survey.title || `Survey ${index + 1}`}
                          description={`${survey.terrainData?.type || 'Unknown terrain'} - Created: ${formatDate(survey.createdAt)}`}
                          pinColor="yellow"
                          onPress={() => navigation.navigate('SurveyForm', { 
                            existingSurvey: survey,
                            locationData: locationData,
                            location: { 
                              latitude: lat,
                              longitude: lng 
                            },
                            isViewOnly: isSupervisor // Supervisors can only view, surveyors can edit
                          })}
                        />
                      );
                    }
                  }
                  return null;
                })}
                
                {/* Walking directions polyline */}
                {walkingDirections.length > 0 && (
                  <Polyline
                    coordinates={walkingDirections}
                    strokeWidth={4}
                    strokeColor="#2196F3"
                    lineDashPattern={[0]}
                  />
                )}
                
                {/* Selected location marker */}
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    title="Selected Location"
                    description="This location will be pinned"
                    pinColor="purple"
                  />
                )}
              </SafeMapView>
              
              <TouchableOpacity 
                style={styles.fitButton}
                onPress={fitAllPoints}
              >
                <Text style={styles.fitButtonText}>Fit All Points</Text>
              </TouchableOpacity>
              
              {directionsError && (
                <View style={styles.directionsErrorBanner}>
                  <Text style={styles.directionsErrorText}>
                    Walking directions unavailable. Showing direct paths.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load map. Please check your connection.</Text>
            </View>
          )}
        </Animated.View>
        
        {/* Resizable handle with animation */}
        <Animated.View 
          style={[
            styles.resizeHandle, 
            { 
              opacity: animatedHandleOpacity,
              backgroundColor: dragging ? '#e0e0e0' : '#f8f8f8'
            }
          ]} 
          {...panResponder.panHandlers}
        >
          <View style={styles.handleBar} />
          {dragging && <Text style={styles.dragHintText}>Drag to resize</Text>}
        </Animated.View>
        
        <View style={styles.surveyListContainer}>
          <View style={styles.surveyListHeader}>
            <Text style={styles.surveyListTitle}>
              Surveys for this Location ({surveys.length})
            </Text>
            <View style={styles.headerActions}>
              {surveysLoading && <ActivityIndicator size="small" color="#2196F3" />}
              {locationData && locationData.status === 3 && !isSupervisor && (
                <TouchableOpacity 
                  style={styles.headerPinButton}
                  onPress={handlePinLocation}
                >
                  <Text style={styles.headerPinButtonText}>Pin Location</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {surveys.length === 0 && !surveysLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No surveys found for this location</Text>
            </View>
          ) : (
            <FlatList
              data={surveys}
              renderItem={renderSurveyItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.surveyListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#2196F3']}
                  tintColor="#2196F3"
                  title="Pull to refresh..."
                  titleColor="#999"
                />
              }
            />
          )}
        </View>
      </SafeAreaView>
      
      {/* Assignment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={assignmentModalVisible}
        onRequestClose={() => setAssignmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Assign Location</Text>
            
            {/* Due Date Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date:</Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerText}>{formatDateForDisplay(dueDate)}</Text>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  style={styles.datePicker}
                />
              )}
            </View>
            
            {/* Surveyor Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assign to Surveyor:</Text>
              {loadingSurveyors ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : surveyors.length > 0 ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedSurveyor}
                    onValueChange={(itemValue) => setSelectedSurveyor(itemValue)}
                    style={styles.picker}
                  >
                    {surveyors.map(surveyor => (
                      <Picker.Item 
                        key={surveyor._id} 
                        label={surveyor.username || surveyor.email || 'Unknown'} 
                        value={surveyor._id} 
                      />
                    ))}
                  </Picker>
                </View>
              ) : (
                <Text style={styles.noSurveyorsText}>No surveyors available</Text>
              )}
            </View>
            
            {/* Reportee Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assign to Reportee:</Text>
              {loadingSurveyors ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : reportees.length > 0 ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedReportee}
                    onValueChange={(itemValue) => setSelectedReportee(itemValue)}
                    style={styles.picker}
                  >
                    {reportees.map(reportee => (
                      <Picker.Item 
                        key={reportee._id} 
                        label={reportee.username || reportee.email || 'Unknown'} 
                        value={reportee._id} 
                      />
                    ))}
                  </Picker>
                </View>
              ) : (
                <Text style={styles.noSurveyorsText}>No reportees available</Text>
              )}
            </View>
            
            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setAssignmentModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.assignButton}
                onPress={handleAssignLocation}
                disabled={isSubmitting || !selectedSurveyor}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.assignButtonText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Completely separate fixed footer */}
      {buttonVisible && locationData && (
        <View style={styles.fixedFooter}>
          {/* Different buttons based on user role and location status */}
          {locationData.status === 1 && isSupervisor ? (
            // Only supervisors can assign locations (status 1)
            <TouchableOpacity 
              style={styles.assignLocationButton}
              onPress={handleOpenAssignmentModal}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#1565C0" size="small" />
              ) : (
                <Text style={styles.assignLocationButtonText}>Assign Location</Text>
              )}
            </TouchableOpacity>
          ) : locationData.status === 4 && isSupervisor ? (
            // Only supervisors can approve/reject locations (status 4)
            <View style={styles.approvalButtonsContainer}>
              <TouchableOpacity 
                style={styles.approveButton}
                onPress={handleApproveLocation}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#2E7D32" size="small" />
                ) : (
                  <Text style={styles.approveButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.rejectButton}
                onPress={handleRejectLocation}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#C62828" size="small" />
                ) : (
                  <Text style={styles.rejectButtonText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : locationData.status === 6 && !isSupervisor ? (
            // Only surveyors can restart rejected locations (status 6)
            <TouchableOpacity 
              style={styles.restartButton}
              onPress={handleRestartSurvey}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#1565C0" size="small" />
              ) : (
                <Text style={styles.restartButtonText}>Restart Location Survey</Text>
              )}
            </TouchableOpacity>
          ) : locationData.status === 2 && !isSupervisor ? (
            // Only surveyors can start surveys (status 2)
            <TouchableOpacity 
              style={styles.startButton}
              onPress={handleStartSurvey}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#00796B" size="small" />
              ) : (
                <Text style={styles.startButtonText}>Start Location Survey</Text>
              )}
            </TouchableOpacity>
          ) : locationData.status === 3 && !isSupervisor ? (
            // Only surveyors can submit completed locations (status 3)
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmitLocation}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#2E7D32" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Location as Completed</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      
      {locationData && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationTitle}>
            {locationData.district || ''} - {locationData.block || ''}
          </Text>
          {routeDistance && (
            <View style={styles.routeStatsContainer}>
              <Text style={styles.routeStats}>
                Distance: {formatDistance(routeDistance)} | Time: {formatTime(routeDuration)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  mapContainer: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
    // height is now dynamic and controlled by state
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  fitButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  directionsErrorBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 204, 0, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  directionsErrorText: {
    color: '#333',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  surveyListContainer: {
    flex: 1, // Takes remaining space
    backgroundColor: '#fff',
  },
  surveyListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  surveyListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  surveyListContent: {
    paddingHorizontal: 16, 
    paddingBottom: 120, // Increased padding to ensure last survey is visible above the button
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  surveyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    marginTop: 12,
    marginBottom: 8, // Added margin at the bottom for spacing between items
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  surveyContent: {
    flex: 1,
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  surveyDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  surveyDate: {
    fontSize: 12,
    color: '#888',
  },
  surveyActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginRight: 5,
  },
  surveyArrow: {
    fontSize: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerPinButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
    elevation: 2,
  },
  headerPinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    elevation: 3,
  },
  locationTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 15,
    color: '#333',
  },
  routeStatsContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  routeStats: {
    textAlign: 'center',
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  fixedFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 9999,
  },
  approvalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FF5252',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restartButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // New styles for the assignment modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  datePickerButton: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  datePicker: {
    marginTop: 10,
    marginBottom: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  noSurveyorsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  assignButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
    elevation: 2,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  assignLocationButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  assignLocationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Updated styles for resize handle
  resizeHandle: {
    width: '100%',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 10,
  },
  handleBar: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#aaa',
  },
  dragHintText: {
    fontSize: 10,
    color: '#999',
    marginTop: 3,
  },
});
