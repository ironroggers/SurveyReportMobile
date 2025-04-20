import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import attendanceApi from '../api/attendanceApi';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

const JustificationApprovalItem = ({ justification, onActionComplete }) => {
  const [loading, setLoading] = useState(false);
  
  const { 
    _id, 
    userId, 
    date, 
    justification: justificationText, 
    user = {}, 
    isOnDuty
  } = justification;
  
  const handleApprove = async (asOnDuty = false) => {
    try {
      setLoading(true);
      await attendanceApi.processJustification(_id, 'approved', asOnDuty);
      Alert.alert(
        'Success', 
        `Justification has been approved${asOnDuty ? ' as On Duty' : ''}.`
      );
      onActionComplete?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to approve justification');
    } finally {
      setLoading(false);
    }
  };
  
  const handleReject = async () => {
    try {
      setLoading(true);
      await attendanceApi.processJustification(_id, 'rejected');
      Alert.alert('Success', 'Justification has been rejected.');
      onActionComplete?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject justification');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userName}>{user.name || userId}</Text>
        <Text style={styles.date}>{formatDate(date)}</Text>
      </View>
      
      <View style={styles.justificationContainer}>
        <Text style={styles.justificationLabel}>Justification:</Text>
        <Text style={styles.justificationText}>{justificationText}</Text>
      </View>
      
      {isOnDuty && (
        <View style={styles.onDutyBadge}>
          <MaterialIcons name="work" size={14} color="#fff" />
          <Text style={styles.onDutyText}>Requested as On Duty</Text>
        </View>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      ) : (
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
          >
            <MaterialIcons name="close" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          
          {isOnDuty ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(false)}
              >
                <MaterialIcons name="check" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Approve as Absent</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.onDutyButton]}
                onPress={() => handleApprove(true)}
              >
                <MaterialIcons name="work" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Approve as On Duty</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(false)}
            >
              <MaterialIcons name="check" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  justificationContainer: {
    marginBottom: 12,
  },
  justificationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 4,
  },
  justificationText: {
    fontSize: 14,
    color: '#333',
    paddingLeft: 2,
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  onDutyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  onDutyButton: {
    backgroundColor: '#1976D2',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default JustificationApprovalItem; 