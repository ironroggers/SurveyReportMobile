import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TextInput
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LOCATION_URL, AUTH_URL } from "../api-url";
import {useCurrentUser} from "../hooks/useCurrentUser";

export default function SurveyScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [surveyors, setSurveyors] = useState([]);
  const [locations, setLocations] = useState([]); // Store all locations as an array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const {currentUser} = useCurrentUser();
  console.log("Current User:", currentUser);
  
  // Load data when currentUser is available
  useEffect(() => {
    if (currentUser?._id) {
      fetchData();
    }
  }, [currentUser]);
  
  // Fetch surveyors data
  const fetchSurveyors = async () => {
    try {
      if (!AUTH_URL || !currentUser?.reportingTo) {
        console.log("Cannot fetch surveyors: Missing AUTH_URL or reportingTo ID");
        setSurveyors([]);
        return;
      }

      setLoading(true);
      
      // Correctly use the currentUser's reportingTo field
      console.log("Loading surveyors----------44", currentUser);
      const apiUrl = `${AUTH_URL}/api/auth/users?reportingTo=${currentUser?._id}`;
      console.log("api-url ", apiUrl);
      
      const response = await fetch(apiUrl);

      if (!response || !response.ok) {
        setSurveyors([]);
        setError(`Failed to fetch surveyors: ${response?.status || 'Network error'}`);
        return;
      }

      const data = await response.json();

      console.log("Successfully fetch surveyors data", data);
      setSurveyors(Array.isArray(data?.data) ? data?.data : []);
    } catch (err) {
      console.error("Error fetching surveyors:", err);
      setError(err.message || 'An error occurred while fetching surveyors');
      setSurveyors([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch locations
  const fetchLocations = async () => {
    try {
      if (!LOCATION_URL || !currentUser?._id) {
        console.log("Cannot fetch locations: Missing LOCATION_URL or user ID");
        setLocations([]);
        return;
      }

      console.log("Starting to fetch locations");
      
      // Include the createdBy and status parameters as shown in the logs
      const apiUrl = `${LOCATION_URL}/api/locations?createdBy=${currentUser._id}&status=COMPLETED,APPROVED,REJECTED`;
      console.log("Fetching locations from URL:", apiUrl);
      
      const response = await fetch(apiUrl);

      if (!response || !response.ok) {
        console.log("Failed to fetch locations:", response?.status);
        setLocations([]);
        return;
      }

      const data = await response.json();
      // Store the array of locations directly
      const locationsArray = data && data.data ? data.data : [];
      console.log("Locations fetched:", locationsArray.length);
      setLocations(Array.isArray(locationsArray) ? locationsArray : []);
      console.log("Finished location fetch, setting loading to false");
    } catch (err) {
      console.error("Error fetching locations:", err);
      setLocations([]);
    }
  };

  // Fetch all data
  const fetchData = async () => {
    setError(null);
    
    if (!currentUser?._id) {
      console.log("Cannot fetch data: currentUser not loaded yet");
      return;
    }
    
    await Promise.all([fetchSurveyors(), fetchLocations()]);
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  }, [currentUser?._id]);

  // Get filtered surveyors based on search query
  const getFilteredSurveyors = useCallback(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return surveyors;
    }

    const query = searchQuery.toLowerCase().trim();

    return surveyors.filter(surveyor => {
      // Check if surveyor name or email matches
      const nameMatch = surveyor?.username?.toLowerCase().includes(query) ||
        surveyor?.email?.toLowerCase().includes(query);

      if (nameMatch) return true;

      // Check if any of the assigned locations match
      if (surveyor?._id) {
        const surveyorLocations = locations.filter(
          location => location?.assignedTo === surveyor._id
        );
        
        return surveyorLocations.some(location =>
          location?.title?.toLowerCase().includes(query)
        );
      }

      return false;
    });
  }, [surveyors, locations, searchQuery]);

  // Handle assign location
  const handleAssignLocation = (surveyorId) => {
    try {
      if (!surveyorId) return;
      if (!navigation) return;
      
      navigation.navigate('AssignLocation', {
        surveyorId,
        onLocationAssigned: () => {
          fetchLocations(); // Refresh locations after assignment
        }
      });
    } catch (error) {
      console.log('Error navigating to AssignLocation', error);
    }
  };

  // Get locations for a specific surveyor
  const getLocationsForSurveyor = (surveyorId) => {
    if (!surveyorId || !Array.isArray(locations)) return [];
    
    return locations.filter(
      location => location && location.assignedTo === surveyorId
    );
  };

  // Render surveyor card
  const renderSurveyorCard = (item) => {
    try {
      if (!item) return null;

      // Get array of locations for this surveyor
      const surveyorLocations = getLocationsForSurveyor(item._id);

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
      return (
        <View key={Math.random().toString()} style={styles.card}>
          <Text style={styles.errorText}>Error displaying this surveyor</Text>
        </View>
      );
    }
  };

  // Get filtered surveyors
  const filteredSurveyors = getFilteredSurveyors();

  return(
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.title}>Surveyors & Assigned Locations</Text>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by surveyor name or location"
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
            }}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1976D2',
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
  },
  surveyorsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#424242',
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
  status: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  lastLogin: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  locationsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  locationHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  locationInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noLocationText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  assignBtn: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 