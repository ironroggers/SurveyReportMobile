import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      // Get the stored user data from AsyncStorage
      console.log("Fetching current user...");
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log("Current User data:", parsedUser);
        setCurrentUser(parsedUser);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching current user:', err);
      setError('Failed to fetch current user');
      setLoading(false);
    }
  };

  const updateCurrentUser = async (userData) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setCurrentUser(userData);
    } catch (err) {
      console.error('Error updating current user:', err);
      setError('Failed to update current user');
    }
  };

  const clearCurrentUser = async () => {
    try {
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
  };
}; 