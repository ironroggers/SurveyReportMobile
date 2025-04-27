import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

// App Screens
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import SurveyorDashboard from '../screens/SurveyorDashboard';
import SupervisorDashboard from '../screens/SupervisorDashboard';
import AttendanceScreen from '../screens/AttendanceScreen';
import SupervisorAttendanceScreen from '../screens/SupervisorAttendanceScreen';
import SurveyFormScreen from '../screens/SurveyFormScreen';
import AssignLocationScreen from '../screens/AssignLocationScreen';
import ReviewSurveyScreen from '../screens/ReviewSurveyScreen';
import ReviewDetailsScreen from "../screens/ReviewDetailsScreen";
import LocationDetailsScreen from "../screens/LocationDetailsScreen";

// New Tab Screens
import LocationAssignmentScreen from '../screens/LocationAssignmentScreen';
import SurveyorListScreen from '../screens/SurveyorListScreen';
import MoreScreen from '../screens/MoreScreen';
import SurveyorLocationsScreen from '../screens/SurveyorLocationsScreen';
import SurveyDetailsScreen from '../screens/SurveyDetailsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Supervisor Bottom Tabs
function SupervisorTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
      }}
    >
      <Tab.Screen 
        name="SupervisorHome" 
        component={SupervisorDashboard} 
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="SurveyorList"
        component={SurveyorListScreen}
        options={{
          title: 'Surveyor',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="location-on" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="SurveyReview" 
        component={ReviewSurveyScreen} 
        options={{
          title: 'Locations',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="rate-review" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="SupervisorMore" 
        component={MoreScreen} 
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="more-horiz" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Surveyor Bottom Tabs
function SurveyorTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
      }}
    >
      <Tab.Screen 
        name="SurveyorHome" 
        component={SurveyorDashboard} 
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="AssignmentTab" 
        component={ReviewSurveyScreen}
        options={{
          title: 'My Work',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceScreen}
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="access-time" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen 
        name="SurveyorMore" 
        component={MoreScreen} 
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="more-horiz" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoading, userToken, userInfo } = useContext(AuthContext);

  // Safe access to userInfo
  const userRole = userInfo?.role || '';

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1976D2',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {!userToken ? (
        // Auth Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : (
        // App Stack - Role-based navigation
        <>
          {!userRole && (
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          )}
          
          {userRole.toUpperCase() === 'SUPERVISOR' ? (
            <Stack.Screen 
              name="SupervisorDashboard" 
              component={SupervisorTabs} 
              options={{ headerShown: false }} 
            />
          ) : (
            <Stack.Screen 
              name="SurveyorDashboard" 
              component={SurveyorTabs} 
              options={{ headerShown: false }} 
            />
          )}
          
          {/* Common screens */}
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="SupervisorAttendance" component={SupervisorAttendanceScreen} />
          <Stack.Screen name="SurveyForm" component={SurveyFormScreen} />
          <Stack.Screen name="AssignLocation" component={AssignLocationScreen} />
          <Stack.Screen name="ReviewDetails" component={ReviewDetailsScreen} />
          <Stack.Screen name="LocationDetails" component={LocationDetailsScreen} />
          <Stack.Screen name="SurveyorLocations" component={SurveyorLocationsScreen} />
          <Stack.Screen name="SurveyDetails" component={SurveyDetailsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
