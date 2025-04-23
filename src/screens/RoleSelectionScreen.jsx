import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function RoleSelectionScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select Your Role</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SurveyorDashboard' }],
          });
        }}
      >
        <Text style={styles.buttonText}>Surveyor</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SupervisorDashboard' }],
          });
        }}
      >
        <Text style={styles.buttonText}>Supervisor</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  heading: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  button: {
    backgroundColor: '#1976D2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20
  },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '600' }
});
