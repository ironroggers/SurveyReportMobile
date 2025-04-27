import React, {useCallback, useEffect, useState} from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {AUTH_URL} from "../api-url";
import {useCurrentUser} from "../hooks/useCurrentUser";

export default function SurveyorListScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [surveyors, setSurveyors] = useState([]);
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

  // Fetch all data
  const fetchData = async () => {
    setError(null);

    if (!currentUser?._id) {
      console.log("Cannot fetch data: currentUser not loaded yet");
      return;
    }

    await Promise.all([fetchSurveyors()]);
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
      return surveyor?.username?.toLowerCase().includes(query) ||
        surveyor?.email?.toLowerCase().includes(query);


    });
  }, [surveyors, searchQuery]);


  // Render surveyor card
  const renderSurveyorCard = (item) => {
    try {
      if (!item) return null;

      return (
        <TouchableOpacity
          key={item._id || Math.random().toString()}
          style={styles.card}
          onPress={() => navigation.navigate('SurveyorLocations', { surveyorId: item._id })}
        >
          <Text style={styles.name}>{item.username || 'Unknown'}</Text>
          <Text style={styles.email}>{item.email || 'No email'}</Text>
          <Text style={styles.status}>Status: {item.status === 1 ? 'Active' : 'Inactive'}</Text>
          <Text style={styles.lastLogin}>
            Last Login: {item.lastLogin ? new Date(item.lastLogin).toLocaleString() : 'Unknown'}
          </Text>
        </TouchableOpacity>
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
          {searchQuery ? (
            <Text style={styles.sectionTitle}>
              Surveyors ({filteredSurveyors.length} results)
            </Text>
          ) : null}

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
            searchQuery ?
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No surveyors found matching your search.
              </Text>
            </View> : null
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