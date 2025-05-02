import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Modal, Platform, ActivityIndicator, SafeAreaView, Dimensions, KeyboardAvoidingView, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import uuid from 'react-native-uuid';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Picker } from '@react-native-picker/picker';
import {SURVEY_URL} from "../api-url";
import * as FileSystem from 'expo-file-system';
import SafeMapView from '../components/SafeMapView';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import AttachmentViewer from '../components/AttachmentViewer';

// Custom Dropdown Component
const CustomDropdown = ({ options, selectedValue, onValueChange, placeholder, disabled }) => {
  const [visible, setVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    options.find(option => option === selectedValue) || null
  );

  useEffect(() => {
    const option = options.find(option => option === selectedValue);
    setSelectedOption(option);
  }, [selectedValue, options]);

  const toggleDropdown = () => {
    if (disabled) return;
    setVisible(!visible);
  };

  const onItemPress = (item) => {
    setSelectedOption(item);
    onValueChange(item);
    setVisible(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.dropdownItem} 
      onPress={() => onItemPress(item)}
    >
      <Text style={[
        styles.dropdownItemText,
        selectedOption === item && styles.dropdownItemSelected
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.dropdownContainer, disabled && styles.disabledInput]}>
      <TouchableOpacity 
        style={styles.dropdownButton} 
        onPress={toggleDropdown}
        disabled={disabled}
      >
        <Text style={styles.dropdownButtonText}>
          {selectedOption || placeholder || 'Select an option'}
        </Text>
        <Ionicons 
          name={visible ? "chevron-up" : "chevron-down"} 
          size={20} 
          color="#555"
        />
      </TouchableOpacity>
      
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <FlatList
              data={options}
              renderItem={renderItem}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default function SurveyFormScreen() {
  const [location, setLocation] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [details, setDetails] = useState('');
  const [mapRegion, setMapRegion] = useState(null);
  const [title, setTitle] = useState('');
  const [terrainType, setTerrainType] = useState('URBAN');
  const [rowAuthority, setRowAuthority] = useState('NHAI');
  const navigation = useNavigation();
  const route = useRoute();
  const assignedLocation = route.params?.locationData;
  const currentLocation = route.params?.location;
  const existingSurvey = route.params?.existingSurvey;
  const isViewOnly = route.params?.isViewOnly || false; // Default to false (edit mode)
  const { currentUser } = useCurrentUser();
  const [isUploading, setIsUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const [isAttachmentViewerVisible, setIsAttachmentViewerVisible] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);
  
  console.log("currentLocation", currentLocation, assignedLocation);
  console.log("existingSurvey", existingSurvey);
  console.log("isViewOnly mode:", isViewOnly);

  const TERRAIN_TYPES = ['URBAN', 'RURAL', 'FOREST', 'MOUNTAIN', 'WETLAND', 'COASTAL'];
  const ROW_AUTHORITIES = ['NHAI', 'NH', 'State Highway', 'Forest', 'Municipal Coorporation', 'Municipality', 'Gram Panchayat', 'Railway', 'Private Road', 'Others'];

  const mapRef = React.useRef(null);
  const { height } = Dimensions.get('window');

  // Populate form with existing survey data when it's provided
  useEffect(() => {
    if (existingSurvey) {
      console.log('Prefilling form with existing survey data:', existingSurvey);
      
      // Set title and details
      setTitle(existingSurvey.title || '');
      setDetails(existingSurvey.description || '');
      
      // Set terrain type if available
      if (existingSurvey.terrainData && existingSurvey.terrainData.type) {
        setTerrainType(existingSurvey.terrainData.type || 'URBAN');
      }
      
      // Set rowAuthority if available
      if (existingSurvey.rowAuthority) {
        setRowAuthority(existingSurvey.rowAuthority);
      } else {
        // Default to NHAI if not present
        setRowAuthority('NHAI');
      }
      
      // Set location based on survey coordinates
      if (existingSurvey.latlong && existingSurvey.latlong.length >= 2) {
        const surveyLocation = {
          latitude: existingSurvey.latlong[0],
          longitude: existingSurvey.latlong[1]
        };
        
        setLocation(surveyLocation);
        
        // Set map region around the survey location
        setMapRegion({
          latitude: surveyLocation.latitude,
          longitude: surveyLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
      
      // Load media files from the existing survey
      if (existingSurvey.mediaFiles && existingSurvey.mediaFiles.length > 0) {
        const formattedMediaFiles = existingSurvey.mediaFiles.map(file => ({
          url: file.url,
          fileType: file.fileType || getFileType(getMimeType(file.url)),
          description: file.description || '',
          uploaded_at: file.uploaded_at || new Date()
        }));
        
        setMediaFiles(formattedMediaFiles);
      }
    }
  }, [existingSurvey]);

  // Set current location from route params
  useEffect(() => {
    if (currentLocation?.latitude && currentLocation?.longitude && !existingSurvey) {
      setLocation(currentLocation);
      
      setMapRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation, existingSurvey]);

  const handleUploadAttachments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Allow access to media library to upload attachments.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.5, // Reduced quality for better upload performance
      allowsEditing: false,
      exif: false, // Don't need EXIF data
    });

    processSelectedMedia(result);
  };

  const handleTakePicture = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert('Permission Denied', 'Allow access to camera to take pictures.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    processSelectedMedia(result);
  };

  const processSelectedMedia = (result) => {
    if (!result.canceled) {
      // Show file size warning for large files
      const largeFiles = result.assets.filter(asset => asset.fileSize && asset.fileSize > 5000000); // 5MB
      if (largeFiles.length > 0) {
        Alert.alert(
          'Large File Warning',
          'Some selected files are large and may take longer to upload. Do you want to continue?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue',
              onPress: () => {
                const newMediaFiles = result.assets.map(asset => ({
                  url: asset.uri,
                  fileType: getFileType(asset.type || getMimeType(asset.uri)),
                  description: '',
                  fileSize: asset.fileSize,
                  uploaded_at: new Date()
                }));
                setMediaFiles([...mediaFiles, ...newMediaFiles]);
              }
            }
          ]
        );
      } else {
        const newMediaFiles = result.assets.map(asset => ({
          url: asset.uri,
          fileType: getFileType(asset.type || getMimeType(asset.uri)),
          description: '',
          fileSize: asset.fileSize,
          uploaded_at: new Date()
        }));
        setMediaFiles([...mediaFiles, ...newMediaFiles]);
      }
    }
  };

  const getFileType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'DOCUMENT';
  };

  const getMimeType = (fileName) => {
    const extension = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'heic': 'image/heic',
      'heif': 'image/heif',
      // Videos
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'webm': 'video/webm',
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  };

  const uploadFile = async (fileUri) => {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.log('File does not exist');
        throw new Error('File does not exist');
      }

      // Check if file is very large and might need extra handling
      if (fileInfo.size > 10000000) { // 10MB
        console.log('Very large file detected:', fileInfo.size, 'bytes');
      }

      // Get the file name from the URI
      const fileName = fileUri.split('/').pop();
      
      // Determine mime type based on file extension
      const mimeType = getMimeType(fileName);
      // Determine file type based on mime type
      const fileType = getFileType(mimeType);
      console.log('Uploading file:', { fileName, fileType, mimeType, size: fileInfo.size });
      
      // For images, try to compress them before uploading
      let finalUri = fileUri;
      if (fileType === 'IMAGE' && fileInfo.size > 1000000) { // 1MB
        try {
          console.log('Compressing image before upload...');
          const manipResult = await ImageManipulator.manipulateAsync(
            fileUri,
            [{ resize: { width: 1200 } }], // resize to max width of 1200px while maintaining aspect ratio
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalUri = manipResult.uri;
          const compressedInfo = await FileSystem.getInfoAsync(finalUri);
          console.log('Compressed image size:', compressedInfo.size, 'bytes (original was', fileInfo.size, 'bytes)');
        } catch (compressError) {
          console.log('Image compression failed, using original:', compressError);
          // Continue with original file if compression fails
        }
      }
      
      // Create form data
      const formData = new FormData();
      
      // Properly format the file object for multipart/form-data
      formData.append('file', {
        uri: Platform.OS === 'ios' ? finalUri.replace('file://', '') : finalUri,
        type: mimeType,
        name: fileName,
      });

      console.log('Sending request to:', `${SURVEY_URL}/api/upload`);
      
      // Upload to your server with timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (increased from 30s)
      
      try {
        // First attempt to use fetch for upload
        const response = await fetch(`${SURVEY_URL}/api/upload`, {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header, let fetch set it with the boundary automatically
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
          console.log('Upload failed:', errorData);
          throw new Error(errorData.message || `Upload failed with status ${response.status}`);
        }

        let data;
        try {
          data = await response.json();
          console.log('Upload response:', data);
        } catch (e) {
          console.log('Failed to parse response:', e);
          throw new Error('Failed to parse server response');
        }
        
        // Check if the response has the expected structure
        if (!data || !data.data || !data.data.url) {
          console.log('Invalid response format:', data);
          throw new Error('Server returned an invalid response format');
        }

        return {
          url: data.data.url,
          fileType: data.data.fileType || fileType || 'DOCUMENT',
          description: '',
          uploaded_at: new Date()
        };
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Upload timed out. Please check your internet connection and try again.');
        }
        
        // Try fallback upload method using FileSystem.uploadAsync for certain types of failures
        if (error.message && (error.message.includes('Network request failed') || error.message.includes('timed out'))) {
          console.log('Trying fallback upload method...');
          try {
            // If available, try using FileSystem.uploadAsync as a fallback
            if (FileSystem.uploadAsync) {
              const uploadResponse = await FileSystem.uploadAsync(`${SURVEY_URL}/api/upload`, finalUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                mimeType: mimeType,
                parameters: { fileName: fileName }
              });
              
              console.log('Fallback upload response:', uploadResponse);
              
              if (uploadResponse.status >= 200 && uploadResponse.status < 300) {
                let responseData;
                try {
                  responseData = JSON.parse(uploadResponse.body);
                  if (responseData && responseData.data && responseData.data.url) {
                    return {
                      url: responseData.data.url,
                      fileType: responseData.data.fileType || fileType || 'DOCUMENT',
                      description: '',
                      uploaded_at: new Date()
                    };
                  }
                } catch (e) {
                  console.log('Failed to parse fallback response:', e);
                }
              }
            }
          } catch (fallbackError) {
            console.log('Fallback upload method failed:', fallbackError);
          }
        }
        
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.log('Error in uploadFile:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    console.log('Submit pressed, existingSurvey:', route.params?.existingSurvey ? 
      `ID: ${route.params.existingSurvey._id}` : 'None (creating new survey)');
    
    // Special check for updates - only require images for new surveys
    const isUpdate = route.params?.existingSurvey && route.params.existingSurvey._id;
    const hasExistingImages = isUpdate && existingSurvey.mediaFiles && existingSurvey.mediaFiles.length > 0;
    
    // Basic validation for required fields
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!location) missingFields.push('location');
    if (!details) missingFields.push('details');
    if (!rowAuthority) missingFields.push('row authority');
    if (!hasExistingImages && mediaFiles.length === 0) missingFields.push('images');
    
    if (missingFields.length > 0) {
      if (missingFields.includes('images') && (!isUpdate || !hasExistingImages)) {
        // Special handling for the case when only images are missing
        Alert.alert(
          'No Images Selected',
          'Do you want to proceed without adding any images?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue Without Images',
              onPress: () => continueSubmission(true)
            }
          ]
        );
        return;
      } else {
        Alert.alert('Incomplete', `Please fill all required fields: ${missingFields.join(', ')}.`);
        return;
      }
    }
    
    // Continue with submission if all required fields are filled
    continueSubmission();
    
    async function continueSubmission(skipImageCheck = false) {
      try {
        setIsUploading(true);
  
        // First, upload all media files
        const uploadedMediaFiles = [];
        let uploadErrors = 0;
        
        // First add all existing remote media files (already uploaded)
        const existingRemoteFiles = mediaFiles.filter(file => file.url.startsWith('http'));
        console.log(`Found ${existingRemoteFiles.length} already uploaded files`);
        existingRemoteFiles.forEach(file => {
          uploadedMediaFiles.push({
            ...file,
            fileType: file.fileType || getFileType(getMimeType(file.url)) || 'DOCUMENT',
          });
        });
  
        // Then try to upload new local files
        const newLocalFiles = mediaFiles.filter(file => !file.url.startsWith('http'));
        console.log(`Attempting to upload ${newLocalFiles.length} new files`);
        
        if (newLocalFiles.length > 0) {
          // Sort files by size for better upload sequence (smallest first)
          newLocalFiles.sort((a, b) => {
            return (a.fileSize || 0) - (b.fileSize || 0);
          });
          
          for (const file of newLocalFiles) {
            try {
              // Log upload attempt
              console.log(`Attempting to upload file: ${file.url.split('/').pop()}`);
              
              const uploadResult = await uploadFile(file.url);
              if (uploadResult) {
                uploadedMediaFiles.push({
                  ...uploadResult,
                  description: file.description || '',
                  fileType: uploadResult.fileType || file.fileType || 'DOCUMENT',
                });
                console.log(`Successfully uploaded file: ${file.url.split('/').pop()}`);
              } else {
                uploadErrors++;
                console.log('Upload returned null result for file:', file.url);
              }
            } catch (error) {
              uploadErrors++;
              console.log('Error uploading file:', file.url.split('/').pop(), error);
              
              // For network errors, offer retry or continue
              if (error.message && (error.message.includes('Network request failed') || 
                                    error.message.includes('timed out'))) {
                const decision = await new Promise(resolve => {
                  Alert.alert(
                    'Network Error',
                    'Failed to upload image due to network issues. Would you like to retry, continue without this image, or cancel?',
                    [
                      {
                        text: 'Cancel Entire Submission',
                        style: 'cancel',
                        onPress: () => resolve('cancel')
                      },
                      {
                        text: 'Skip This Image',
                        onPress: () => resolve('continue')
                      },
                      {
                        text: 'Retry Upload',
                        onPress: () => resolve('retry')
                      }
                    ]
                  );
                });
                
                if (decision === 'cancel') {
                  setIsUploading(false);
                  return;
                } else if (decision === 'retry') {
                  try {
                    console.log('Retrying upload...');
                    const retryResult = await uploadFile(file.url);
                    if (retryResult) {
                      uploadedMediaFiles.push({
                        ...retryResult,
                        description: file.description || '',
                        fileType: retryResult.fileType || file.fileType || 'DOCUMENT',
                      });
                      uploadErrors--; // Decrease error count on success
                      console.log(`Successfully uploaded file on retry: ${file.url.split('/').pop()}`);
                    }
                  } catch (retryError) {
                    console.log('Retry failed:', retryError);
                    // Continue without this file
                  }
                }
                // If 'continue' is selected, we just move on
              } else {
                // For other errors, just ask if user wants to continue
                const shouldContinue = await new Promise(resolve => {
                  Alert.alert(
                    'Upload Error',
                    `Failed to upload file: ${error.message}. Would you like to continue without this file?`,
                    [
                      {
                        text: 'Cancel Submission',
                        style: 'cancel',
                        onPress: () => resolve(false)
                      },
                      {
                        text: 'Continue Without This File',
                        onPress: () => resolve(true)
                      }
                    ]
                  );
                });
                
                if (!shouldContinue) {
                  setIsUploading(false);
                  return;
                }
              }
            }
          }
        }
        
        // Check if we should continue with no images
        if (uploadedMediaFiles.length === 0 && !skipImageCheck && !hasExistingImages) {
          const shouldContinue = await new Promise(resolve => {
            Alert.alert(
              'No Images',
              'You are creating a survey without any images. This is not recommended. Do you want to continue anyway?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false)
                },
                {
                  text: 'Continue Without Images',
                  onPress: () => resolve(true)
                }
              ]
            );
          });
          
          if (!shouldContinue) {
            setIsUploading(false);
            return;
          }
        }
        
        // Warn if some uploads failed
        if (uploadErrors > 0) {
          console.log(`${uploadErrors} out of ${newLocalFiles.length} uploads failed`);
          
          if (uploadedMediaFiles.length === 0 && !hasExistingImages && !skipImageCheck) {
            const shouldContinue = await new Promise(resolve => {
              Alert.alert(
                'Upload Failures',
                'All uploads failed. You can continue without images or cancel to try again later.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => resolve(false)
                  },
                  {
                    text: 'Continue Without Images',
                    onPress: () => resolve(true)
                  }
                ]
              );
            });
            
            if (!shouldContinue) {
              setIsUploading(false);
              return;
            }
          } else if (uploadErrors > 0) {
            // Just notify that some uploads failed
            Alert.alert(
              'Some Uploads Failed',
              `${uploadErrors} out of ${newLocalFiles.length} files could not be uploaded. Continuing with the successfully uploaded files.`,
              [{ text: 'OK' }]
            );
          }
        }
  
        // Create survey data according to new schema
        const surveyData = {
          title,
          description: details,
          location: assignedLocation._id,
          // Store coordinates in [latitude, longitude] format as required by the new schema
          // If we're updating and the current location comes from an existing survey, use that
          latlong: existingSurvey && !currentLocation ? 
            existingSurvey.latlong : 
            [location?.latitude || 0, location?.longitude || 0],
          created_by: existingSurvey?.created_by?._id || currentUser?._id,
          updated_by: currentUser?._id,
          terrainData: {
            type: terrainType
          },
          rowAuthority: rowAuthority,
          mediaFiles: uploadedMediaFiles,
          status: existingSurvey?.status || 1
        };
  
        console.log('Sending survey data:', surveyData);
        
        // Validate that we have a valid ID for updates
        if (isUpdate) {
          console.log(`Updating existing survey with ID: ${route.params.existingSurvey._id}`);
        } else {
          console.log('Creating new survey');
        }
        
        const url = isUpdate 
          ? `${SURVEY_URL}/api/surveys/${route.params.existingSurvey._id}`
          : `${SURVEY_URL}/api/surveys`;
        
        const method = isUpdate ? 'PUT' : 'POST';
        console.log(`Making ${method} request to ${url}`);
  
        try {
          // Add a retry mechanism for the survey submission
          let retryCount = 0;
          const maxRetries = 2;
          let response = null;
          
          while (retryCount <= maxRetries && !response) {
            try {
              response = await fetch(url, {
                method: method,
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(surveyData)
              });
            } catch (fetchError) {
              console.log(`Attempt ${retryCount + 1} failed:`, fetchError);
              retryCount++;
              
              if (retryCount <= maxRetries) {
                console.log(`Retrying submission (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
              } else {
                throw fetchError; // Throw the error after all retries fail
              }
            }
          }
          
          if (!response) {
            throw new Error('Failed to submit survey after multiple attempts');
          }
    
          console.log('Response status:', response.status);
          
          if (!response.ok) {
            const errorData = await response.json().catch(e => ({ message: 'Failed to parse error response' }));
            console.log('Error response:', errorData);
            Alert.alert('Error', `Failed to submit survey: ${errorData.message || response.status}`);
            setIsUploading(false);
            return;
          }
    
          const result = await response.json();
          console.log('Survey successfully submitted/updated:', result.data);
          
          // Ensure we're passing the new survey data back to the LocationDetails screen
          if (result.data) {
            // Get the previous screen from the navigation state
            const navState = navigation.getState();
            const prevRoute = navState.routes[navState.index - 1];
            
            // If previous screen is LocationDetails, set the newSurvey param
            if (prevRoute && prevRoute.name === 'LocationDetails') {
              // Set the survey data as a param for the previous screen
              navigation.setParams({ newSurvey: result.data });
              
              // Navigate back with the updated survey data
              navigation.goBack()
            } else {
              // Just go back if not from LocationDetails
              navigation.goBack();
            }
          } else {
            navigation.goBack();
          }
        } catch (networkError) {
          console.log('Network error during survey submission:', networkError);
          
          const decision = await new Promise(resolve => {
            Alert.alert(
              'Network Error',
              'Failed to submit survey due to network issues. Would you like to try again?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve('cancel')
                },
                {
                  text: 'Try Again',
                  onPress: () => resolve('retry')
                }
              ]
            );
          });
          
          if (decision === 'retry') {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Call continueSubmission again to retry submission
            continueSubmission(true); // Skip image check on retry
            return;
          }
        }
      } catch (error) {
        console.log('Error in handleSubmit:', error);
        Alert.alert(
          'Error',
          `Failed to ${route.params?.existingSurvey ? 'update' : 'create'} survey: ${error.message}`
        );
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Ray casting algorithm to check if point is inside polygon
  const isPointInPolygon = (point, polygon) => {
    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
      if (intersect) inside = !inside;
    }

    return inside;
  };

  const fitMapToPoints = () => {
    if (mapRef.current) {
      const points = [];
      
      // Add survey point if available
      if (location) {
        points.push(location);
      }
      
      // Add geofence points if available
      if (assignedLocation?.geofence?.coordinates[0]?.length > 0) {
        assignedLocation.geofence.coordinates[0].forEach(([lng, lat]) => {
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

  return (
    <View style={styles.container}>
      {/* View-only mode banner */}
      {isViewOnly && (
        <View style={styles.viewOnlyBanner}>
          <Text style={styles.viewOnlyText}>View Only Mode - Editing not allowed</Text>
        </View>
      )}
      
      {/* Loading overlay */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Uploading files and submitting survey...</Text>
        </View>
      )}
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mapContainer}>
            <SafeMapView
              ref={mapRef}
              style={styles.map}
              region={mapRegion}
              showsUserLocation={true}
              fallbackText="Map temporarily unavailable"
              fallbackSubText="Location information will still be recorded"
            >
              {/* Show center marker */}
              {location?.centerPoint?.coordinates && (
                <Marker
                  coordinate={{
                    latitude: location.centerPoint.coordinates[1],
                    longitude: location.centerPoint.coordinates[0],
                  }}
                  title={location.title || "Survey Location"}
                  description={`Status: ${location.status}`}
                  pinColor="#1976D2"
                />
              )}

              {/* Show polygon if available */}
              {location?.geofence?.coordinates?.[0]?.length > 0 && (
                <Polygon
                  coordinates={location.geofence.coordinates[0].map(([lng, lat]) => ({
                    latitude: lat,
                    longitude: lng,
                  }))}
                  strokeColor="#1976D2"
                  fillColor="rgba(25, 118, 210, 0.2)"
                  strokeWidth={2}
                />
              )}
            </SafeMapView>

            <TouchableOpacity style={styles.fitBtn} onPress={fitMapToPoints}>
              <Ionicons name="expand" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={[styles.textInput, isViewOnly && styles.disabledInput]}
                placeholder="Enter survey point title"
                value={title}
                onChangeText={setTitle}
                editable={!isViewOnly}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Survey Location</Text>
              <View style={styles.locationDisplay}>
                <Ionicons name="location" size={18} color="#1976D2" style={styles.locationIcon} />
                <Text style={styles.coordinates}>
                  {location ? 
                    `Lat: ${location.latitude?.toFixed(6)}, Long: ${location.longitude?.toFixed(6)}` :
                    'No location selected'
                  }
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Survey Details</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Terrain Type</Text>
              <CustomDropdown
                options={TERRAIN_TYPES}
                selectedValue={terrainType}
                onValueChange={(value) => setTerrainType(value)}
                placeholder="Select terrain type"
                disabled={isViewOnly}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Right of Way Authority</Text>
              <CustomDropdown
                options={ROW_AUTHORITIES}
                selectedValue={rowAuthority}
                onValueChange={(value) => setRowAuthority(value)}
                placeholder="Select authority"
                disabled={isViewOnly}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Survey Details</Text>
              <TextInput
                style={[styles.textAreaInput, isViewOnly && styles.disabledInput]}
                placeholder="Enter terrain, infrastructure info..."
                multiline
                value={details}
                onChangeText={setDetails}
                editable={!isViewOnly}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Attachments</Text>
            </View>
            
            {!isViewOnly && (
              <View style={styles.attachmentActions}>
                <TouchableOpacity 
                  style={styles.attachmentButton} 
                  onPress={handleUploadAttachments}
                >
                  <Ionicons name="images" size={18} color="#fff" />
                  <Text style={styles.attachmentButtonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.attachmentButton, styles.cameraButton]} 
                  onPress={handleTakePicture}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.attachmentButtonText}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.attachmentsContainer}>
              {mediaFiles.length === 0 ? (
                <Text style={styles.noAttachmentsText}>No attachments added</Text>
              ) : (
                mediaFiles.map((file, idx) => (
                  <View key={idx} style={styles.mediaFileContainer}>
                    {file.fileType === 'IMAGE' ? (
                      <TouchableOpacity 
                        style={styles.imageContainer}
                        onPress={() => {
                          setSelectedAttachmentIndex(idx);
                          setIsAttachmentViewerVisible(true);
                        }}
                      >
                        <Image 
                          source={{ 
                            uri: file.url,
                            headers: {
                              'Cache-Control': 'no-cache',
                              'Pragma': 'no-cache'
                            }
                          }}
                          style={styles.attachment}
                          defaultSource={require('../assets/image-placeholder.png')}
                          onError={(error) => {
                            const errorMessage = error?.nativeEvent?.error || 'Failed to load image';
                            console.log('Image loading error:', errorMessage);
                            if (errorMessage.includes('403')) {
                              Alert.alert(
                                'Image Access Error',
                                'The image link has expired. Please try re-uploading the image.',
                                [
                                  {
                                    text: 'Remove Image',
                                    onPress: () => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))
                                  },
                                  {
                                    text: 'Cancel',
                                    style: 'cancel'
                                  }
                                ]
                              );
                            }
                          }}
                        />
                        <View style={styles.imageOverlay}>
                          <Text style={styles.imageStatus}>
                            {file.url.startsWith('http') ? '✓ Uploaded' : 'Pending Upload'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.attachment, styles.fileTypeIndicator]}>
                        <Text style={styles.fileTypeText}>
                          {file.fileType === 'VIDEO' ? '🎥' : '📄'}
                        </Text>
                      </View>
                    )}
                    {/* Only show remove button if not in view-only mode */}
                    {!isViewOnly && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
          
          {/* Add padding at the bottom to ensure content is visible above the fixed footer */}
          <View style={styles.footerSpace} />
        </ScrollView>

        {/* Fixed footer with submit button */}
        {!isViewOnly && (
          <SafeAreaView style={styles.footer}>
            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSubmit}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitText}>
                {route.params?.existingSurvey ? 'Update' : 'Submit'} Survey
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>

      {/* Attachment Viewer */}
      <AttachmentViewer
        visible={isAttachmentViewerVisible}
        attachments={mediaFiles}
        initialIndex={selectedAttachmentIndex}
        onClose={() => setIsAttachmentViewerVisible(false)}
      />
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  mapContainer: {
    height: 250,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  label: { 
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#555',
  },
  textInput: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  textAreaInput: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e1fa',
  },
  locationIcon: {
    marginRight: 8,
  },
  coordinates: {
    fontSize: 14,
    color: '#4a4a4a',
  },
  // Dropdown styles
  dropdownContainer: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  dropdownButtonText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 5,
    width: '90%',
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  dropdownItemSelected: {
    color: '#1976D2',
    fontWeight: 'bold',
  },
  // Attachment styles
  attachmentButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentActions: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 12,
    minWidth: 90,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#388E3C',
  },
  attachmentButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  noAttachmentsText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaFileContainer: {
    position: 'relative',
    marginRight: 12,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
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
  attachment: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  fileTypeIndicator: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileTypeText: {
    fontSize: 24,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Footer styles
  footerSpace: {
    height: 80, // Space for the footer
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  submitBtn: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { 
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  fitBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  // View-only mode and loading overlay styles
  viewOnlyBanner: {
    padding: 10,
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#ef5350',
  },
  viewOnlyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c62828',
    textAlign: 'center',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#757575',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
    elevation: 5,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#1976D2',
  },
});
