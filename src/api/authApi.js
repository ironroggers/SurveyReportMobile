import axios from 'axios';
import {AUTH_URL} from "../api-url";
import {Alert} from "react-native";

const API_URL = AUTH_URL;

const authApi = {
  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password
      });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Network error during login';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = error.response.data.message || 'Invalid credentials';
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'Network error - no response from server';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = 'Error setting up the request';
      }
      
      Alert.alert('Login Failed', errorMessage);
      return { success: false, message: errorMessage };
    }
  },
  
  register: async (username, email, password, role) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
        role
      });
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Network error during registration';
      
      if (error.response) {
        errorMessage = error.response.data.message || 'Registration failed';
      } else if (error.request) {
        errorMessage = 'Network error - no response from server';
      } else {
        errorMessage = 'Error setting up the request';
      }
      
      Alert.alert('Registration Failed', errorMessage);
      return { success: false, message: errorMessage };
    }
  },
  
  getProfile: async (token) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Profile fetch error:', error);
      let errorMessage = 'Network error while fetching profile';
      
      if (error.response) {
        errorMessage = error.response.data.message || 'Failed to get profile';
      }
      
      Alert.alert('Error', errorMessage);
      return { success: false, message: errorMessage };
    }
  }
};

export default authApi; 