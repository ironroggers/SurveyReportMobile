import React, { useState, useEffect, useCallback } from 'react';
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
  Platform
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Marker, Polygon } from 'react-native-maps';
import ImageViewing from 'react-native-image-viewing';
import {LOCATION_URL, SURVEY_URL} from "../api-url";
import SafeMapView from '../components/SafeMapView';

const windowWidth = Dimensions.get('window').width;
const imageSize = 100; // Fixed size for thumbnails

export default function ReviewDetailsScreen({ route, navigation }) {
  const { locationId, status: initialStatus, reviewComment: initialReviewComment, isViewOnly } = route.params;
  const [location, setLocation] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [comments, setComments] = useState('');
  const [actionType, setActionType] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [isImageViewVisible, setIsImageViewVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const mapRef = React.useRef(null);

  const fetchLocationAndSurveys = useCallback(async () => {
    if (!locationId || loading) return;

    try {
      setLoading(true);

      // Fetch location details
      const locationResponse = await fetch(`${LOCATION_URL}/api/locations/${locationId}`);
      console.log("locationResponse : ",locationResponse);

      if (!locationResponse.ok) {
        const errorText = await locationResponse.text();
        console.log('Location error response:', errorText);
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
      const surveyUrl = `${SURVEY_URL}/api/surveys?location=${locationId}`;

      const surveysResponse = await fetch(surveyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      

      if (!surveysResponse.ok) {
        const errorText = await surveysResponse.text();
        console.log('Survey error response:', errorText);
      }

      const surveysData = await surveysResponse.json();
      setSurveys(surveysData.data || []);
    } catch (error) {
      console.log('Error fetching data:', error.message);
      console.log('Full error object:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, [locationId, loading]);

  useEffect(() => {
    // Set navigation title based on mode
    if (isViewOnly) {
      navigation.setOptions({
        headerTitle: 'View Survey Details',
        headerRight: () => (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )
      });
    }
    
    fetchLocationAndSurveys();
  }, []);

  const handleActionPress = useCallback((type) => {
    setActionType(type);
    setComments('');
    setIsModalVisible(true);
  }, []);

  const handleConfirmAction = async () => {
    if (!comments.trim()) {
      Alert.alert('Error', 'Please add comments before proceeding');
      return;
    }

    try {
      setUpdating(true);
      const response = await fetch(`${LOCATION_URL}/api/locations/${locationId}`, {
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
        const errorText = await response.text();
      }

      Alert.alert(
        'Success',
        `Location has been ${actionType.toLowerCase()}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.log('Error updating location:', error);
      Alert.alert('Error', error.message);
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

  const fitMapToPoints = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add location center point
      points.push({
        latitude: location.centerPoint.coordinates[1],
        longitude: location.centerPoint.coordinates[0],
      });
      
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
      if (location.geofence?.coordinates[0]) {
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
        {isViewOnly && (
          <View style={styles.viewOnlyBanner}>
            <Text style={styles.viewOnlyText}>🔒 View Only Mode - This survey cannot be edited</Text>
          </View>
        )}
        <View style={styles.mapContainer}>
          <SafeMapView
            style={styles.map}
            region={{
              latitude: location.centerPoint.coordinates[1],
              longitude: location.centerPoint.coordinates[0],
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            fallbackText="Map temporarily unavailable"
            fallbackSubText="Location data is still available"
          >
            {/* Location center point marker */}
            <Marker
              coordinate={{
                latitude: location.centerPoint.coordinates[1],
                longitude: location.centerPoint.coordinates[0],
              }}
              title={location.title}
              description="Location Center"
              pinColor="red"
            />

            {/* Survey point markers */}
            {surveys.map((survey, index) => (
              survey.terrainData?.centerPoint?.coordinates && (
                <Marker
                  key={`survey-${survey._id || index}`}
                  coordinate={{
                    latitude: survey.terrainData.centerPoint.coordinates[1],
                    longitude: survey.terrainData.centerPoint.coordinates[0]
                  }}
                  title={survey.title}
                  description={`Terrain: ${survey.terrainData.terrainType}`}
                  pinColor="blue"
                />
              )
            ))}

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
          </SafeMapView>
          
          <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
            <Text style={styles.btnText}>Fit All Points</Text>
          </TouchableOpacity>
          
          {/* Map Legend */}
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'red' }]} />
              <Text style={styles.legendText}>Location Center</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'blue' }]} />
              <Text style={styles.legendText}>Survey Points</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF0000' }]} />
              <Text style={styles.legendText}>Location Boundary</Text>
            </View>
          </View>
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
                  Attachments ({survey.mediaFiles?.length || 0})
                </Text>
                <FlatList
                  horizontal
                  data={survey.mediaFiles || []}
                  keyExtractor={(item, idx) => `${survey._id}-attachment-${idx}`}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item, index: idx }) => (
                    <TouchableOpacity
                      onPress={() => {
                        const previousMediaCount = surveys
                          .slice(0, index)
                          .reduce((count, s) => count + (s.mediaFiles?.length || 0), 0);
                        setSelectedImageIndex(previousMediaCount + idx);
                        setIsImageViewerVisible(true);
                      }}
                      style={styles.attachmentItem}
                    >
                      {item.fileType === 'IMAGE' ? (
                        <View style={styles.thumbnailContainer}>
                          <Image
                            source={{ 
                              uri: item.url,
                              headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache'
                              }
                            }}
                            style={styles.thumbnail}
                            defaultSource={require('../assets/image-placeholder.png')}
                            onError={(error) => {
                              const errorMessage = error?.nativeEvent?.error || 'Failed to load image';
                              console.log('Image loading error:', errorMessage);
                              if (errorMessage.includes('403')) {
                                Alert.alert(
                                  'Image Access Error',
                                  'The image link has expired. Please try refreshing the page or contact support if the issue persists.'
                                );
                              }
                            }}
                          />
                          <View style={styles.imageOverlay}>
                            <Text style={styles.imageStatus}>
                              {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : 'No date'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.thumbnail, styles.fileTypeIndicator]}>
                          <Text style={styles.fileTypeText}>
                            {item.fileType === 'VIDEO' ? '🎥' : '📄'}
                          </Text>
                          <Text style={styles.fileDescription} numberOfLines={2}>
                            {item.description || item.fileType.toLowerCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.attachmentsList}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Only show action buttons if status is COMPLETED and not in view-only mode */}
      {location.status === 'COMPLETED' && !isViewOnly && (
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
        images={surveys.reduce((acc, survey) => {
          const images = survey.mediaFiles
            ?.filter(file => file.fileType === 'IMAGE')
            .map(file => ({ uri: file.url })) || [];
          return [...acc, ...images];
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
  thumbnailContainer: {
    position: 'relative',
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  thumbnailLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
  },
  thumbnail: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
  },
  fileTypeIndicator: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fileTypeText: {
    fontSize: 24,
    marginBottom: 4,
  },
  fileDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  mapLegend: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  fitBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
  },
  imageStatus: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  doneButton: {
    padding: 8,
    borderRadius: 5,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  viewOnlyBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FF9800',
    alignItems: 'center',
  },
  viewOnlyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    textAlign: 'center',
  },
});
