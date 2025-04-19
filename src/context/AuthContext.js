import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authApi from '../api/authApi';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is logged in when app starts
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          setUserToken(token);
          setUserInfo(JSON.parse(userData));
        }
      } catch (e) {
        console.error('Failed to fetch auth state:', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authApi.login(email, password);
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      const { token, user } = response.data;

      if (!token || !user || !user.role) {
        throw new Error('Invalid login response format');
      }

      // Store data in AsyncStorage
      try {
        await AsyncStorage.multiSet([
          ['userToken', token],
          ['userData', JSON.stringify(user)]
        ]);
      } catch (storageError) {
        console.error('Storage error:', storageError);
        throw new Error('Failed to save login data');
      }

      // Set state only after successful storage
      setUserToken(token);
      setUserInfo(user);
      
      return user.role;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username, email, password, role) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authApi.register(username, email, password, role);
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      const { token, user } = response.data;

      if (!token || !user || !user.role) {
        throw new Error('Invalid registration response format');
      }

      // Store data in AsyncStorage
      try {
        await AsyncStorage.multiSet([
          ['userToken', token],
          ['userData', JSON.stringify(user)]
        ]);
      } catch (storageError) {
        console.error('Storage error:', storageError);
        throw new Error('Failed to save registration data');
      }

      setUserToken(token);
      setUserInfo(user);
      
      return user.role;
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.multiRemove(['userToken', 'userData']);
      setUserToken(null);
      setUserInfo(null);
    } catch (error) {
      console.error('Logout error:', error);
      setError(error.message || 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        isLoading, 
        userToken, 
        userInfo, 
        error, 
        login, 
        register, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 