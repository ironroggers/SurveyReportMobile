import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { View, Text, Platform } from 'react-native';
import { initInstabug, reportCrash } from './src/utils/instabug';

// Check if we're in bridgeless mode - added check
const isBridgeless = global.__turboModuleProxy != null;

// Initialize Instabug more safely
const initializeInstabug = () => {
  try {
    // Only initialize Instabug in development mode or when not in bridgeless mode
    // This avoids the NativeEventEmitter error in bridgeless mode
    if (__DEV__ && !isBridgeless) {
      console.log('Initializing Instabug...');
      initInstabug('9275d57118506d1ac0a79bd77fc966ef', ['shake']);
      console.log('Instabug initialization complete');
    } else if (isBridgeless) {
      console.log('Skipping Instabug initialization in bridgeless mode');
    }
  } catch (error) {
    console.log('Failed to initialize Instabug:', error);
  }
};

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.log('App Error:', error);
    console.log('Error Info:', errorInfo);
    
    // Report error to Instabug (safely)
    reportCrash(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, textAlign: 'center', margin: 20 }}>
            Something went wrong. Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    // Initialize Instabug after the component mounts
    initializeInstabug();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ErrorBoundary>
  );
}
