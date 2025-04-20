import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, TouchableOpacity, Text } from 'react-native';
import { AuthContext } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

// App Screens
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import SurveyorDashboard from '../screens/SurveyorDashboard';
import SupervisorDashboard from '../screens/SupervisorDashboard';
import AttendanceScreen from '../screens/AttendanceScreen';
import SurveyFormScreen from '../screens/SurveyFormScreen';
import AssignLocationScreen from '../screens/AssignLocationScreen';
import ReviewSurveyScreen from '../screens/ReviewSurveyScreen';
import ReviewDetailsScreen from "../screens/ReviewDetailsScreen";
import SurveyListScreen from "../screens/SurveyListScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isLoading, userToken, userInfo, logout } = useContext(AuthContext);

  // Safe access to userInfo
  const safeUserInfo = userInfo || {};
  const userRole = safeUserInfo.role || '';

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  const defaultScreenOptions = {
    headerShown: true,
    headerBackTitleVisible: false,
    headerStyle: {
      backgroundColor: '#1976D2',
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  };

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      {!userToken ? (
        // Auth Stack
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="SignUp" 
            component={SignUpScreen} 
            options={{ headerShown: false }} 
          />
        </>
      ) : userRole.toUpperCase() === 'SURVEYOR' ? (
        // Surveyor Stack
        <>
          <Stack.Screen 
            name="SurveyorDashboard" 
            component={SurveyorDashboard} 
            options={{ 
              headerTitle: 'Surveyor Dashboard',
              headerLeft: null, // Disable back button
            }}
          />
          <Stack.Screen 
            name="Attendance" 
            component={AttendanceScreen}
            options={{
              headerTitle: 'Attendance',
            }}
          />
          <Stack.Screen 
            name="SurveyForm" 
            component={SurveyFormScreen}
            options={{
              headerTitle: 'New Survey',
            }}
          />
          <Stack.Screen 
            name="SurveyList" 
            component={SurveyListScreen}
            options={{
              headerTitle: 'Survey List',
            }}
          />
        </>
      ) : userRole.toUpperCase() === 'SUPERVISOR' ? (
        // Supervisor Stack
        <>
          <Stack.Screen 
            name="SupervisorDashboard" 
            component={SupervisorDashboard}
            options={{ 
              headerTitle: 'Supervisor Dashboard',
              headerLeft: null, // Disable back button
            }}
          />
          <Stack.Screen 
            name="AssignLocation" 
            component={AssignLocationScreen}
            options={{
              headerTitle: 'Assign Location',
            }}
          />
          <Stack.Screen 
            name="ReviewSurvey" 
            component={ReviewSurveyScreen}
            options={{
              headerTitle: 'Review Surveys',
            }}
          />
          <Stack.Screen 
            name="ReviewDetails" 
            component={ReviewDetailsScreen}
            options={{
              headerTitle: 'Survey Details',
            }}
          />
        </>
      ) : (
        // If role is not recognized, show the role selection screen
        <Stack.Screen
          name="RoleSelection"
          component={RoleSelectionScreen}
          options={{
            headerTitle: 'Select Role',
            headerLeft: null, // Disable back button
          }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = {
  logoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
};
