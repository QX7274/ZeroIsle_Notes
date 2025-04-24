import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TagStatistics = ({ statistics }) => {
  return (
    <View style={styles.container}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{statistics.totalTags || 0}</Text>
        <Text style={styles.statLabel}>总标签数</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{statistics.usedTags || 0}</Text>
        <Text style={styles.statLabel}>使用中的标签</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{statistics.unusedTags || 0}</Text>
        <Text style={styles.statLabel}>未使用的标签</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default TagStatistics; 