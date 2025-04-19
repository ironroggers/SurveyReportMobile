import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

// Handle unhandled promise rejections
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args[0]?.startsWith?.('Unhandled promise rejection')) {
      // Log the error but don't crash in development
      console.log('Unhandled Promise Rejection:', args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
} else {
  // In production, log to crash reporting service or handle differently
  console.error = (...args) => {
    console.log('Production Error:', args);
    // Here you could add crash reporting service integration
  };
}

// Ignore specific warnings that are not critical
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
