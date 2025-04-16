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
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {LOCATION_URL} from "../api-url";

export default function ReviewSurveyScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentUser, loading: userLoading } = useCurrentUser();

  const fetchLocations = useCallback(async () => {
    if (!currentUser?.id || loading) return;
    
    try {
      setLoading(true);
      const url = `${LOCATION_URL}/api/locations?createdBy=${currentUser.id}&status=COMPLETED,APPROVED,REJECTED`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }

      const data = await response.json();
      setLocations(data.data || []);
    } catch (error) {
      Alert.alert('Error', `Failed to fetch locations: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
      {locations.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.noData}>No completed locations found</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item._id}
          renderItem={renderLocation}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
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
});
