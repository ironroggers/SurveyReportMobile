import AsyncStorage from '@react-native-async-storage/async-storage';
import { ATTENDANCE_URL } from '../api-url';

// Helper function to get the current user ID
const getCurrentUserId = async () => {
  try {
    // Get user info from AsyncStorage
    const userInfoString = await AsyncStorage.getItem('userInfo');
    if (userInfoString) {
      const userInfo = JSON.parse(userInfoString);
      return userInfo.id || userInfo._id;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving user ID:', error);
    return null;
  }
};

// Check in for the day
export const checkIn = async (locationData) => {
  try {
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User ID not available. Please log in again.');
    }
    
    // Log the request data for debugging
    console.log('Check-in request - userId:', userId);
    console.log('Check-in request - locationData:', JSON.stringify(locationData));
    
    const requestBody = { 
      userId: userId,
      location: locationData 
    };
    
    console.log('Check-in request body:', JSON.stringify(requestBody));
    
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      try {
        const errorText = await response.text();
        console.log('Check-in error response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || 'Failed to check in');
        } catch (parseError) {
          throw new Error(`Failed to check in. Status: ${response.status}. Response: ${errorText.substring(0, 100)}`);
        }
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
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User ID not available. Please log in again.');
    }
    
    // If attendanceId is provided, it's an auto-checkout for a specific record
    let endpoint = attendanceId 
      ? `${ATTENDANCE_URL}/api/attendance/check-out/${attendanceId}` 
      : `${ATTENDANCE_URL}/api/attendance/check-out`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        userId: userId,
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
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User ID not available. Please log in again.');
    }
    
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/today?userId=${userId}`, {
      method: 'GET'
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
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User ID not available. Please log in again.');
    }
    
    const queryParams = new URLSearchParams();
    
    // Add userId parameter
    queryParams.append('userId', userId);
    
    // Add filters to query params if provided
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.status) queryParams.append('status', filters.status);
    
    const url = `${ATTENDANCE_URL}/api/attendance/history?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET'
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
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User ID not available. Please log in again.');
    }
    
    const response = await fetch(`${ATTENDANCE_URL}/api/attendance/justify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        userId: userId,
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