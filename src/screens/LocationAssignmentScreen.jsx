import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { AuthContext } from '../context/AuthContext';
import { LOCATION_URL, AUTH_URL } from "../api-url";

export default function LocationAssignmentScreen({ navigation }) {
  console.log("LocationAssignmentScreen rendering");
  
  const { currentUser } = useCurrentUser();
  const [surveyors, setSurveyors] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Debug logging
  console.log("Current surveyors:", surveyors);
  console.log("Current assignedLocations:", assignedLocations);
  
  // Load data on component mount
  useEffect(() => {
    console.log("Initial useEffect running");
    fetchData();
  }, []);
  
  // Handle refresh
  const onRefresh = () => {
    console.log("Refreshing data");
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };
  
  // Simplified data fetching function
  const fetchData = async () => {
    console.log("Fetching data");
    setLoading(true);
    setError(null);
    
    try {
      // Fetch surveyors - using the correct endpoint
      console.log("Fetching surveyors");
      // Try the endpoint that works in SupervisorDashboard
      const surveyorsResponse = await fetch(`${AUTH_URL}/api/users?role=SURVEYOR`);
      
      if (!surveyorsResponse.ok) {
        throw new Error(`Failed to fetch surveyors: ${surveyorsResponse.status}`);
      }
      
      const surveyorsData = await surveyorsResponse.json();
      console.log("Surveyors fetched:", surveyorsData.length);
      setSurveyors(surveyorsData);
      
      // Fetch assigned locations
      console.log("Fetching assigned locations");
      const locationsResponse = await fetch(`${LOCATION_URL}/api/locations/assigned`);
      
      if (!locationsResponse.ok) {
        throw new Error(`Failed to fetch assigned locations: ${locationsResponse.status}`);
      }
      
      const locationsData = await locationsResponse.json();
      console.log("Assigned locations fetched:", Object.keys(locationsData).length);
      setAssignedLocations(locationsData);
      
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle assign location
  const handleAssignLocation = (surveyorId) => {
    navigation.navigate('AssignLocation', { surveyorId });
  };
  
  // Filter surveyors based on search query
  const filteredSurveyors = surveyors.filter(surveyor => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const name = (surveyor.username || surveyor.name || '').toLowerCase();
    const email = (surveyor.email || '').toLowerCase();
    
    // Check if location matches search query
    let locationMatch = false;
    if (assignedLocations[surveyor._id]) {
      locationMatch = assignedLocations[surveyor._id].some(location => 
        location.title?.toLowerCase().includes(query)
      );
    }
    
    return name.includes(query) || email.includes(query) || locationMatch;
  });
  
  // Render a surveyor card
  const renderSurveyorCard = (surveyor) => {
    console.log("Rendering surveyor card:", surveyor.username || surveyor.email);
    
    return (
      <View key={surveyor._id} style={styles.card}>
        <Text style={styles.name}>{surveyor.username || surveyor.name || 'Unnamed Surveyor'}</Text>
        <Text style={styles.email}>{surveyor.email}</Text>
        
        {/* Display assigned locations */}
        {assignedLocations[surveyor._id] ? (
          <View style={styles.locationsContainer}>
            <Text style={styles.locationHeader}>Assigned Locations:</Text>
            {Array.isArray(assignedLocations[surveyor._id]) ? (
              assignedLocations[surveyor._id].map((location, index) => (
                <View key={index} style={styles.locationInfo}>
                  <Text style={styles.locationTitle}>{location.title}</Text>
                  <Text style={styles.locationDetails}>
                    {location.address || 'No address provided'}
                  </Text>
                  <TouchableOpacity
                    style={styles.reassignBtn}
                    onPress={() => handleAssignLocation(surveyor._id)}
                  >
                    <Text style={styles.btnText}>Reassign Location</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text>Invalid location data format</Text>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.noLocationText}>No locations assigned</Text>
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => handleAssignLocation(surveyor._id)}
            >
              <Text style={styles.btnText}>Assign Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
        <View style={styles.content}>
          <Text style={styles.pageTitle}>Location Assignments</Text>
          
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by surveyor name or location"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Surveyors list */}
          <View style={styles.surveyorsContainer}>
            <Text style={styles.sectionTitle}>
              Surveyors {searchQuery ? `(${filteredSurveyors.length} results)` : `(${surveyors.length})`}
            </Text>
            
            {loading ? (
              <View style={styles.centerContent}>
                <Text style={styles.loadingText}>Loading surveyors...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContent}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : filteredSurveyors.length > 0 ? (
              filteredSurveyors.map(surveyor => renderSurveyorCard(surveyor))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No surveyors found matching your search.' : 'No surveyors found.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 16,
    color: '#f57c00',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  locationsContainer: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  locationHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  locationDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  assignBtn: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reassignBtn: {
    backgroundColor: '#5C6BC0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
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
  retryButton: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
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
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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