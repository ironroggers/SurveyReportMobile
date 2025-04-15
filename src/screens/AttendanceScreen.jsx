import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const [attendanceMap, setAttendanceMap] = useState({});

  useEffect(() => {
    const presentDates = ['2025-04-01', '2025-04-03', '2025-04-05'];
    const absentDates = ['2025-04-02', '2025-04-04', '2025-04-06'];

    const map = {};
    presentDates.forEach((date) => (map[date] = 'present'));
    absentDates.forEach((date) => (map[date] = 'absent'));

    setAttendanceMap(map);
  }, []);

  const renderDay = ({ date, state }) => {
    const day = date.dateString;
    const status = attendanceMap[day];

    let bgColor = '#fff';
    let textColor = state === 'disabled' ? '#ccc' : '#000';
    let symbol = '';

    if (status === 'present') {
      bgColor = '#A5D6A7'; // green
      symbol = '✔';
    } else if (status === 'absent') {
      bgColor = '#EF9A9A'; // red
      symbol = '✖';
    }

    return (
      <View style={[styles.dayContainer, { backgroundColor: bgColor }]}>
        <Text style={[styles.dayText, { color: textColor }]}>{date.day}</Text>
        {symbol !== '' && <Text style={styles.symbol}>{symbol}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Attendance Calendar</Text>
      <Calendar
        style={styles.calendar}
        markingType={'custom'}
        dayComponent={renderDay}
        theme={{
          todayTextColor: '#1976D2',
          arrowColor: '#1976D2',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
      />

      <View style={styles.legend}>
        <View style={[styles.colorBox, { backgroundColor: '#A5D6A7' }]} />
        <Text style={styles.legendText}>✔ Present</Text>
        <View style={[styles.colorBox, { backgroundColor: '#EF9A9A', marginLeft: 16 }]} />
        <Text style={styles.legendText}>✖ Absent</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  calendar: {
    borderRadius: 12,
    elevation: 2,
    width: width - 32,
    alignSelf: 'center',
  },
  dayContainer: {
    width: 38,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  symbol: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: 'bold',
  },
  legend: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#444',
  },
});
