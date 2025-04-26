import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import attendanceApi from '../api/attendanceApi';

const AttendanceActions = ({ onActionComplete }) => {
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchTodayAttendance();
    checkForAutoCheckout();
  }, []);

  // Function to check if automatic checkout is needed
  const checkForAutoCheckout = async () => {
    try {
      // Get yesterday's attendance
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const response = await attendanceApi.getAttendanceHistory({
        startDate: yesterdayStr,
        endDate: yesterdayStr
      });
      
      if (response.data && response.data.length > 0) {
        const yesterdayAttendance = response.data[0];
        
        // Check if user checked in but didn't check out
        if (yesterdayAttendance.checkInTime && !yesterdayAttendance.checkOutTime) {
          // Get current time in IST (UTC+5:30)
          const now = new Date();
          const hoursIST = (now.getUTCHours() + 5) % 24; // Add 5 hours for IST
          const minutesIST = now.getUTCMinutes() + 30; // Add 30 minutes for IST
          const adjustedHours = hoursIST + (minutesIST >= 60 ? 1 : 0);
          
          // If current time is after 4am IST
          if (adjustedHours >= 4) {
            // Perform automatic checkout for yesterday
            await attendanceApi.checkOut({
              latitude: yesterdayAttendance.location?.latitude || 0,
              longitude: yesterdayAttendance.location?.longitude || 0,
              address: 'Auto checkout',
              isAutoCheckout: true
            }, yesterdayAttendance._id || yesterdayAttendance.id);
            
            Alert.alert('Auto Checkout', 'You were automatically checked out for yesterday\'s session as you forgot to check out.');
            onActionComplete?.();
          }
        }
      }
    } catch (error) {
      console.error('Auto checkout check error:', error);
      // Silently fail - don't show error to user
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceApi.getTodayAttendance();
      setTodayAttendance(response.data || null);
    } catch (error) {
      console.error('Error fetching today\'s attendance:', error);
      Alert.alert('Error', 'Failed to load today\'s attendance status.');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for attendance tracking.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Get the address from coordinates
      const [geocodedLocation] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      const address = geocodedLocation 
        ? `${geocodedLocation.street || ''}, ${geocodedLocation.city || ''}, ${geocodedLocation.region || ''}`
        : 'Unknown location';

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address
      };
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Failed to get your current location. Please try again.');
      return null;
    }
  };

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      
      const locationData = await getCurrentLocation();
      if (!locationData) {
        setActionLoading(false);
        return;
      }

      await attendanceApi.checkIn(locationData);
      
      // Refresh attendance data
      await fetchTodayAttendance();
      
      Alert.alert('Success', 'You have successfully checked in.');
      onActionComplete?.();
    } catch (error) {
      Alert.alert('Check-in Failed', error.message || 'Failed to check in. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      
      const locationData = await getCurrentLocation();
      if (!locationData) {
        setActionLoading(false);
        return;
      }

      await attendanceApi.checkOut(locationData);
      
      // Refresh attendance data
      await fetchTodayAttendance();
      
      Alert.alert('Success', 'You have successfully checked out.');
      onActionComplete?.();
    } catch (error) {
      Alert.alert('Check-out Failed', error.message || 'Failed to check out. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Loading attendance status...</Text>
      </View>
    );
  }

  // Derive sessions and open-session state
  const sessions = todayAttendance?.sessions || [];
  const lastSession = sessions[sessions.length - 1];
  const isOpenSession = Boolean(lastSession && !lastSession.checkOutTime);
  // Aggregate hours: prefer backend workHours or sum of completed sessions
  const aggregatedWorkHours = typeof todayAttendance?.workHours === 'number'
    ? todayAttendance.workHours
    : sessions.reduce((sum, s) => {
        if (s.checkInTime && s.checkOutTime) {
          const inT = new Date(s.checkInTime);
          const outT = new Date(s.checkOutTime);
          return sum + (outT - inT) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.title}>Today's Attendance</Text>
        
        {!todayAttendance ? (
          <Text style={styles.noRecordText}>
            No attendance record for today yet.
          </Text>
        ) : (
          <View style={styles.attendanceInfo}>
            {sessions.length === 0 && (
              <Text style={styles.noRecordText}>
                No sessions yet for today.
              </Text>
            )}
            {sessions.map((session, idx) => (
              <View key={idx} style={styles.sessionRow}>
                <Text style={styles.sessionLabel}>Session {idx + 1}</Text>
                <View style={styles.timeInfo}>
                  <MaterialIcons name="login" size={20} color="#4CAF50" />
                  <Text style={styles.timeLabel}>In:</Text>
                  <Text style={styles.timeValue}>{formatTime(session.checkInTime)}</Text>
                </View>
                <View style={styles.timeInfo}>
                  <MaterialIcons name="logout" size={20} color="#F44336" />
                  <Text style={styles.timeLabel}>Out:</Text>
                  <Text style={styles.timeValue}>{formatTime(session.checkOutTime)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.timeInfo}>
              <MaterialIcons name="access-time" size={20} color="#1976D2" />
              <Text style={styles.timeLabel}>Total Hrs:</Text>
              <Text style={styles.timeValue}>{aggregatedWorkHours.toFixed(2)} hrs</Text>
            </View>
          </View>
        )}
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.checkInButton,
              isOpenSession && { opacity: 0.5 }
            ]}
            onPress={handleCheckIn}
            disabled={isOpenSession || actionLoading}
          >
            {actionLoading && !isOpenSession ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="login" size={20} color="#fff" />
                <Text style={styles.buttonText}>Check In</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.checkOutButton,
              !isOpenSession && { opacity: 0.5 }
            ]}
            onPress={handleCheckOut}
            disabled={!isOpenSession || actionLoading}
          >
            {actionLoading && isOpenSession ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="logout" size={20} color="#fff" />
                <Text style={styles.buttonText}>Check Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  noRecordText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  attendanceInfo: {
    marginBottom: 16,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  checkInButton: {
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  checkOutButton: {
    backgroundColor: '#F44336',
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  sessionRow: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  sessionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
});

export default AttendanceActions; 