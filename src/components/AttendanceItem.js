import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

const AttendanceItem = ({ attendance, onJustify }) => {
  const { 
    date, 
    status, 
    checkInTime, 
    checkOutTime, 
    workHours,
    justification,
    justificationStatus
  } = attendance;

  const getStatusColor = () => {
    switch (status) {
      case 'present': return '#4CAF50';
      case 'absent': return '#F44336';
      case 'late': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getJustificationStatusColor = () => {
    switch (justificationStatus) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const canJustify = status === 'absent' && justificationStatus === 'not_required';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>{formatDate(date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <MaterialIcons name="access-time" size={18} color="#666" />
          <Text style={styles.detailLabel}>Check In:</Text>
          <Text style={styles.detailValue}>{formatTime(checkInTime)}</Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name="exit-to-app" size={18} color="#666" />
          <Text style={styles.detailLabel}>Check Out:</Text>
          <Text style={styles.detailValue}>{formatTime(checkOutTime)}</Text>
        </View>

        {workHours !== undefined && (
          <View style={styles.detailRow}>
            <MaterialIcons name="hourglass-full" size={18} color="#666" />
            <Text style={styles.detailLabel}>Hours:</Text>
            <Text style={styles.detailValue}>{workHours?.toFixed(2) || 'N/A'}</Text>
          </View>
        )}

        {justification && (
          <View style={[styles.justificationSection]}>
            <View style={styles.justificationHeader}>
              <MaterialIcons name="note" size={18} color="#666" />
              <Text style={styles.justificationTitle}>Justification</Text>
              <View style={[styles.justificationStatusBadge, { backgroundColor: getJustificationStatusColor() }]}>
                <Text style={styles.justificationStatusText}>{justificationStatus.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.justificationText}>{justification}</Text>
          </View>
        )}

        {canJustify && (
          <TouchableOpacity 
            style={styles.justifyButton}
            onPress={() => onJustify(attendance)}
          >
            <MaterialCommunityIcons name="text-box-edit" size={18} color="#fff" />
            <Text style={styles.justifyButtonText}>Justify Absence</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  justificationSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  justificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  justificationTitle: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  justificationText: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  justificationStatusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  justificationStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  justifyButton: {
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  justifyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default AttendanceItem; 