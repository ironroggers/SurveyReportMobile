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
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {LOCATION_URL} from "../api-url";

export default function ReviewSurveyScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const { currentUser, loading: userLoading } = useCurrentUser();

  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const filteredLocations = locations.filter(location => {
    if (selectedFilter === 'ALL') return true;
    return location.status === selectedFilter;
  });

  const fetchLocations = useCallback(async () => {
    if (!currentUser?.id || loading) return;
    
    try {
      setLoading(true);
      const url = `${LOCATION_URL}/api/locations?createdBy=${currentUser.id}&status=COMPLETED,APPROVED,REJECTED`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
      }

      const data = await response.json();
      setLocations(data.data || []);
    } catch (error) {
      Alert.alert('Error', `Failed to fetch locations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLocations().finally(() => setRefreshing(false));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!userLoading && currentUser?.id) {
      fetchLocations();
    }
  }, [userLoading, currentUser?.id, fetchLocations]);

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
        </View>
      ) : filteredLocations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.noData}>No {selectedFilter.toLowerCase()} locations found</Text>
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
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 16,
    marginHorizontal: 16,
    color: '#222',
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
});
