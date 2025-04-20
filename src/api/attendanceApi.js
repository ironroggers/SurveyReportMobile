import AsyncStorage from '@react-native-async-storage/async-storage';
import { ATTENDANCE_URL } from '../api-url';

// Helper function to get auth token
const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    return token;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    throw error;
  }
};

// Check in for the day
export const checkIn = async (locationData) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ location: locationData })
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check in');
      } catch (jsonError) {
        throw new Error(`Failed to check in. Status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Check-in error:', error);
    throw error;
  }
};

// Check out for the day
export const checkOut = async (locationData, attendanceId = null) => {
  try {
    const token = await getAuthToken();
    
    // If attendanceId is provided, it's an auto-checkout for a specific record
    const endpoint = attendanceId 
      ? `${ATTENDANCE_URL}/api/attendance/check-out/${attendanceId}` 
      : `${ATTENDANCE_URL}/api/attendance/check-out`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        location: locationData,
        isAutoCheckout: Boolean(attendanceId)
      })
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      } catch (jsonError) {
        throw new Error(`Failed to check out. Status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Check-out error:', error);
    throw error;
  }
};

// Get today's attendance status
export const getTodayAttendance = async () => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/today`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get today\'s attendance');
      } catch (jsonError) {
        throw new Error(`Failed to get today's attendance. Status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Get today attendance error:', error);
    throw error;
  }
};

// Get attendance history with optional filters
export const getAttendanceHistory = async (filters = {}) => {
  try {
    const token = await getAuthToken();
    const queryParams = new URLSearchParams();
    
    // Add filters to query params if provided
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.status) queryParams.append('status', filters.status);
    
    const url = `${ATTENDANCE_URL}/api/attendance/history?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get attendance history');
      } catch (jsonError) {
        throw new Error(`Failed to get attendance history. Status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Get attendance history error:', error);
    throw error;
  }
};

// Submit justification for absence
export const submitJustification = async (attendanceId, justification, isOnDuty = false) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/justify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        attendanceId, 
        justification,
        isOnDuty 
      })
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit justification');
      } catch (jsonError) {
        throw new Error(`Failed to submit justification. Status: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Submit justification error:', error);
    throw error;
  }
};

export default {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  submitJustification
}; 