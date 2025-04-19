import Instabug from 'instabug-reactnative';

export const identifyUser = (userId, email, name) => {
  Instabug.identifyUser(name, email, userId);
};

export const logUserEvent = (eventName) => {
  Instabug.logUserEvent(eventName);
};

export const addFileAttachment = async (fileUri) => {
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
  Instabug.show();
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
  Instabug.removeUserAttribute(key);
}; 