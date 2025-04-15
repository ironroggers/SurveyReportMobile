import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import ImageViewing from 'react-native-image-viewing';

const windowWidth = Dimensions.get('window').width;
const imageSize = 100; // Fixed size for thumbnails

// Add dummy attachments to surveys
const dummySurveys = [
  {
    attachments: [
      { uri: 'https://images.unsplash.com/photo-1601933470928-c65adf64d515?w=800' },
      { uri: 'https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=800' },
    ]
  },
  {
    attachments: [
      { uri: 'https://images.unsplash.com/photo-1581092334554-5548ff8ee3cc?w=800' },
      { uri: 'https://images.unsplash.com/photo-1593642634367-d91a135587b5?w=800' },
      { uri: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=800' },
    ]
  }
];

export default function ReviewDetailsScreen({ route, navigation }) {
  const { locationId, status: initialStatus, reviewComment: initialReviewComment } = route.params;
  const [location, setLocation] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [comments, setComments] = useState('');
  const [actionType, setActionType] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchLocationAndSurveys();
  }, [locationId]);

  const fetchLocationAndSurveys = async () => {
    try {
      // Fetch location details
      const locationResponse = await fetch(`https://survey-service-nxvj.onrender.com/api/locations/${locationId}`);
      if (!locationResponse.ok) {
        throw new Error('Failed to fetch location details');
      }
      const locationData = await locationResponse.json();
      setLocation(locationData.data);

      // Set map region based on location
      if (locationData.data?.centerPoint?.coordinates) {
        setMapRegion({
          latitude: locationData.data.centerPoint.coordinates[1],
          longitude: locationData.data.centerPoint.coordinates[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // Fetch surveys for this location
      const surveysResponse = await fetch(`https://location-service-mig8.onrender.com/api/surveys?location=${locationId}`);
      if (!surveysResponse.ok) {
        throw new Error('Failed to fetch surveys');
      }
      const surveysData = await surveysResponse.json();
      setSurveys(surveysData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load location details');
    } finally {
      setLoading(false);
    }
  };

  const handleActionPress = (type) => {
    setActionType(type);
    setComments('');
    setIsModalVisible(true);
  };

  const handleConfirmAction = async () => {
    if (!comments.trim()) {
      Alert.alert('Error', 'Please add comments before proceeding');
      return;
    }

    try {
      setUpdating(true);
      const response = await fetch(`https://survey-service-nxvj.onrender.com/api/locations/${locationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...location,
          status: actionType,
          reviewComment: comments,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update location status');
      }

      Alert.alert(
        'Success',
        `Location has been ${actionType.toLowerCase()}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location status');
    } finally {
      setUpdating(false);
      setIsModalVisible(false);
    }
  };

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

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.errorText}>Location not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            scrollEnabled={true}
            zoomEnabled={true}
          >
            <Marker
              coordinate={{
                latitude: location.centerPoint.coordinates[1],
                longitude: location.centerPoint.coordinates[0],
              }}
              title={location.title}
            />
            {location.geofence?.coordinates[0] && (
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
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{location.title}</Text>
          <Text style={styles.coordinates}>
            📍 ({location.centerPoint.coordinates[1].toFixed(6)}, 
            {location.centerPoint.coordinates[0].toFixed(6)})
          </Text>
          <Text style={styles.details}>Radius: {location.radius}m</Text>
          <Text style={styles.details}>Comments : {location.comments}</Text>
          <Text style={[styles.status, { color: getStatusColor(location.status) }]}>
            Status: {location.status}
          </Text>
          
          {(location.status === 'APPROVED' || location.status === 'REJECTED') && location.reviewComment && (
            <View style={styles.reviewCommentContainer}>
              <Text style={styles.reviewCommentLabel}>Review Comment:</Text>
              <Text style={styles.reviewComment}>{location.reviewComment}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Survey Points ({surveys.length})</Text>
          {surveys.map((survey, index) => (
            <View key={survey._id} style={styles.surveyCard}>
              <Text style={styles.surveyTitle}>{survey.title}</Text>
              <Text style={styles.surveyDetail}>Terrain: {survey.terrainData?.terrainType}</Text>
              <Text style={styles.surveyDetail}>Elevation: {survey.terrainData?.elevation}m</Text>
              <Text style={styles.surveyDetail}>
                Infrastructure: {survey.terrainData?.existingInfrastructure.join(', ')}
              </Text>
              <Text style={styles.surveyDescription}>{survey.description}</Text>
              
              <View style={styles.attachmentsSection}>
                <Text style={styles.attachmentsTitle}>
                  Attachments ({((survey.attachments || []).length + dummySurveys[index % 2].attachments.length)})
                </Text>
                <FlatList
                  horizontal
                  data={[...(survey.attachments || []), ...dummySurveys[index % 2].attachments]}
                  keyExtractor={(_, idx) => `attachment-${index}-${idx}`}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item, index: idx }) => (
                    <TouchableOpacity
                      onPress={() => {
                        const previousAttachmentsCount = surveys
                          .slice(0, index)
                          .reduce((count, s) => count + ((s.attachments?.length || 0) + dummySurveys[index % 2].attachments.length), 0);
                        setSelectedImageIndex(previousAttachmentsCount + idx);
                        setIsImageViewerVisible(true);
                      }}
                      style={styles.attachmentItem}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.thumbnail}
                        loadingIndicatorSource={<ActivityIndicator color="#1976D2" />}
                      />
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.attachmentsList}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Only show action buttons if status is COMPLETED */}
      {location.status === 'COMPLETED' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleActionPress('REJECTED')}
          >
            <Text style={styles.actionBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleActionPress('APPROVED')}
          >
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'APPROVED' ? 'Approve' : 'Reject'} Location
            </Text>
            
            <Text style={styles.modalLabel}>Comments:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add your comments here..."
              value={comments}
              onChangeText={setComments}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleConfirmAction}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ImageViewing
        images={surveys.reduce((acc, survey, index) => {
          if (survey.attachments) {
            acc.push(...survey.attachments.map(attachment => ({ uri: attachment.uri })));
          }
          acc.push(...dummySurveys[index % 2].attachments.map(attachment => ({ uri: attachment.uri })));
          return acc;
        }, [])}
        imageIndex={selectedImageIndex}
        visible={isImageViewerVisible}
        onRequestClose={() => setIsImageViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
  },
  scrollContainer: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 300,
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  coordinates: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  reviewCommentContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  reviewCommentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: '#444',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  surveyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  surveyDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  surveyDescription: {
    fontSize: 14,
    color: '#444',
    marginTop: 8,
    marginBottom: 12,
  },
  attachmentsSection: {
    marginTop: 12,
  },
  attachmentsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  attachmentsList: {
    paddingVertical: 4,
  },
  attachmentItem: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  thumbnail: {
    width: imageSize,
    height: imageSize,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#f44336',
  },
  approveBtn: {
    backgroundColor: '#4caf50',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#222',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#444',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    marginBottom: 20,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#9e9e9e',
  },
  confirmBtn: {
    backgroundColor: '#1976D2',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
