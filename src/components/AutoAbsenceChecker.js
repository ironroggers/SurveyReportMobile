import { useEffect } from 'react';
import { Alert } from 'react-native';
import attendanceApi from '../api/attendanceApi';

/**
 * Component temporarily disabled as supervisor functionality is not available.
 * This component would normally check for absences after the deadline.
 */
const AutoAbsenceChecker = ({ onComplete }) => {
  // Disabled: No action taken automatically
  useEffect(() => {
    // Functionality disabled
    console.log('Auto absence checking disabled - supervisor functionality removed');
    
    // No interval setup
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default AutoAbsenceChecker; 