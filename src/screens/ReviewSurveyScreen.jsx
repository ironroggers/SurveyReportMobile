import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {LOCATION_URL} from "../api-url";

export default function ReviewSurveyScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const { currentUser, loading: userLoading } = useCurrentUser();

  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Released', value: 1 },
    { label: 'Assigned', value: 2 },
    { label: 'Active', value: 3 },
    { label: 'Completed', value: 4 },
    { label: 'Accepted', value: 5 },
    { label: 'Reverted', value: 6 },
  ];

  const fetchLocations = useCallback(async () => {
    if (!currentUser?._id) {
      console.log('Cannot fetch locations: no current user ID');
      return;
    }
    
    try {
      console.log('Starting to fetch locations');
      setLoading(true);
      setError(null);
      
      // Create the URL based on the user's role
      // If admin, fetch all locations; otherwise, fetch locations created by current user
      const url = `${LOCATION_URL}/api/locations`;
      console.log('Fetching locations from URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response from locations API:', errorText);
        throw new Error(`Failed to fetch locations: ${response?.status}`);
      }

      const data = await response.json();
      console.log('Locations fetched:', data?.data || 0);
      
      // Filter locations if user is a surveyor
      let filteredData = data.data || [];
      if (currentUser.role === 'SURVEYOR') {
        filteredData = filteredData.filter(location => location?.surveyor?._id === currentUser?._id);
        console.log(`Filtered to ${filteredData.length} locations assigned to current surveyor`);
      }
      
      // Log the statuses to debug
      const statusCounts = {};
      filteredData.forEach(loc => {
        const status = loc.status || 'undefined';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log('Status counts in fetched data:', statusCounts);
      
      setLocations(filteredData);
      
      // Reset filter to ALL if current filter has no matching locations
      if (selectedFilter !== 'ALL') {
        // Convert selectedFilter to number for comparison
        const filterValue = Number(selectedFilter);
        const hasMatchingLocations = filteredData.some(loc => loc.status === filterValue);
        
        if (!hasMatchingLocations) {
          console.log(`No locations with status ${filterValue} (${getStatusLabel(filterValue)}), resetting filter to ALL`);
          setSelectedFilter('ALL');
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError(error.message);
    } finally {
      console.log('Finished location fetch, setting loading to false');
      setLoading(false);
    }
  }, [currentUser?._id, currentUser?.role, selectedFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    console.log('Refreshing data...');
    fetchLocations()
      .finally(() => {
        console.log('Refresh complete');
        setRefreshing(false);
      });
  }, [fetchLocations]);

  useEffect(() => {
    if (!userLoading && currentUser?._id) {
      fetchLocations();
    }
  }, [userLoading, currentUser?._id, fetchLocations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 1:
        return '#9C27B0'; // Purple
      case 2:
        return '#FF9800'; // Orange
      case 3:
        return '#2196F3'; // Blue
      case 4:
        return '#1976D2'; // Dark Blue
      case 5:
        return '#4CAF50'; // Green
      case 6:
        return '#F44336'; // Red
      default:
        return '#757575'; // Gray
    }
  };

  // Get status label from numeric value
  const getStatusLabel = (statusValue) => {
    const status = filterOptions.find(option => option.value === statusValue);
    return status ? status.label : 'Unknown';
  };

  // Filter and search locations
  const getFilteredLocations = useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    
    console.log(`Filtering ${locations.length} locations with status=${selectedFilter}, query="${query}"`);
    
    return locations.filter(location => {
      // First filter by status - handle numeric status values
      if (selectedFilter !== 'ALL') {
        // Convert selectedFilter to number for comparison if it's not 'ALL'
        const filterValue = selectedFilter === 'ALL' ? selectedFilter : Number(selectedFilter);
        if (location.status !== filterValue) {
          return false;
        }
      }
      
      // Then filter by search query if there is one
      if (query) {
        // Check if location title, block, or district matches
        if (location.title?.toLowerCase().includes(query)) return true;
        if (location.block?.toLowerCase().includes(query)) return true;
        if (location.district?.toLowerCase().includes(query)) return true;
        
        // Check if location description/comments match
        if (location.description?.toLowerCase().includes(query)) return true;
        if (location.comments?.toLowerCase().includes(query)) return true;
        
        // Check if reviewer comment matches
        if (location.reviewComment?.toLowerCase().includes(query)) return true;
        
        // Check coordinates (as string) for matches
        if (location.centerPoint?.coordinates) {
          const coordStr = `${location.centerPoint.coordinates[0]}, ${location.centerPoint.coordinates[1]}`;
          if (coordStr.includes(query)) return true;
        }
        
        return false;
      }
      
      return true;
    });
  }, [locations, selectedFilter, searchQuery]);

  const filteredLocations = getFilteredLocations();
  
  // Check if there are any locations with each status
  const getStatusCounts = useCallback(() => {
    const counts = {};
    filterOptions.forEach(option => {
      if (option.value === 'ALL') {
        counts[option.value] = locations.length;
      } else {
        counts[option.value] = locations.filter(loc => loc.status === option.value).length;
      }
    });
    return counts;
  }, [locations]);
  
  const statusCounts = getStatusCounts();

  const handleLocationPress = (location) => {
    console.log('Navigating to location details:', location._id);
    navigation.navigate('LocationDetails', { location });
  };

  const renderLocation = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleLocationPress(item)}
    >
      <View style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {item.title || item.block || 'Unnamed Location'}
          </Text>
          
          {item.district && (
            <Text style={styles.details}>District: {item.district}</Text>
          )}
          
          {item.block && (
            <Text style={styles.details}>Block: {item.block}</Text>
          )}
          
          {item.centerPoint?.coordinates && (
            <Text style={styles.coordinates}>
              📍 ({item.centerPoint.coordinates[1]?.toFixed(6) || '0'}, {item.centerPoint.coordinates[0]?.toFixed(6) || '0'})
            </Text>
          )}
          
          {item.radius && (
            <Text style={styles.details}>Radius: {item.radius}m</Text>
          )}
          
          {item.due_date && (
            <Text style={styles.details}>Due Date: {new Date(item.due_date).toLocaleDateString()}</Text>
          )}
          
          <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
            Status: {getStatusLabel(item.status) || 'N/A'}
          </Text>
          
          {(item.status === 5 || item.status === 6) && item.reviewComment && (
            <Text style={styles.comment}>Comment: {item.reviewComment}</Text>
          )}
        </View>
        <ChevronRight color="#999" size={22} />
      </View>
    </TouchableOpacity>
  );

  if (userLoading || (loading && !refreshing)) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>All Locations</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search locations..."
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
      
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterButton,
                selectedFilter === option.value && styles.filterButtonActive,
                selectedFilter === option.value && option.value !== 'ALL' && { backgroundColor: getStatusColor(option.value) },
                // Add dashed border for filters with no locations
                option.value !== 'ALL' && statusCounts[option.value] === 0 && styles.emptyFilterButton
              ]}
              onPress={() => setSelectedFilter(option.value)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedFilter === option.value && styles.filterButtonTextActive,
                  // Gray out text for filters with no locations
                  option.value !== 'ALL' && statusCounts[option.value] === 0 && styles.emptyFilterButtonText
                ]}
              >
                {option.label}
                {option.value !== 'ALL' && statusCounts[option.value] > 0 && (
                  <Text style={styles.filterCount}> ({statusCounts[option.value]})</Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Debug button - only visible in __DEV__ mode */}
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: '#666', borderColor: '#555' }]}
              onPress={() => {
                const statusCounts = {};
                locations.forEach(loc => {
                  const status = loc.status || 'undefined';
                  statusCounts[status] = (statusCounts[status] || 0) + 1;
                });
                console.log('Status counts:', statusCounts);
                
                // Convert numeric status to readable labels
                const readableStatusCounts = {};
                Object.keys(statusCounts).forEach(key => {
                  const numKey = Number(key);
                  const label = isNaN(numKey) ? key : getStatusLabel(numKey);
                  readableStatusCounts[label] = statusCounts[key];
                });
                
                Alert.alert('Status Counts', JSON.stringify(readableStatusCounts, null, 2));
              }}
            >
              <Text style={[styles.filterButtonText, { color: '#fff' }]}>Debug</Text>
            </TouchableOpacity>
          )}
          
        </ScrollView>
      </View>

      <FlatList
        data={filteredLocations}
        keyExtractor={(item) => item._id}
        renderItem={renderLocation}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            {error ? (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={fetchLocations}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noData}>
                {searchQuery 
                  ? `No ${selectedFilter !== 'ALL' ? getStatusLabel(selectedFilter).toLowerCase() : ''} locations matching "${searchQuery}"` 
                  : selectedFilter !== 'ALL'
                    ? `No locations with status: ${getStatusLabel(selectedFilter)}`
                    : 'No locations found'}
              </Text>
            )}
            {selectedFilter !== 'ALL' && !error && (
              <TouchableOpacity 
                style={styles.filterTip}
                onPress={() => setSelectedFilter('ALL')}
              >
                <Text style={styles.filterTipText}>Show all locations</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 16,
    marginHorizontal: 16,
    color: '#222',
  },
  searchContainer: {
    marginHorizontal: 16,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  coordinates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  details: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  comment: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    marginVertical: 2,
  },
  separator: {
    height: 12,
  },
  listContent: {
    paddingVertical: 8,
  },
  noData: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  filterContainer: {
    marginHorizontal: 16,
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
  emptyFilterButton: {
    borderStyle: 'dashed',
    borderColor: '#bdbdbd',
    backgroundColor: '#f9f9f9',
  },
  emptyFilterButtonText: {
    color: '#9e9e9e',
  },
  filterCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 20,
    marginTop: 16,
    backgroundColor: '#1976D2',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterTip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 20,
    marginTop: 16,
  },
  filterTipText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
