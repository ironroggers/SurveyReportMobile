import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useIsFocused } from '@react-navigation/native';
import { LOCATION_URL, ATTENDANCE_URL } from "../api-url";
import { showFeedbackForm } from '../utils/instabug';
import { MaterialIcons } from '@expo/vector-icons';

// Helper function to get status name from status code
const getStatusName = (statusCode) => {
  switch (statusCode) {
    case 1: return 'Released';
    case 2: return 'Assigned';
    case 3: return 'Active';
    case 4: return 'Completed';
    case 5: return 'Accepted';
    case 6: return 'Reverted';
    default: return statusCode; // Return the string status if not a number
  }
};

export default function SurveyorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser } = useCurrentUser();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [locationStats, setLocationStats] = useState({
    released: 0,
    assigned: 0, 
    active: 0,
    completed: 0,
    accepted: 0,
    reverted: 0
  });
  const isFocused = useIsFocused();

  const filterOptions = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  const filteredLocations = locations.filter(location => {
    if (selectedFilter === 'ALL') return true;
    return location.status === selectedFilter;
  });

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  useEffect(() => {
    if (isFocused) {
      onRefresh();
    }
  }, [isFocused]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAssignedLocations(),
        fetchAttendanceHistory()
      ]);
    } catch (error) {
      console.log('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedLocations = async () => {
    try {
      if (!currentUser?.id) {
        console.log('No user ID available to fetch locations');
        return;
      }

      const response = await fetch(`${LOCATION_URL}/api/locations?assignedTo=${currentUser.id}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.log('API Error:', errorData);
        Alert.alert('Error', 'Failed to fetch assigned locations');
        setLocations([]);
        return;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data?.data)) {
        console.log('Invalid location data format:', data);
        Alert.alert('Error', 'Invalid data format received from server');
        setLocations([]);
        return;
      }

      // Filter locations assigned to the current user
      const userLocations = data.data.filter(location => 
        location && location.assignedTo === currentUser.id
      );

      setLocations(userLocations);
      
      // Calculate location stats
      const stats = {
        released: 0,
        assigned: 0,
        active: 0,
        completed: 0,
        accepted: 0,
        reverted: 0
      };

      userLocations.forEach(location => {
        if (location && location.status !== undefined) {
          // If status is a number (like in SupervisorDashboard)
          if (typeof location.status === 'number') {
            switch (location.status) {
              case 1: stats.released++; break;
              case 2: stats.assigned++; break;
              case 3: stats.active++; break;
              case 4: stats.completed++; break;
              case 5: stats.accepted++; break;
              case 6: stats.reverted++; break;
              default: break;
            }
          } else if (typeof location.status === 'string') {
            // If status is a string (like in original SurveyorDashboard)
            switch (location.status) {
              case 'RELEASED': stats.released++; break;
              case 'ASSIGNED': stats.assigned++; break;
              case 'ACTIVE': stats.active++; break;
              case 'COMPLETED': stats.completed++; break;
              case 'APPROVED': stats.accepted++; break;
              case 'REJECTED': stats.reverted++; break;
              default: break;
            }
          }
        }
      });

      setLocationStats(stats);
    } catch (err) {
      console.log('Error fetching locations:', err);
      Alert.alert('Error', 'Unable to get locations');
      setLocations([]);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      // Get the current date
      const today = new Date();
      
      // Calculate the date 3 days ago
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      
      // Format dates for the API
      const endDate = today.toISOString().split('T')[0];
      const startDate = threeDaysAgo.toISOString().split('T')[0];
      
      if (!currentUser?.id) {
        console.log('No user ID available to fetch attendance');
        return;
      }

      const url = `${ATTENDANCE_URL}/api/attendance/history?userId=${currentUser.id}&startDate=${startDate}&endDate=${endDate}`;
      
      const response = await fetch(url, {
        method: 'GET'
      });

      if (!response.ok) {
        console.log('Failed to fetch attendance history:', response.status);
        return;
      }

      const data = await response.json();
      
      if (data && data.data) {
        setAttendanceHistory(data.data);
      }
    } catch (error) {
      console.log('Error fetching attendance history:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: () => logout()
        }
      ]
    );
  };

  const handleStartSurvey = async (location) => {
    try {
      // Check if there's any active survey
      const activeLocation = locations.find(loc => 
        loc.status === 'ACTIVE' || loc.status === 3
      );
      
      if (activeLocation) {
        Alert.alert(
          'Active Survey Exists',
          'Please complete the active survey before starting a new one.',
          [
            {
              text: 'View Active Survey',
              onPress: () => navigation.navigate('SurveyList', { location: activeLocation })
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Make PUT request to update location status
      const response = await fetch(`${LOCATION_URL}/api/locations/${location._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...location,
          status: typeof location.status === 'number' ? 3 : 'ACTIVE'
        })
      });

      if (!response.ok) {
        console.log('Failed to update location status');
        Alert.alert('Error', 'Failed to update location status');
        return;
      }

      // Navigate to survey list after successful update
      navigation.navigate('SurveyList', { location });
    } catch (error) {
      console.log('Error updating location status:', error);
      Alert.alert('Error', 'Failed to update location status');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchInitialData();
    } catch (error) {
      console.log('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  // Prepare data for the chart
  const chartData = [
    { name: 'Released', value: locationStats.released, color: '#64B5F6' },
    { name: 'Assigned', value: locationStats.assigned, color: '#FFA726' },
    { name: 'Active', value: locationStats.active, color: '#66BB6A' },
    { name: 'Completed', value: locationStats.completed, color: '#7986CB' },
    { name: 'Accepted', value: locationStats.accepted, color: '#4DB6AC' },
    { name: 'Reverted', value: locationStats.reverted, color: '#EF5350' }
  ].filter(item => item.value > 0); // Only include non-zero values

  // Calculate total work hours for the last 3 days
  const calculateDailyHours = () => {
    const dailyHours = [];
    
    // Get unique dates from attendance history (most recent 3)
    const uniqueDates = [...new Set(
      attendanceHistory.map(record => record.date.split('T')[0])
    )].sort().reverse().slice(0, 3);
    
    // For each unique date, calculate total work hours
    uniqueDates.forEach(date => {
      const recordsForDay = attendanceHistory.filter(
        record => record.date.split('T')[0] === date
      );
      
      let totalHours = 0;
      
      recordsForDay.forEach(record => {
        // If the record has workHours field, use it
        if (typeof record.workHours === 'number') {
          totalHours += record.workHours;
        }
        // Otherwise, calculate from sessions if available
        else if (record.sessions && record.sessions.length > 0) {
          record.sessions.forEach(session => {
            if (session.checkInTime && session.checkOutTime) {
              const inTime = new Date(session.checkInTime).getTime();
              const outTime = new Date(session.checkOutTime).getTime();
              const duration = (outTime - inTime) / (1000 * 60 * 60); // hours
              totalHours += duration;
            }
          });
        }
      });
      
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
      
      dailyHours.push({
        date: formattedDate,
        hours: totalHours.toFixed(2)
      });
    });
    
    // If we have less than 3 days, fill with empty data
    while (dailyHours.length < 3) {
      dailyHours.push({
        date: 'No data',
        hours: '0.00'
      });
    }
    
    return dailyHours;
  };
  
  const dailyWorkHours = calculateDailyHours();

  const renderItem = ({ item }) => {
    const status = typeof item.status === 'number' ? 
      getStatusName(item.status) : item.status;
      
    return (
      <View style={styles.card}>
        <Text style={styles.name}>📍 {item.title}</Text>
        <Text style={styles.locationDetails}>
          Center: ({item.centerPoint?.coordinates?.[1]?.toFixed(6) || 'N/A'}, 
          {item.centerPoint?.coordinates?.[0]?.toFixed(6) || 'N/A'})
        </Text>
        <Text style={styles.locationDetails}>Radius: {item?.radius || 0}m</Text>
        <Text style={styles.statusDetails}>Status: {status}</Text>

        {(item.status === 'ACTIVE' || item.status === 3) ? (
          <TouchableOpacity
            style={[styles.surveyBtn, { backgroundColor: '#2E7D32' }]}
            onPress={() => navigation.navigate('SurveyList', { location: item })}
          >
            <Text style={styles.btnText}>Edit Survey</Text>
          </TouchableOpacity>
        ) : (item.status === 'COMPLETED' || item.status === 'APPROVED' || 
            item.status === 4 || item.status === 5) ? (
          <TouchableOpacity
            style={[styles.surveyBtn, { backgroundColor: '#FF9800' }]}
            onPress={() => navigation.navigate('ReviewDetails', { 
              locationId: item._id, 
              status: item.status, 
              reviewComment: item.reviewComment,
              isViewOnly: true 
            })}
          >
            <Text style={styles.btnText}>View Survey</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.surveyBtn}
            onPress={() => handleStartSurvey(item)}
          >
            <Text style={styles.btnText}>Start Survey</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Surveyor Dashboard</Text>
            <Text style={styles.headerSubtitle}>{currentUser?.name || 'Welcome'}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.attendanceViewBtn]}
            onPress={() => navigation.navigate('Attendance')}
          >
            <Text style={styles.actionButtonText}>View Attendance</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.feedbackBtn]}
            onPress={() => {
              try {
                showFeedbackForm();
              } catch (error) {
                Alert.alert('Feedback Unavailable', 'Feedback feature is not available in this version.');
              }
            }}
          >
            <Text style={styles.actionButtonText}>Send Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* Work Hours Card */}
        <View style={styles.hoursContainer}>
          <View style={styles.sectionHeaderContainer}>
            <MaterialIcons name="access-time" size={24} color="#1976D2" />
            <Text style={styles.sectionTitle}>Recent Work Hours</Text>
          </View>
          <View style={styles.hoursCardContainer}>
            {dailyWorkHours.map((day, index) => (
              <View key={index} style={styles.dayHoursCard}>
                <Text style={styles.dayHoursDate}>{day.date}</Text>
                <Text style={styles.dayHoursValue}>{day.hours}</Text>
                <Text style={styles.dayHoursLabel}>hours</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Location Status Overview */}
        {chartData.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.sectionHeaderContainer}>
              <MaterialIcons name="pie-chart" size={24} color="#1976D2" />
              <Text style={styles.sectionTitle}>Location Status Overview</Text>
            </View>

            {/* Status bars instead of chart */}
            <View style={styles.statusBarsContainer}>
              {chartData.map((item, index) => {
                const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
                const percentage = Math.round((item.value / total) * 100);
                return (
                  <View key={index} style={styles.statusBarContainer}>
                    <View style={[styles.statusBar, {backgroundColor: item.color}]}>
                      <Text style={styles.statusBarLabel}>{item.name}</Text>
                      <View style={styles.statusCountBadge}>
                        <Text style={styles.statusCountText}>{item.value}</Text>
                      </View>
                    </View>
                    <View style={styles.percentageOuterContainer}>
                      <View style={styles.percentageContainer}>
                        <View 
                          style={[styles.percentageBar, {
                            width: `${percentage}%`,
                            backgroundColor: item.color
                          }]} 
                        />
                      </View>
                      <Text style={styles.percentageText}>{percentage}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Detailed Status Information */}
            <View style={styles.detailedStatsContainer}>
              <View style={styles.statusLegendHeader}>
                <Text style={styles.detailedStatsTitle}>Location Status Details</Text>
                <Text style={styles.statusSubtitle}>Total: {
                  locationStats.released + 
                  locationStats.assigned + 
                  locationStats.active + 
                  locationStats.completed + 
                  locationStats.accepted + 
                  locationStats.reverted
                } locations</Text>
              </View>
              
              {chartData.map((item, index) => (
                <View key={index} style={styles.detailedStatItem}>
                  <View style={[styles.statColorIndicator, { backgroundColor: item.color }]} />
                  <View style={styles.statItemContent}>
                    <Text style={styles.statItemLabel}>{item.name}</Text>
                    <Text style={styles.statItemValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  selectedFilter === option.value && styles.filterButtonActive
                ]}
                onPress={() => setSelectedFilter(option.value)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedFilter === option.value && styles.filterButtonTextActive
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <Text>Loading assigned locations...</Text>
          </View>
        ) : filteredLocations.length === 0 ? (
          <View style={styles.centerContent}>
            <Text>No {selectedFilter !== 'ALL' ? selectedFilter.toLowerCase() : ''} locations found.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa', 
    paddingTop: 20, 
    paddingHorizontal: 16 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  attendanceViewBtn: {
    backgroundColor: '#2196F3',
  },
  logoutBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
  },
  logoutBtnText: {
    color: '#f44336',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  name: { 
    fontSize: 18, 
    fontWeight: 'bold',
    color: '#1976D2',
  },
  locationDetails: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4 
  },
  statusDetails: {
    fontSize: 14,
    color: '#880000',
    marginTop: 4
  },
  surveyBtn: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  btnText: { 
    color: '#fff', 
    textAlign: 'center', 
    fontWeight: '600' 
  },
  scrollContent: {
    flexGrow: 1,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  filterButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackBtn: {
    backgroundColor: '#9C27B0',
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statusBarsContainer: {
    marginVertical: 15,
  },
  statusBarContainer: {
    marginBottom: 15,
  },
  statusBar: {
    height: 40,
    borderRadius: 8,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    width: '100%',
  },
  statusBarLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  percentageOuterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  percentageContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    flex: 1,
  },
  percentageBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  detailedStatsContainer: {
    marginTop: 15,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  statusLegendHeader: {
    marginBottom: 15,
  },
  detailedStatsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  detailedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  statItemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItemLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  hoursContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  hoursCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dayHoursCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dayHoursDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dayHoursValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  dayHoursLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
