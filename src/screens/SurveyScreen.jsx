import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function SurveyScreen() {
  const navigation = useNavigation();
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Survey Management</Text>
      <Text style={styles.subtitle}>Create and manage your surveys</Text>
      
      <View style={styles.cardContainer}>
        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('SurveyForm')}
        >
          <Text style={styles.cardTitle}>Create New Survey</Text>
          <Text style={styles.cardDescription}>Start a new survey at your current location</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('SurveyList')}
        >
          <Text style={styles.cardTitle}>View My Surveys</Text>
          <Text style={styles.cardDescription}>See all your submitted and draft surveys</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.infoText}>
        Use this screen to create new surveys or view your existing ones.
        More features coming soon!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976D2',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  cardContainer: {
    marginVertical: 20,
  },
  card: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 