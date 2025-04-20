import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      // First try to get from userInfo (new key used by AuthContext)
      let userData = await AsyncStorage.getItem('userInfo');
      
      // If not found, fallback to the old userData key
      if (!userData) {
        userData = await AsyncStorage.getItem('userData');
      }
      
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setCurrentUser(parsedUser || null);
        } catch (parseError) {
          console.error('Error parsing user data:', parseError);
          setError('Invalid user data format');
          // Delete the corrupted data
          await AsyncStorage.removeItem('userInfo');
          await AsyncStorage.removeItem('userData');
          setCurrentUser(null);
        }
      } else {
        // Make sure currentUser is null if no data is found
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError('Failed to fetch current user');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        if (mounted) {
          await fetchCurrentUser();
        }
      } catch (err) {
        console.error('Error in loadUser:', err);
        if (mounted) {
          setError('Failed to load user data');
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array to run only once

  const updateCurrentUser = async (userData) => {
    try {
      if (!userData) {
        console.error('Attempted to update with null user data');
        return;
      }
      
      const userJson = JSON.stringify(userData);
      
      // Update in both storage keys to ensure compatibility
      await AsyncStorage.setItem('userInfo', userJson);
      await AsyncStorage.setItem('userData', userJson);
      setCurrentUser(userData);
    } catch (err) {
      console.error('Error updating current user:', err);
      setError('Failed to update current user');
    }
  };

  const clearCurrentUser = async () => {
    try {
      await AsyncStorage.removeItem('userInfo');
      await AsyncStorage.removeItem('userData');
      setCurrentUser(null);
    } catch (err) {
      console.error('Error clearing current user:', err);
      setError('Failed to clear current user');
    }
  };

  return {
    currentUser,
    loading,
    error,
    updateCurrentUser,
    clearCurrentUser,
    fetchCurrentUser, // Export this to allow manual refresh
  };
}; 