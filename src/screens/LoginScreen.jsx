import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useContext(AuthContext);
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      console.log('Attempting login with email:', email);
      
      // Add a loading message for better UX during login
      if (Platform.OS === 'ios') {
        // On iOS, show a loading indicator
        // (On Android, we already have the isLoading state for this)
        Alert.alert('Logging in...', 'Please wait while we authenticate you.');
      }
      
      const userRole = await login(email, password);
      console.log("UserRole after login:", userRole);
      
      if (!userRole || userRole === 'unknown') {
        console.log('No role or unknown role received from login:', userRole);
        // Still allow login but with a warning
        Alert.alert(
          'Warning',
          'Could not determine your role. Some features might be limited.',
          [
            { 
              text: 'Continue',
              onPress: () => {
                // Default to SURVEYOR if role is unknown
                navigateBasedOnRole('SURVEYOR');
              }
            }
          ]
        );
        return;
      }

      console.log('Login successful, user role:', userRole);
      navigateBasedOnRole(userRole.toUpperCase());
    } catch (error) {
      console.log('Login error details:', error);
      
      // More detailed error message
      let errorMessage = 'Could not log in. Please check your credentials and try again.';
      
      if (error.message) {
        errorMessage = error.message;
        
        // Add more helpful information for specific errors
        if (error.message.includes('No authentication token')) {
          errorMessage += '\n\nThe server response format was unexpected. Please contact support.';
        }
      }
      
      Alert.alert(
        'Login Failed',
        errorMessage
      );
    }
  };

  // Helper function to navigate based on role
  const navigateBasedOnRole = (normalizedRole) => {
    requestAnimationFrame(() => {
      try {
        if (normalizedRole === 'SUPERVISOR') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SupervisorDashboard' }],
          });
        } else if (normalizedRole === 'SURVEYOR') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SurveyorDashboard' }],
          });
        } else {
          Alert.alert('Error', `Unknown role: ${normalizedRole}`);
        }
      } catch (navError) {
        console.log('Navigation error:', navError);
        Alert.alert(
          'Navigation Error',
          'Could not navigate to dashboard. Please try logging in again.'
        );
      }
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signupText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
  signupText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 