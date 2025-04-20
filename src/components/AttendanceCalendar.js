import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import attendanceApi from '../api/attendanceApi';

const AttendanceCalendar = ({ onDateSelect }) => {
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [markedDates, setMarkedDates] = useState({});

  useEffect(() => {
    fetchMonthAttendance();
  }, []);

  const fetchMonthAttendance = async () => {
    try {
      setLoading(true);
      
      // Get first and last day of current month
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const response = await attendanceApi.getAttendanceHistory({
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0]
      });
      
      if (response.data) {
        processAttendanceData(response.data);
      }
    } catch (error) {
      console.error('Error fetching attendance history for calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAttendanceData = (data) => {
    const attendanceMap = {};
    const markedDatesObj = {};
    
    data.forEach(record => {
      // Parse the date to get YYYY-MM-DD format
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      
      // Store the full record for potential detailed view
      attendanceMap[dateStr] = record;
      
      // Set the marked date with appropriate color based on status
      let dotColor;
      switch(record.status) {
        case 'present':
          dotColor = '#4CAF50'; // green
          break;
        case 'absent':
          dotColor = '#F44336'; // red
          break;
        case 'late':
          dotColor = '#FF9800'; // orange
          break;
        default:
          dotColor = '#9E9E9E'; // gray
      }
      
      markedDatesObj[dateStr] = {
        customStyles: {
          container: {
            backgroundColor: record.status === 'present' ? '#E8F5E9' : 
                            record.status === 'absent' ? '#FFEBEE' : 
                            record.status === 'late' ? '#FFF3E0' : '#F5F5F5'
          },
          text: {
            color: record.status === 'present' ? '#4CAF50' : 
                  record.status === 'absent' ? '#F44336' : 
                  record.status === 'late' ? '#FF9800' : '#616161',
            fontWeight: 'bold'
          },
          dots: [{ color: dotColor }]
        }
      };
    });
    
    setAttendanceData(attendanceMap);
    setMarkedDates(markedDatesObj);
  };

  const handleDateChange = (date) => {
    const dateStr = date.dateString;
    setSelectedDate(dateStr);
    
    if (attendanceData[dateStr]) {
      onDateSelect?.(attendanceData[dateStr]);
    } else {
      onDateSelect?.(null);
    }
  };

  const renderCustomDay = ({ date, state, marking }) => {
    const dateStr = date.dateString;
    const record = attendanceData[dateStr];
    
    // Day is out of current month
    if (state === 'disabled') {
      return (
        <View style={styles.dayContainer}>
          <Text style={styles.disabledDayText}>{date.day}</Text>
        </View>
      );
    }
    
    let statusIcon = null;
    if (record) {
      if (record.status === 'present') {
        statusIcon = <MaterialIcons name="check" size={16} color="#4CAF50" />;
      } else if (record.status === 'absent') {
        statusIcon = <MaterialIcons name="close" size={16} color="#F44336" />;
      } else if (record.status === 'late') {
        statusIcon = <MaterialIcons name="watch-later" size={16} color="#FF9800" />;
      }
    }
    
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    
    const containerStyle = {
      backgroundColor: record ? (
        record.status === 'present' ? '#E8F5E9' : 
        record.status === 'absent' ? '#FFEBEE' :
        record.status === 'late' ? '#FFF3E0' : 'transparent'
      ) : (isToday ? '#E3F2FD' : 'transparent'),
      borderColor: isSelected ? '#1976D2' : 'transparent',
      borderWidth: isSelected ? 2 : 0,
    };
    
    return (
      <View style={[styles.dayContainer, containerStyle]}>
        <Text style={[
          styles.dayText,
          isToday && styles.todayText
        ]}>
          {date.day}
        </Text>
        {statusIcon}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Loading attendance calendar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        style={styles.calendar}
        markedDates={markedDates}
        markingType="custom"
        onDayPress={handleDateChange}
        dayComponent={renderCustomDay}
        theme={{
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#616161',
          textSectionTitleDisabledColor: '#d9e1e8',
          selectedDayBackgroundColor: '#1976D2',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#1976D2',
          dayTextColor: '#2d4150',
          textDisabledColor: '#d9e1e8',
          dotColor: '#00adf5',
          selectedDotColor: '#ffffff',
          arrowColor: '#1976D2',
          disabledArrowColor: '#d9e1e8',
          monthTextColor: '#1976D2',
          indicatorColor: '#1976D2',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300'
        }}
      />

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#E8F5E9' }]} />
          <MaterialIcons name="check" size={16} color="#4CAF50" />
          <Text style={styles.legendText}>Present</Text>
        </View>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFEBEE' }]} />
          <MaterialIcons name="close" size={16} color="#F44336" />
          <Text style={styles.legendText}>Absent</Text>
        </View>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FFF3E0' }]} />
          <MaterialIcons name="watch-later" size={16} color="#FF9800" />
          <Text style={styles.legendText}>Late</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={fetchMonthAttendance}
      >
        <MaterialIcons name="refresh" size={16} color="#fff" />
        <Text style={styles.refreshText}>Refresh Calendar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  calendar: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  dayContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
  },
  disabledDayText: {
    fontSize: 14,
    color: '#ccc',
  },
  todayText: {
    fontWeight: 'bold',
    color: '#1976D2',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  refreshButton: {
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  }
});

export default AttendanceCalendar; 