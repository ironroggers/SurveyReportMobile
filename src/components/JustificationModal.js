import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import attendanceApi from '../api/attendanceApi';

const JustificationModal = ({ visible, onClose, attendanceId, onSuccess }) => {
  const [justification, setJustification] = useState('');
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!justification.trim()) {
      Alert.alert('Error', 'Please provide a justification.');
      return;
    }

    try {
      setIsSubmitting(true);
      await attendanceApi.submitJustification(attendanceId, justification, isOnDuty);
      setJustification('');
      setIsOnDuty(false);
      onSuccess?.();
      onClose();
      Alert.alert('Success', 'Your justification has been submitted successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit justification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Justify Absence</Text>
          
          <Text style={styles.label}>Please provide a reason for your absence:</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={5}
            placeholder="Enter your justification here..."
            value={justification}
            onChangeText={setJustification}
            textAlignVertical="top"
          />

          <View style={styles.onDutyContainer}>
            <Text style={styles.onDutyLabel}>
              Mark as On Duty (will be counted as present with 8 work hours if approved)
            </Text>
            <Switch
              value={isOnDuty}
              onValueChange={setIsOnDuty}
              trackColor={{ false: "#767577", true: "#4CAF50" }}
              thumbColor={isOnDuty ? "#fff" : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
            />
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {isOnDuty 
                ? "On Duty: This will be counted as present with 8 work hours if approved by supervisor."
                : "Normal Absence: You will be marked as absent for the day if approved."}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    minHeight: 100,
    marginBottom: 15,
  },
  onDutyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  onDutyLabel: {
    fontSize: 14,
    color: '#555',
    flex: 1,
    marginRight: 10,
  },
  infoContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#1976D2',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submitButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default JustificationModal; 