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
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(error.response.data.message || 'Invalid credentials');
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('Network error - no response from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error('Error setting up the request');
      }
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
      Alert.alert("Error", "Network Error")
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
      Alert.alert("Error", "Network Error")
    }
  }
};

export default authApi; 