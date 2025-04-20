import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import attendanceApi from '../api/attendanceApi';
import AttendanceActions from '../components/AttendanceActions';
import AttendanceItem from '../components/AttendanceItem';
import AttendanceCalendar from '../components/AttendanceCalendar';
import JustificationModal from '../components/JustificationModal';
import AutoAbsenceChecker from '../components/AutoAbsenceChecker';

export default function AttendanceScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [justifyModalVisible, setJustifyModalVisible] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [activeTab, setActiveTab] = useState('actions'); // 'actions' or 'calendar'
  const [selectedDateRecord, setSelectedDateRecord] = useState(null);

  useEffect(() => {
    // Add a header title that specifies this is personal attendance for supervisors
    if (userInfo?.role?.toUpperCase() === 'SUPERVISOR') {
      navigation.setOptions({
        headerTitle: 'My Attendance',
      });
    }
  }, [navigation, userInfo]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Simply reset refreshing state after a short delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleJustify = (attendance) => {
    setSelectedAttendance(attendance);
    setJustifyModalVisible(true);
  };

  const handleJustificationSuccess = () => {
    // No need to refresh history now
  };

  const handleActionComplete = () => {
    // No need to refresh history now
  };

  const handleDateSelect = (record) => {
    setSelectedDateRecord(record);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* AutoAbsenceChecker runs in the background */}
      <AutoAbsenceChecker onComplete={handleActionComplete} />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'actions' && styles.activeTab
          ]}
          onPress={() => setActiveTab('actions')}
        >
          <MaterialIcons 
            name="access-time" 
            size={20} 
            color={activeTab === 'actions' ? '#1976D2' : '#666'} 
          />
          <Text 
            style={[
              styles.tabText,
              activeTab === 'actions' && styles.activeTabText
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'calendar' && styles.activeTab
          ]}
          onPress={() => setActiveTab('calendar')}
        >
          <MaterialIcons 
            name="calendar-today" 
            size={20} 
            color={activeTab === 'calendar' ? '#1976D2' : '#666'} 
          />
          <Text 
            style={[
              styles.tabText,
              activeTab === 'calendar' && styles.activeTabText
            ]}
          >
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'actions' ? (
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <AttendanceActions onActionComplete={handleActionComplete} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <AttendanceCalendar onDateSelect={handleDateSelect} />
          
          {selectedDateRecord && (
            <View style={styles.dateDetailContainer}>
              <Text style={styles.dateDetailTitle}>Selected Date Details</Text>
              <AttendanceItem 
                attendance={selectedDateRecord} 
                onJustify={handleJustify}
              />
            </View>
          )}
        </ScrollView>
      )}

      <JustificationModal
        visible={justifyModalVisible}
        onClose={() => setJustifyModalVisible(false)}
        attendanceId={selectedAttendance?._id || selectedAttendance?.id}
        onSuccess={handleJustificationSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1976D2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    color: '#666',
  },
  activeTabText: {
    color: '#1976D2',
  },
  dateDetailContainer: {
    marginTop: 20,
  },
  dateDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  supervisorButton: {
    marginRight: 15,
  }
});
