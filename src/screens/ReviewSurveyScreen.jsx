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
  const { currentUser, loading: userLoading } = useCurrentUser();

  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const fetchLocations = useCallback(async () => {
    if (!currentUser?._id) {
      console.log('Cannot fetch locations: no current user ID');
      return;
    }
    
    try {
      console.log('Starting to fetch locations');
      setLoading(true);
      const url = `${LOCATION_URL}/api/locations?createdBy=${currentUser._id}&status=COMPLETED,APPROVED,REJECTED`;
      console.log('Fetching locations from URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response from locations API:', errorText);
        return;
      }

      const data = await response.json();
      console.log('Locations fetched:', data.data?.length || 0);
      setLocations(data.data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      Alert.alert('Error', `Failed to fetch locations: ${error.message}`);
    } finally {
      console.log('Finished location fetch, setting loading to false');
      setLoading(false);
    }
  }, [currentUser?._id]);

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
      case 'APPROVED':
        return '#4CAF50';
      case 'REJECTED':
        return '#F44336';
      default:
        return '#1976D2';
    }
  };

  // Filter and search locations
  const getFilteredLocations = useCallback(() => {
    const query = searchQuery.toLowerCase().trim();
    
    return locations.filter(location => {
      // First filter by status
      if (selectedFilter !== 'ALL' && location.status !== selectedFilter) {
        return false;
      }
      
      // Then filter by search query if there is one
      if (query) {
        // Check if location title matches
        if (location.title?.toLowerCase().includes(query)) return true;
        
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

  const renderLocation = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ReviewDetails', { 
        locationId: item._id,
        status: item.status,
        reviewComment: item.reviewComment 
      })}
    >
      <View style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.coordinates}>
            📍 ({item.centerPoint.coordinates[1].toFixed(6)}, {item.centerPoint.coordinates[0].toFixed(6)})
          </Text>
          <Text style={styles.details}>Radius: {item.radius}m</Text>
          <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
            Status: {item.status}
          </Text>
          {(item.status === 'APPROVED' || item.status === 'REJECTED') && item.reviewComment && (
            <Text style={styles.comment}>Comment: {item.reviewComment}</Text>
          )}
        </View>
        <ChevronRight color="#999" size={22} />
      </View>
    </TouchableOpacity>
  );

  if (userLoading || loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Review Completed Locations</Text>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by location title or comments"
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

      {locations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.noData}>No completed locations found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchLocations}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredLocations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.noData}>
            {searchQuery 
              ? `No ${selectedFilter.toLowerCase()} locations matching "${searchQuery}"` 
              : `No ${selectedFilter.toLowerCase()} locations found`}
          </Text>
          {selectedFilter !== 'ALL' && (
            <TouchableOpacity 
              style={styles.filterTip}
              onPress={() => setSelectedFilter('ALL')}
            >
              <Text style={styles.filterTipText}>Show all locations</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
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
        />
      )}
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
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 20,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#1976D2',
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
