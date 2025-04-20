// Safe Instabug implementation that works even when native module isn't available
let Instabug = null;
let isInstabugAvailable = false;

// Try to import Instabug, but don't crash if it's not available
try {
  const InstabugModule = require('instabug-reactnative');
  Instabug = InstabugModule.default;
  isInstabugAvailable = !!Instabug && !!Instabug.isInitialized;
  console.log('Instabug availability check:', isInstabugAvailable ? 'Available' : 'Not available');
} catch (error) {
  console.log('Instabug is not available:', error.message);
  isInstabugAvailable = false;
}

// Create dummy implementations for when Instabug is not available
const dummyInstabug = {
  start: () => {},
  setEnabled: () => {},
  setPrimaryColor: () => {},
  identifyUser: () => {},
  logUserEvent: () => {},
  addFileAttachment: () => Promise.resolve(false),
  startScreenRecording: () => {},
  stopScreenRecording: () => {},
  show: () => {},
  setBugReportingEnabled: () => {},
  setCommentMinimumCharacterCount: () => {},
  setShakingThresholdForAndroid: () => {},
  setFloatingButtonEdge: () => {},
  setFloatingButtonOffset: () => {},
  setUserAttribute: () => {},
  removeUserAttribute: () => {},
  reportJSException: () => {}
};

// Use the real Instabug or our dummy implementation
const instabugInstance = isInstabugAvailable ? Instabug : dummyInstabug;

// Initialize function to be called from App.js
export const initInstabug = (appToken, invocationEvents) => {
  if (!isInstabugAvailable) {
    console.log('Skipping Instabug initialization - module not available');
    return;
  }
  
  try {
    instabugInstance.start(appToken, invocationEvents);
    instabugInstance.setEnabled(true);
    instabugInstance.setPrimaryColor('#1976D2');
    console.log('Instabug initialized successfully');
  } catch (error) {
    console.log('Error initializing Instabug:', error);
  }
};

export const identifyUser = (userId, email, name) => {
  if (!isInstabugAvailable) return;
  try {
    instabugInstance.identifyUser(name, email, userId);
  } catch (error) {
    console.log('Error identifying user in Instabug:', error);
  }
};

export const logUserEvent = (eventName) => {
  if (!isInstabugAvailable) return;
  try {
    instabugInstance.logUserEvent(eventName);
  } catch (error) {
    console.log('Error logging user event in Instabug:', error);
  }
};

export const addFileAttachment = async (fileUri) => {
  if (!isInstabugAvailable) return false;
  try {
    await instabugInstance.addFileAttachment(fileUri);
    return true;
  } catch (error) {
    console.error('Error adding file attachment to Instabug:', error);
    return false;
  }
};

export const startScreenRecording = () => {
  if (!isInstabugAvailable) return;
  instabugInstance.startScreenRecording();
};

export const stopScreenRecording = () => {
  if (!isInstabugAvailable) return;
  instabugInstance.stopScreenRecording();
};

export const showFeedbackForm = () => {
  if (!isInstabugAvailable) {
    console.log('Instabug is not available for feedback');
    return;
  }
  try {
    instabugInstance.show();
  } catch (error) {
    console.log('Error showing Instabug feedback form:', error);
  }
};

export const setBugReportingOptions = () => {
  if (!isInstabugAvailable) return;
  instabugInstance.setBugReportingEnabled(true);
  instabugInstance.setCommentMinimumCharacterCount(10);
  instabugInstance.setShakingThresholdForAndroid(0.7); // Adjust sensitivity
  instabugInstance.setFloatingButtonEdge(instabugInstance.floatingButtonEdge?.right || 'right');
  instabugInstance.setFloatingButtonOffset(50, 50);
};

export const setInstabugUserAttribute = (key, value) => {
  if (!isInstabugAvailable) return;
  instabugInstance.setUserAttribute(key, value);
};

export const clearInstabugUserAttribute = (key) => {
  if (!isInstabugAvailable) return;
  try {
    instabugInstance.removeUserAttribute(key);
  } catch (error) {
    console.log('Error clearing Instabug user attribute:', error);
  }
};

export const reportCrash = (error) => {
  if (!isInstabugAvailable) return;
  try {
    instabugInstance.reportJSException(error);
  } catch (err) {
    console.log('Error reporting crash to Instabug:', err);
  }
}; 