import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';

const AttendanceFilter = ({ onApplyFilter }) => {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState(new Date());
  const [status, setStatus] = useState('all');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const formatDate = (date) => {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleStartDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || startDate;
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    setStartDate(currentDate);
  };

  const handleEndDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || endDate;
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    setEndDate(currentDate);
  };

  const applyFilter = () => {
    onApplyFilter({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      status: status === 'all' ? undefined : status
    });
    setShowFilterModal(false);
  };

  const resetFilter = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    setStartDate(thirtyDaysAgo);
    setEndDate(new Date());
    setStatus('all');
    
    onApplyFilter({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
    
    setShowFilterModal(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.filterButton}
        onPress={() => setShowFilterModal(true)}
      >
        <MaterialIcons name="filter-list" size={20} color="#fff" />
        <Text style={styles.filterButtonText}>Filter</Text>
      </TouchableOpacity>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Filter Attendance</Text>

            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Date Range</Text>
              
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>From:</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text>{formatDate(startDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>To:</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text>{formatDate(endDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                  maximumDate={endDate}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={startDate}
                  maximumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Status</Text>
              
              <View style={styles.statusButtons}>
                <TouchableOpacity 
                  style={[
                    styles.statusButton, 
                    status === 'all' && styles.activeStatusButton
                  ]}
                  onPress={() => setStatus('all')}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === 'all' && styles.activeStatusButtonText
                  ]}>All</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.statusButton, 
                    status === 'present' && styles.activeStatusButton,
                    status === 'present' && { backgroundColor: '#E8F5E9' }
                  ]}
                  onPress={() => setStatus('present')}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === 'present' && styles.activeStatusButtonText,
                    status === 'present' && { color: '#4CAF50' }
                  ]}>Present</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.statusButton, 
                    status === 'absent' && styles.activeStatusButton,
                    status === 'absent' && { backgroundColor: '#FFEBEE' }
                  ]}
                  onPress={() => setStatus('absent')}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === 'absent' && styles.activeStatusButtonText,
                    status === 'absent' && { color: '#F44336' }
                  ]}>Absent</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.statusButton, 
                    status === 'late' && styles.activeStatusButton,
                    status === 'late' && { backgroundColor: '#FFF3E0' }
                  ]}
                  onPress={() => setStatus('late')}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === 'late' && styles.activeStatusButtonText,
                    status === 'late' && { color: '#FF9800' }
                  ]}>Late</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetFilter}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={applyFilter}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    color: '#444',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateLabel: {
    width: 50,
    fontSize: 14,
    color: '#666',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: '48%',
    alignItems: 'center',
  },
  activeStatusButton: {
    borderColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  statusButtonText: {
    color: '#666',
  },
  activeStatusButtonText: {
    color: '#1976D2',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  resetButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AttendanceFilter; 