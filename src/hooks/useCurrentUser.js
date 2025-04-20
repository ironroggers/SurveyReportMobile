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
        const parsedUser = JSON.parse(userData);
        setCurrentUser(parsedUser);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError('Failed to fetch current user');
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
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array to run only once

  const updateCurrentUser = async (userData) => {
    try {
      // Update in both storage keys to ensure compatibility
      await AsyncStorage.setItem('userInfo', JSON.stringify(userData));
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
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