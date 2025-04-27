import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import { useCurrentUser } from '../hooks/useCurrentUser';
import {LOCATION_URL, AUTH_URL, ATTENDANCE_URL} from "../api-url";
import { showFeedbackForm } from '../utils/instabug';
import { MaterialIcons } from '@expo/vector-icons';
import { VictoryPie } from 'victory-native';

// Logging utility to consistently format logs
const logEvent = (eventName, data = null) => {
  const logMessage = `[SupervisorDashboard] ${eventName}`;
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

// Debounce function to limit frequent calls


// Track render count to identify excessive re-rendering
let renderCount = 0;

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

// Wrap component with memo to prevent unnecessary re-renders
const SupervisorDashboard = React.memo(({ navigation }) => {
  renderCount++;
  logEvent(`Rendering component (count: ${renderCount})`);
  
  const { currentUser, loading: userLoading, fetchCurrentUser } = useCurrentUser();

  console.log("Current user", currentUser);
  
  const [surveyors, setSurveyors] = useState([]);
  const [assignedLocations, setAssignedLocations] = useState({});
  const [surveyorAttendance, setSurveyorAttendance] = useState({});
  const [locationStats, setLocationStats] = useState({
    released: 0,
    assigned: 0,
    active: 0,
    completed: 0,
    accepted: 0,
    reverted: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // One-time initialization effect with no dependencies
  useEffect(() => {
    logEvent('Initial useEffect triggered (one-time)');
    
    const initialLoad = async () => {
      try {
        logEvent('Starting initial data load');
        
        // Wait for user data to be available if it's still loading
        if (userLoading) {
          logEvent('Waiting for user data to be available');
          // Just continue and rely on pull-to-refresh if needed
        }
        
        if (currentUser) {
          logEvent('User data available, loading dashboard data');
          await loadInitialData();
        } else {
          logEvent('No user data available for initial load');
          setError('User data not available. Please pull to refresh when logged in.');
          setLoading(false);
        }
      } catch (err) {
        logEvent('Error in initial load', err);
        setError('An error occurred while initializing the dashboard.');
        setLoading(false);
      }
    };
    
    initialLoad();
    // Empty dependency array ensures this only runs once
  }, [currentUser, userLoading]);

  // Additional effect to reload data when currentUser changes
  useEffect(() => {
    if (currentUser && currentUser._id) {
      logEvent('Current user changed, reloading data', {
        userId: currentUser._id,
        username: currentUser.username
      });
      loadInitialData();
    }
  }, [currentUser, loadInitialData]);

  const loadInitialData = useCallback(async () => {
    logEvent('loadInitialData started');
    setLoading(true);
    try {
      // Run each function separately to prevent one failure from stopping others
      try {
        logEvent('Fetching surveyors');
        const fetchedSurveyors = await fetchSurveyors();
        logEvent('Surveyors fetched successfully');
        
        // Check attendance status for each surveyor
        if (Array.isArray(fetchedSurveyors)) {
          await checkSurveyorsAttendance(fetchedSurveyors);
        }
      } catch (error) {
        logEvent('Error fetching surveyors', error);
      }
      
      try {
        logEvent('Fetching assigned locations');
        await fetchAssignedLocations();
        logEvent('Assigned locations fetched successfully');
      } catch (error) {
        logEvent('Error fetching locations', error);
      }
      
      logEvent('All initial data loaded');
    } catch (error) {
      logEvent('Error loading initial data', error);
      setError('Failed to load initial data. Please try again.');
    } finally {
      logEvent('Setting loading to false');
      setLoading(false);
    }
  }, [fetchSurveyors, checkSurveyorsAttendance, fetchAssignedLocations]);

  const fetchAssignedLocations = useCallback(async () => {
    logEvent('fetchAssignedLocations started');
    try {
      if (!LOCATION_URL) {
        logEvent('LOCATION_URL is undefined');
        setAssignedLocations({});
        return;
      }
      
      const apiUrl = `${LOCATION_URL}/api/locations`;
      logEvent('Fetching from URL', apiUrl);
      
      const response = await fetch(apiUrl);
      logEvent('Response received', { 
        ok: response?.ok, 
        status: response?.status 
      });
      
      if (!response || !response.ok) {
        logEvent('Error response from location API', {
          status: response?.status,
          statusText: response?.statusText
        });
        setAssignedLocations({});
        return;
      }
      
      const data = await response.json();
      logEvent('Location data parsed', { 
        hasData: !!data,
        dataLength: data?.data?.length || 0
      });
      
      const locations = data && data.data ? data.data : [];
      logEvent('Locations extracted', { count: locations.length });

      // Create a map of surveyorId to array of their assigned locations
      const locationMap = {};
      
      // Track location stats
      const stats = {
        released: 0,
        assigned: 0,
        active: 0,
        completed: 0,
        accepted: 0,
        reverted: 0
      };
      
      if (Array.isArray(locations)) {
        locations.forEach(location => {
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
          
          if (location && location.assignedTo) {
            logEvent('Processing location assignment', {
              locationId: location._id,
              assignedTo: location.assignedTo
            });
            
            if (!locationMap[location.assignedTo]) {
              locationMap[location.assignedTo] = [];
            }
            locationMap[location.assignedTo].push(location);
          }
        });
      }

      logEvent('Location map created', { 
        surveyorCount: Object.keys(locationMap).length 
      });
      
      setLocationStats(stats);
      setAssignedLocations(locationMap);
      logEvent('Assigned locations state updated');
    } catch (err) {
      logEvent('Error fetching locations', err);
      setAssignedLocations({});
    }
  }, []);

  const fetchSurveyors = useCallback(async () => {
    if (!currentUser || !currentUser._id) {
      logEvent('Cannot fetch surveyors: currentUser._id is undefined', currentUser);
      return [];
    }
    
    const url = `${AUTH_URL}/api/auth/users?role=SURVEYOR&reportingTo=${currentUser._id}`;
    logEvent('Fetching surveyors from URL', url);
    console.log("Fetching surveyors URL:", url);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        logEvent('Error response from surveyors API', {
          status: response?.status,
          statusText: response?.statusText
        });
        throw new Error(`Failed to fetch surveyors: ${response.status}`);
      }
      
      const data = await response.json();
      logEvent('Surveyors fetched successfully', {
        dataExists: !!data,
        dataLength: data?.data?.length || 0,
        reportingToId: currentUser._id
      });
      
      if (!data || !Array.isArray(data.data)) {
        logEvent('Invalid surveyors data format', data);
        setSurveyors([]);
        return [];
      }
      
      setSurveyors(data.data);
      return data.data;
    } catch (err) {
      logEvent('Error fetching surveyors', err);
      setSurveyors([]);
      throw err;
    }
  }, [currentUser]);

  // New function to check attendance for all surveyors
  const checkSurveyorsAttendance = async (surveyorsList) => {
    logEvent('Checking attendance for surveyors');
    
    if (!ATTENDANCE_URL) {
      logEvent('ATTENDANCE_URL is undefined');
      return;
    }
    
    const attendanceData = {};
    
    try {
      for (const surveyor of surveyorsList) {
        if (surveyor && surveyor._id) {
          try {
            const apiUrl = `${ATTENDANCE_URL}/api/attendance/is-present?userId=${surveyor._id}`;
            logEvent('Checking attendance for surveyor', { 
              surveyorId: surveyor._id, 
              url: apiUrl 
            });
            
            const response = await fetch(apiUrl);
            
            if (response.ok) {
              const responseJson = await response.json();
              // Extract the data from the response structure
              if (responseJson.success && responseJson.data) {
                attendanceData[surveyor._id] = responseJson.data;
                
                logEvent('Attendance data received', { 
                  surveyorId: surveyor._id,
                  isPresent: responseJson.data.isPresent,
                  hasCurrentSession: !!responseJson.data.currentSession
                });
              } else {
                logEvent('Invalid attendance data format', responseJson);
              }
            } else {
              logEvent('Error response from attendance API', {
                surveyorId: surveyor._id,
                status: response.status
              });
            }
          } catch (err) {
            logEvent('Error fetching attendance for surveyor', {
              surveyorId: surveyor._id,
              error: err
            });
          }
        }
      }
      
      setSurveyorAttendance(attendanceData);
      logEvent('All surveyor attendance data updated', {
        surveyorsChecked: Object.keys(attendanceData).length
      });
    } catch (err) {
      logEvent('Error checking surveyors attendance', err);
    }
  };

  // Function to filter surveyors based on search query
  const getFilteredSurveyors = useCallback(() => {
    logEvent('Filtering surveyors with query', { searchQuery });
    
    if (!searchQuery || searchQuery.trim() === '') {
      return surveyors;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return surveyors.filter(surveyor => {
      // Check if surveyor name matches
      const nameMatch = surveyor?.username?.toLowerCase().includes(query) || 
                       surveyor?.email?.toLowerCase().includes(query);
      
      if (nameMatch) return true;
      
      // Check if any of the assigned locations match
      if (surveyor?._id && assignedLocations[surveyor._id]) {
        return assignedLocations[surveyor._id].some(location => 
          location?.title?.toLowerCase().includes(query)
        );
      }
      
      return false;
    });
  }, [surveyors, assignedLocations, searchQuery]);
  
  // Get filtered surveyors based on search query
  const filteredSurveyors = useMemo(() => getFilteredSurveyors(), [getFilteredSurveyors]);

  // Consider users as present based on attendance API
  const presentSurveyors = useMemo(() => 
    Array.isArray(filteredSurveyors) 
      ? filteredSurveyors.filter((s) => s && s._id && 
          surveyorAttendance[s._id] && 
          surveyorAttendance[s._id].isPresent === true)
      : []
  , [filteredSurveyors, surveyorAttendance]);
  
  // Calculate absent surveyors based on attendance API
  const absentSurveyors = useMemo(() => 
    Array.isArray(filteredSurveyors) 
      ? filteredSurveyors.filter((s) => !s._id || 
          !surveyorAttendance[s._id] || 
          surveyorAttendance[s._id].isPresent !== true)
      : []
  , [filteredSurveyors, surveyorAttendance]);
  
  logEvent('Surveyor counts', { 
    total: filteredSurveyors?.length || 0, 
    active: presentSurveyors?.length || 0,
    absent: absentSurveyors?.length || 0
  });

  // Prepare data for the donut chart
  const chartData = useMemo(() => {
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

  const handleAssignLocation = useCallback((surveyorId) => {
    logEvent('handleAssignLocation called', { surveyorId });
    try {
      if (!surveyorId) {
        logEvent('Invalid surveyor ID');
        return;
      }
      
      if (!navigation) {
        logEvent('Navigation prop is undefined');
        return;
      }
      
      logEvent('Navigating to AssignLocation', { surveyorId });
      navigation.navigate('AssignLocation', { 
        surveyorId,
        onLocationAssigned: () => {
          logEvent('Location assigned callback triggered');
          fetchAssignedLocations();
        }
      });
    } catch (error) {
      logEvent('Error navigating to AssignLocation', error);
    }
  }, [navigation, fetchAssignedLocations]);

  const onRefresh = useCallback(() => {
    logEvent('onRefresh called');
    try {
      setRefreshing(true);
      setError(null);
      
      const refreshData = async () => {
        try {
          logEvent('Refreshing data started');
          // First refresh user data in case it changed
          if (typeof fetchCurrentUser === 'function') {
            logEvent('Refreshing current user');
            await fetchCurrentUser();
          }
          
          if (!currentUser || !currentUser._id) {
            logEvent('Still no currentUser after refresh', currentUser);
            setError('User data not available. Please try again later.');
            setRefreshing(false);
            return;
          }
          
          // Now load all dashboard data
          await loadInitialData();
          
          logEvent('Refresh completed successfully');
        } catch (error) {
          logEvent('Error refreshing data', error);
          setError(`Failed to refresh: ${error.message}`);
        } finally {
          logEvent('Setting refreshing to false');
          setRefreshing(false);
        }
      };
      
      refreshData();
    } catch (error) {
      logEvent('Error in onRefresh', error);
      setError(`Refresh error: ${error.message}`);
      setRefreshing(false);
    }
  }, [loadInitialData, fetchCurrentUser, currentUser]);

  // Add a function to navigate to personal attendance
  const navigateToAttendance = useCallback(() => {
    navigation.navigate('Attendance');
  }, [navigation]);

  // Function to render a single surveyor card - updated with attendance info
  const renderSurveyorCard = useCallback((item) => {
    try {
      if (!item) {
        logEvent('renderSurveyorCard: null item, returning null');
        return null;
      }
      
      logEvent('Rendering surveyor', { 
        id: item._id, 
        username: item.username 
      });
      
      // Get array of locations for this surveyor with null checks
      const surveyorLocations = item._id && assignedLocations && 
                               assignedLocations[item._id] ? 
                               assignedLocations[item._id] : [];
      
      // Get attendance information
      const attendanceInfo = item._id && surveyorAttendance[item._id];
      const isPresent = attendanceInfo && attendanceInfo.isPresent;
      const currentSession = attendanceInfo && attendanceInfo.currentSession;
      
      logEvent('Surveyor attendance info', {
        surveyorId: item._id,
        isPresent: isPresent,
        hasSession: !!currentSession
      });
      
      return (
        <View key={item._id || Math.random().toString()} style={styles.card}>
          <Text style={styles.name}>{item.username || 'Unknown'}</Text>
          <Text style={styles.email}>{item.email || 'No email'}</Text>
          
          {/* Updated status with attendance information */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Status: </Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: isPresent ? '#4CAF50' : '#F44336' }
            ]}>
              <Text style={styles.statusBadgeText}>{isPresent ? 'Present' : 'Absent'}</Text>
            </View>
          </View>
          
          {/* Show current session details if present */}
          {isPresent && currentSession && (
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDetail}>
                Checked in: {new Date(currentSession.checkInTime).toLocaleTimeString()}
              </Text>
              <Text style={styles.sessionDetail}>
                Duration: {currentSession.duration || 0} minutes
              </Text>
            </View>
          )}
          
          <Text style={styles.lastLogin}>
            Last Login: {item.lastLogin ? new Date(item.lastLogin).toLocaleString() : 'Unknown'}
          </Text>
          
          {/* Rest of the card content remains the same */}
          {Array.isArray(surveyorLocations) && surveyorLocations.length > 0 ? (
            <>
              <View style={styles.locationsContainer}>
                <Text style={styles.locationHeader}>
                  Assigned Locations ({surveyorLocations.length}):
                </Text>
                {surveyorLocations.map((location) => (
                  location && location._id ? (
                    <View key={location._id} style={styles.locationInfo}>
                      <Text style={styles.locationTitle}>📍 {location.title || 'Unnamed Location'}</Text>
                      <Text style={styles.locationDetails}>
                        Center: ({
                          location.centerPoint && 
                          location.centerPoint.coordinates && 
                          location.centerPoint.coordinates[1] ? 
                          location.centerPoint.coordinates[1].toFixed(6) : 'N/A'
                        },
                        {
                          location.centerPoint && 
                          location.centerPoint.coordinates && 
                          location.centerPoint.coordinates[0] ? 
                          location.centerPoint.coordinates[0].toFixed(6) : 'N/A'
                        })
                      </Text>
                      <Text style={styles.locationDetails}>Status: {location.status !== undefined ? getStatusName(location.status) : 'N/A'}</Text>
                      <Text style={styles.locationDetails}>Radius: {location.radius || 0}m</Text>
                    </View>
                  ) : null
                ))}
              </View>
              
              {item._id && (
                <TouchableOpacity
                  style={[styles.assignBtn, { marginTop: 8 }]}
                  onPress={() => handleAssignLocation(item._id)}
                >
                  <Text style={styles.btnText}>Assign Another Location</Text>
                </TouchableOpacity>
              )}
            </>
          ) : item._id ? (
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => handleAssignLocation(item._id)}
            >
              <Text style={styles.btnText}>Assign Location</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    } catch (error) {
      logEvent('Error rendering surveyor', error);
      return (
        <View key={Math.random().toString()} style={styles.card}>
          <Text style={styles.errorText}>Error displaying this surveyor</Text>
        </View>
      );
    }
  }, [assignedLocations, handleAssignLocation, surveyorAttendance]);

  // Log when render is called
  logEvent('Rendering component, returning JSX', {
    loading,
    userLoading,
    hasError: !!error,
    surveyorsCount: surveyors?.length,
    presentSurveyorsCount: presentSurveyors?.length
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Hi, {currentUser?.username}</Text>
              <Text style={styles.headerSubtitle}>
                Welcome
              </Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.attendanceButton}
                onPress={navigateToAttendance}
              >
                <MaterialIcons name="access-time" size={24} color="#fff" />
                <Text style={styles.attendanceButtonText}>Attendance</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading || userLoading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading dashboard data...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRefresh}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Supervisor Stats Overview */}
              <View style={styles.welcomeContainer}>
                <MaterialIcons name="supervisor-account" size={40} color="#1976D2" />
                <Text style={styles.welcomeText}>Your Team Overview</Text>
              </View>
              
              {/* Stats Cards */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <View style={styles.statIconContainer}>
                    <MaterialIcons name="people" size={28} color="#1976D2" />
                  </View>
                  <Text style={styles.statValue}>{filteredSurveyors.length}</Text>
                  <Text style={styles.statLabel}>Total Surveyors</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#C8E6C9' }]}>
                    <MaterialIcons name="check-circle" size={28} color="#2E7D32" />
                  </View>
                  <Text style={[styles.statValue, { color: '#2E7D32' }]}>{presentSurveyors.length}</Text>
                  <Text style={styles.statLabel}>Present</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#FFEBEE' }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#FFCDD2' }]}>
                    <MaterialIcons name="cancel" size={28} color="#C62828" />
                  </View>
                  <Text style={[styles.statValue, { color: '#C62828' }]}>{absentSurveyors.length}</Text>
                  <Text style={styles.statLabel}>Absent</Text>
                </View>
              </View>

              {/* Location Status Chart */}
              {chartData.length > 0 ? (
                <View style={styles.largeChartContainer}>
                  <View style={styles.sectionHeaderContainer}>
                    <MaterialIcons name="pie-chart" size={28} color="#1976D2" />
                    <Text style={styles.sectionTitle}>Location Status Overview</Text>
                  </View>
                  
                  {/* Fallback UI for chart */}
                  <View style={styles.fallbackChartContainer}>
                    {chartData.map((item, index) => {
                      const total = chartData.reduce((acc, curr) => acc + curr.y, 0);
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
                          <Text style={styles.statItemValue}>{item.y}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyChartState}>
                  <MaterialIcons name="error-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyStateText}>No location data available</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

export default SupervisorDashboard;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 30,
  },
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  attendanceButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
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
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976D2',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    elevation: 2,
    minWidth: 120,
  },
  retryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  largeChartContainer: {
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
  detailedStatsContainer: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  detailedStatsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
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
  emptyChartState: {
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
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
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sessionInfo: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionDetail: {
    fontSize: 12,
    color: '#2E7D32',
  },
  locationsContainer: {
    marginTop: 12,
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 10,
  },
  locationHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  locationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 6,
  },
  locationDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusLegendHeader: {
    marginBottom: 15,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  fallbackChartContainer: {
    marginVertical: 20,
    width: '100%',
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
});
