import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authApi from '../api/authApi';
import { AUTH_URL } from '../api-url';
import { identifyUser, clearInstabugUserAttribute } from '../utils/instabug';

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
        // Get token
        const token = await AsyncStorage.getItem('userToken');
        
        // Check both keys for user data
        let userInfoData = await AsyncStorage.getItem('userInfo');
        const userDataOld = await AsyncStorage.getItem('userData');
        
        // If data exists in userData but not in userInfo, migrate it
        if (!userInfoData && userDataOld) {
          console.log('Migrating user data from userData to userInfo');
          await AsyncStorage.setItem('userInfo', userDataOld);
          await AsyncStorage.removeItem('userData'); // Clean up old key
          userInfoData = userDataOld;
        }
        
        if (token && userInfoData) {
          setUserToken(token);
          setUserInfo(JSON.parse(userInfoData));
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
    try {
      setIsLoading(true);
      const response = await fetch(`${AUTH_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('Login failed response:', data);
        setError(data.message || 'Login failed');
        return null;
      }

      console.log('Full login response:', data);
      
      // Check if the response contains a token
      if (!data.data.token) {
        console.log('Warning: Token not found in login response');
        setError('Invalid response format: No authentication token received');
        return null;
      }

      // Store the token
      setUserToken(data.data.token);
      await AsyncStorage.setItem('userToken', data.data.token);
      
      // Check if user data exists in the response
      if (data.data.user) {
        setUserInfo(data.data.user);
        
        // Identify user in Instabug only if user data exists
        const userId = data.data.user.id || data.data.user._id;
        identifyUser(userId, data.data.user.email, data.data.user.username);
        
        // Store user info
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.data.user));
      } else {
        console.log('Warning: User data not found in login response');
        // Create a minimal userInfo object with available data
        const minimalUserInfo = {
          email: email,
          role: data.role || 'unknown'
        };
        setUserInfo(minimalUserInfo);
        await AsyncStorage.setItem('userInfo', JSON.stringify(minimalUserInfo));
      }

      // Return role if it exists, or a default value
      return data.data.user?.role || (data.data.role || 'unknown');
    } catch (error) {
      console.log('Login error:', error);
      setError(error.message || 'Network error during login');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username, email, password, role) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${AUTH_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('Registration failed response:', data);
        setError(data.message || 'Registration failed');
        return null;
      }

      console.log('Full registration response:', data);
      
      // Check if the response contains a token
      if (!data.data?.token) {
        console.log('Warning: Token not found in registration response');
        setError('Invalid response format: No authentication token received');
        return null;
      }

      // Store the token
      setUserToken(data.data.token);
      await AsyncStorage.setItem('userToken', data.data.token);
      
      // Check if user data exists in the response
      if (data.data?.user) {
        setUserInfo(data.data.user);
        
        // Identify user in Instabug only if user data exists
        const userId = data.data.user.id || data.data.user._id;
        identifyUser(userId, data.data.user.email, data.data.user.username);
        
        // Store user info
        await AsyncStorage.setItem('userInfo', JSON.stringify(data.data.user));
      } else {
        console.log('Warning: User data not found in registration response');
        // Create a minimal userInfo object with available data
        const minimalUserInfo = {
          username: username,
          email: email,
          role: role || data.data?.role || 'unknown'
        };
        setUserInfo(minimalUserInfo);
        await AsyncStorage.setItem('userInfo', JSON.stringify(minimalUserInfo));
      }

      // Return role if it exists, or a default value
      return data.data?.user?.role || (data.data?.role || role || 'unknown');
    } catch (error) {
      console.log('Registration error:', error);
      setError(error.message || 'Network error during registration');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      // Clear all user-related data
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userInfo');
      await AsyncStorage.removeItem('userData'); // Clear old key too, just in case
      setUserToken(null);
      setUserInfo(null);
      
      // Clear user identification in Instabug
      clearInstabugUserAttribute('userId');
      clearInstabugUserAttribute('email');
      clearInstabugUserAttribute('username');
    } catch (error) {
      console.log('Error during logout:', error);
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