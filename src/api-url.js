import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  if (__DEV__) {
    // Running in development
    if (Platform.OS === 'android') {
      // Android emulator needs special IP
      return 'http://192.168.31.88:3000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      return 'http://localhost:3000';
    } else {
      // Web platform
      return 'http://localhost:3000';
    }
  }
  // Production URL
  return 'https://your-production-api.com'; // Replace with your production API URL
};

export const AUTH_URL = 'https://auth-api-xz1q.onrender.com';
export const SURVEY_URL = 'https://survey-service-nxvj.onrender.com';
// export const SURVEY_URL = getBaseUrl();
export const LOCATION_URL = 'https://location-service-mig8.onrender.com';
