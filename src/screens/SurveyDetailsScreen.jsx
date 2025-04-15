import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';

export default function SurveyDetailsScreen({ route, navigation }) {
  const { survey } = route.params;

  const [details, setDetails] = useState(survey.details);
  const [attachments, setAttachments] = useState(survey.attachments);

  const handleUploadAttachments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Allow access to media library to upload attachments.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      setAttachments([...attachments, ...result.assets]);
    }
  };

  const handleSaveChanges = () => {
    // Here you can send updated survey details back to SurveyListScreen via route or context
    Alert.alert('Saved', 'Survey updated successfully!');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: survey.location.latitude,
          longitude: survey.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={survey.location} />
      </MapView>

      <View style={styles.content}>
        <Text style={styles.label}>Survey Details:</Text>
        <TextInput
          style={styles.input}
          value={details}
          multiline
          onChangeText={setDetails}
          placeholder="Describe terrain, elevation, infra..."
        />

        <View style={styles.attachmentHeader}>
          <Text style={styles.label}>Attachments:</Text>
          <TouchableOpacity onPress={handleUploadAttachments}>
            <Text style={styles.uploadBtn}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.attachmentsContainer}>
          {attachments.map((file, index) => (
            <Image key={index} source={{ uri: file.uri }} style={styles.attachment} />
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges}>
          <Text style={styles.saveText}>💾 Save Changes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { height: 300, width: '100%' },
  content: { padding: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadBtn: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 16,
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  attachment: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  saveBtn: {
    backgroundColor: '#388E3C',
    padding: 14,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
