import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useIsFocused } from '@react-navigation/native';
import { ATTENDANCE_URL, LOCATION_URL } from "../api-url";
import { MaterialIcons } from '@expo/vector-icons';

// Function to get status name from status code
const getStatusName = (statusCode) => {
  switch (statusCode) {
    case 1: return 'Released';
    case 2: return 'Assigned';
    case 3: return 'Active';
    case 4: return 'Completed';
    case 5: return 'Accepted';
    case 6: return 'Reverted';
    default: return 'Unknown';
  }
};

export default function SurveyorDashboard({ navigation }) {
  const { logout } = useContext(AuthContext);
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [locationStats, setLocationStats] = useState({
    released: 0,
    assigned: 0,
    active: 0,
    completed: 0,
    accepted: 0,
    reverted: 0
  });
  const [userLocations, setUserLocations] = useState([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    fetchAttendanceHistory();
    fetchUserLocations();
  }, [currentUser]);

  useEffect(() => {
    if (isFocused) {
      onRefresh();
    }
  }, [isFocused]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      
      // Get the current date
      const today = new Date();
      
      // Calculate the date 3 days ago
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      
      // Format dates for the API
      const endDate = today.toISOString().split('T')[0];
      const startDate = threeDaysAgo.toISOString().split('T')[0];
      
      if (!currentUser?._id) {
        console.log('No user ID available to fetch attendance');
        setLoading(false);
        return;
      }

      const url = `${ATTENDANCE_URL}/api/attendance/history?userId=${currentUser._id}&startDate=${startDate}&endDate=${endDate}`;
      
      const response = await fetch(url, {
        method: 'GET'
      });
      console.log("Attendance data URL", url) ;

      if (!response.ok) {
        console.log('Failed to fetch attendance history:', response.status);
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      if (data && data.data) {
        setAttendanceHistory(data.data);
      }
    } catch (error) {
      console.log('Error fetching attendance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLocations = async () => {
    try {
      setLoading(true);
      
      if (!currentUser?._id) {
        console.log('No user ID available to fetch locations');
        return;
      }

      if (!LOCATION_URL) {
        console.log('LOCATION_URL is undefined');
        return;
      }
      
      const apiUrl = `${LOCATION_URL}/api/locations`;
      console.log('Fetching from URL', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response || !response.ok) {
        console.log('Error response from location API', {
          status: response?.status,
          statusText: response?.statusText
        });
        return;
      }
      
      const data = await response.json();
      
      const locations = data && data.data ? data.data : [];

      console.log("User Assigned Locations : ",locations);
      
      // Filter locations assigned to current user
      const userAssignedLocations = locations.filter(location => 
        location && location?.surveyor?._id === currentUser?._id
      );
      
      setUserLocations(userAssignedLocations);
      
      // Track location stats
      const stats = {
        released: 0,
        assigned: 0,
        active: 0,
        completed: 0,
        accepted: 0,
        reverted: 0
      };
      
      userAssignedLocations.forEach(location => {
        // Count locations by status
        if (location && location.status !== undefined) {
          switch (location.status) {
            case 1:
              stats.released++;
              break;
            case 2:
              stats.assigned++;
              break;
            case 3:
              stats.active++;
              break;
            case 4:
              stats.completed++;
              break;
            case 5:
              stats.accepted++;
              break;
            case 6:
              stats.reverted++;
              break;
            default:
              break;
          }
        }
      });
      
      setLocationStats(stats);
      
    } catch (error) {
      console.log('Error fetching user locations:', error);
    } finally {
      setLoading(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAttendanceHistory();
      await fetchUserLocations();
    } catch (error) {
      console.log('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  // Calculate total work hours for the last 3 days
  const calculateDailyHours = () => {
    const dailyHours = [];
    
    // Get today and the two previous days
    const today = new Date();
    const lastThreeDays = [];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      lastThreeDays.push(date.toISOString().split('T')[0]);
    }
    
    // For each of the last three days, calculate total work hours if data exists
    lastThreeDays.forEach(dateString => {
      const recordsForDay = attendanceHistory.filter(
        record => record.date.split('T')[0] === dateString
      );
      
      let totalHours = 0;
      
      if (recordsForDay.length > 0) {
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
      }
      
      const dateObj = new Date(dateString);
      const formattedDate = dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
      
      dailyHours.push({
        date: formattedDate,
        hours: totalHours,
        display: totalHours < 1 ? 
          { value: Math.round(totalHours * 60), unit: 'mins' } : 
          { value: totalHours.toFixed(2), unit: 'hours' }
      });
    });
    
    return dailyHours;
  };
  
  const dailyWorkHours = calculateDailyHours();

  // Prepare data for the location status chart
  const locationChartData = useMemo(() => {
    // Calculate total for percentage calculation
    const total = 
      locationStats.released + 
      locationStats.assigned + 
      locationStats.active + 
      locationStats.completed + 
      locationStats.accepted + 
      locationStats.reverted;
      
    return [
      { x: locationStats.released.toString(), y: locationStats.released, color: '#64B5F6', name: 'Released' },
      { x: locationStats.assigned.toString(), y: locationStats.assigned, color: '#FFA726', name: 'Assigned' },
      { x: locationStats.active.toString(), y: locationStats.active, color: '#66BB6A', name: 'Active' },
      { x: locationStats.completed.toString(), y: locationStats.completed, color: '#7986CB', name: 'Completed' },
      { x: locationStats.accepted.toString(), y: locationStats.accepted, color: '#4DB6AC', name: 'Accepted' },
      { x: locationStats.reverted.toString(), y: locationStats.reverted, color: '#EF5350', name: 'Reverted' }
    ].filter(item => item.y > 0); // Only include non-zero values
  }, [locationStats]);

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
            <Text style={styles.headerTitle}>Hi, {currentUser?.username}</Text>
            <Text style={styles.headerSubtitle}>{currentUser?.name || 'Welcome'}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Work Hours Card */}
        <View style={styles.hoursContainer}>
          <View style={styles.sectionHeaderContainer}>
            <MaterialIcons name="access-time" size={24} color="#1976D2" />
            <Text style={styles.sectionTitle}>Recent Work Hours</Text>
          </View>
          {loading ? (
            <View style={styles.centerContent}>
              <Text>Loading work hours...</Text>
            </View>
          ) : (
            <View style={styles.hoursCardContainer}>
              {dailyWorkHours.map((day, index) => (
                <View key={index} style={styles.dayHoursCard}>
                  <Text style={styles.dayHoursDate}>{day.date}</Text>
                  <Text style={styles.dayHoursValue}>{day.display.value}</Text>
                  <Text style={styles.dayHoursLabel}>{day.display.unit}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Location Status Overview */}
        <View style={styles.locationContainer}>
          <View style={styles.sectionHeaderContainer}>
            <MaterialIcons name="pie-chart" size={24} color="#1976D2" />
            <Text style={styles.sectionTitle}>Location Status Overview</Text>
          </View>
          {loading ? (
            <View style={styles.centerContent}>
              <Text>Loading location data...</Text>
            </View>
          ) : locationChartData.length > 0 ? (
            <View>
              {/* Display location statuses */}
              <View style={styles.locationStatsContainer}>
                {locationChartData.map((item, index) => {
                  const total = locationChartData.reduce((acc, curr) => acc + curr.y, 0);
                  const percentage = Math.round((item.y / total) * 100);
                  return (
                    <View key={index} style={styles.statusBarContainer}>
                      <View style={[styles.statusBar, {backgroundColor: item.color}]}>
                        <Text style={styles.statusBarLabel}>{item.name}</Text>
                        <View style={styles.statusCountBadge}>
                          <Text style={styles.statusCountText}>{item.y}</Text>
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
              
              {/* Location Summary */}
              <View style={styles.locationSummaryContainer}>
                <Text style={styles.locationSummaryTitle}>Your Locations</Text>
                <Text style={styles.locationSummarySubtitle}>
                  Total: {userLocations.length} locations assigned to you
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="error-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No locations assigned to you</Text>
            </View>
          )}
        </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 120,
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
  locationContainer: {
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
  locationStatsContainer: {
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
    position: 'relative',
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
  },
  locationSummaryContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  locationSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  locationSummarySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
