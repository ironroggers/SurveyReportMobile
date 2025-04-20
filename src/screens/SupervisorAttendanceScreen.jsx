import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import attendanceApi from '../api/attendanceApi';
import AttendanceFilter from '../components/AttendanceFilter';
import AttendanceItem from '../components/AttendanceItem';
import JustificationApprovalItem from '../components/JustificationApprovalItem';
import TeamMemberSelector from '../components/TeamMemberSelector';

const SupervisorAttendanceScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('team'); // 'team' or 'justifications'
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filterParams, setFilterParams] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [activeTab, filterParams, selectedUserId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'team') {
        // Fetch team attendance with selected filters
        const filters = {
          ...filterParams,
          userId: selectedUserId
        };
        
        const response = await attendanceApi.getTeamAttendance(filters);
        setTeamAttendance(response.data || []);
      } else {
        // Fetch pending justifications
        const response = await attendanceApi.getPendingJustifications();
        setJustifications(response.data || []);
      }
    } catch (error) {
      console.error('Error loading supervisor data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApplyFilter = (filters) => {
    setFilterParams(filters);
  };

  const handleActionComplete = () => {
    loadData();
  };

  const handleMarkAbsent = async () => {
    try {
      await attendanceApi.markAbsentAfterDeadline();
      loadData();
    } catch (error) {
      console.error('Error marking absent:', error);
    }
  };

  const handleSelectTeamMember = (userId) => {
    setSelectedUserId(userId);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons 
        name={activeTab === 'team' ? 'people' : 'assignment'} 
        size={64} 
        color="#ccc" 
      />
      <Text style={styles.emptyText}>
        {activeTab === 'team' 
          ? 'No attendance records found' 
          : 'No pending justifications'
        }
      </Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'team'
          ? 'Try changing your filters to see more results'
          : 'All justifications have been processed'
        }
      </Text>
    </View>
  );

  const renderTeamMember = ({ item }) => (
    <AttendanceItem
      attendance={item}
      onJustify={null} // Supervisors don't justify on behalf of team members
    />
  );

  const renderJustification = ({ item }) => (
    <JustificationApprovalItem
      justification={item}
      onActionComplete={handleActionComplete}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'team' && styles.activeTab
          ]}
          onPress={() => setActiveTab('team')}
        >
          <MaterialIcons 
            name="people" 
            size={20} 
            color={activeTab === 'team' ? '#1976D2' : '#666'} 
          />
          <Text 
            style={[
              styles.tabText,
              activeTab === 'team' && styles.activeTabText
            ]}
          >
            Team Attendance
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'justifications' && styles.activeTab
          ]}
          onPress={() => setActiveTab('justifications')}
        >
          <MaterialIcons 
            name="assignment" 
            size={20} 
            color={activeTab === 'justifications' ? '#1976D2' : '#666'} 
          />
          <Text 
            style={[
              styles.tabText,
              activeTab === 'justifications' && styles.activeTabText
            ]}
          >
            Justifications
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'team' ? (
        <View style={styles.contentContainer}>
          <View style={styles.filterRow}>
            <TeamMemberSelector onSelectMember={handleSelectTeamMember} />
            <AttendanceFilter onApplyFilter={handleApplyFilter} />
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.absenceButton}
              onPress={handleMarkAbsent}
            >
              <MaterialIcons name="assignment-late" size={16} color="#fff" />
              <Text style={styles.absenceButtonText}>
                Mark Absent after 4pm
              </Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading team attendance...</Text>
            </View>
          ) : (
            <FlatList
              data={teamAttendance}
              renderItem={renderTeamMember}
              keyExtractor={(item) => item._id || `${item.userId}-${item.date}`}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
            />
          )}
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading justification requests...</Text>
            </View>
          ) : (
            <FlatList
              data={justifications}
              renderItem={renderJustification}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  absenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  absenceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 30,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export default SupervisorAttendanceScreen; 