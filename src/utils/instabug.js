// Safe Instabug implementation that works even when native module isn't available
let Instabug = null;
let isInstabugAvailable = false;

// Try to import Instabug, but don't crash if it's not available
try {
  Instabug = require('instabug-reactnative').default;
  isInstabugAvailable = !!Instabug;
  console.log('Instabug is available:', isInstabugAvailable);
} catch (error) {
  console.log('Instabug is not available:', error.message);
  isInstabugAvailable = false;
}

// Initialize function to be called from App.js
export const initInstabug = (appToken, invocationEvents) => {
  if (!isInstabugAvailable) return;
  
  try {
    Instabug.start(appToken, invocationEvents);
    Instabug.setEnabled(true);
    Instabug.setPrimaryColor('#1976D2');
    console.log('Instabug initialized successfully');
  } catch (error) {
    console.log('Error initializing Instabug:', error);
  }
};

export const identifyUser = (userId, email, name) => {
  if (!isInstabugAvailable) return;
  try {
    Instabug.identifyUser(name, email, userId);
  } catch (error) {
    console.log('Error identifying user in Instabug:', error);
  }
};

export const logUserEvent = (eventName) => {
  if (!isInstabugAvailable) return;
  try {
    Instabug.logUserEvent(eventName);
  } catch (error) {
    console.log('Error logging user event in Instabug:', error);
  }
};

export const addFileAttachment = async (fileUri) => {
  if (!isInstabugAvailable) return false;
  try {
    await Instabug.addFileAttachment(fileUri);
    return true;
  } catch (error) {
    console.error('Error adding file attachment to Instabug:', error);
    return false;
  }
};

export const startScreenRecording = () => {
  Instabug.startScreenRecording();
};

export const stopScreenRecording = () => {
  Instabug.stopScreenRecording();
};

export const showFeedbackForm = () => {
  if (!isInstabugAvailable) {
    console.log('Instabug is not available for feedback');
    return;
  }
  try {
    Instabug.show();
  } catch (error) {
    console.log('Error showing Instabug feedback form:', error);
  }
};

export const setBugReportingOptions = () => {
  Instabug.setBugReportingEnabled(true);
  Instabug.setCommentMinimumCharacterCount(10);
  Instabug.setShakingThresholdForAndroid(0.7); // Adjust sensitivity
  Instabug.setFloatingButtonEdge(Instabug.floatingButtonEdge.right);
  Instabug.setFloatingButtonOffset(50, 50);
};

export const setInstabugUserAttribute = (key, value) => {
  Instabug.setUserAttribute(key, value);
};

export const clearInstabugUserAttribute = (key) => {
  if (!isInstabugAvailable) return;
  try {
    Instabug.removeUserAttribute(key);
  } catch (error) {
    console.log('Error clearing Instabug user attribute:', error);
  }
};

export const reportCrash = (error) => {
  if (!isInstabugAvailable) return;
  try {
    Instabug.reportJSException(error);
  } catch (err) {
    console.log('Error reporting crash to Instabug:', err);
  }
}; 