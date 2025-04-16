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

export default function SignUpScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(null);
  
  const { register, isLoading } = useContext(AuthContext);

  const handleSignUp = async () => {
    // Validate inputs
    if (!username || !email || !password || !confirmPassword || !role) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const userRole = await register(username, email, password, role);


      if (userRole && userRole.toUpperCase() === 'SUPERVISOR') {
        try {
          // Replace instead of navigate to prevent stacking
          navigation.replace('SupervisorDashboard');
        } catch (navError) {
          console.error("Navigation error:", navError);
          Alert.alert(
            'Navigation Error', 
            'Could not navigate to SupervisorDashboard. The screen may not be registered.'
          );
        }
      } else if (userRole && userRole.toUpperCase() === 'SURVEYOR') {
         navigation.replace('SurveyorDashboard');
      } else {
        Alert.alert('Navigation Error', `Unknown role: ${userRole}`);
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert('Registration Failed', error.message || 'Could not create account');
    }
  };

  const RoleButton = ({ title, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.roleButton, selected && styles.selectedRoleButton]}
      onPress={onPress}
    >
      <Text 
        style={[styles.roleButtonText, selected && styles.selectedRoleButtonText]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

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

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Select Role</Text>
            <View style={styles.roleContainer}>
              <RoleButton 
                title="Surveyor" 
                selected={role === 'SURVEYOR'}
                onPress={() => setRole('SURVEYOR')}
              />
              <RoleButton 
                title="Supervisor" 
                selected={role === 'SUPERVISOR'}
                onPress={() => setRole('SUPERVISOR')}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.signupButton}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>Login</Text>
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
  },
  formContainer: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
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
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    alignItems: 'center',
  },
  selectedRoleButton: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectedRoleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  signupButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
  loginText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 