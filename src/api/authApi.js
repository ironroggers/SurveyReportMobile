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
      Alert.alert("Error", "Network Error")
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