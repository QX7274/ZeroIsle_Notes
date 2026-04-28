import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { fetchActivity, selectActivity, selectActivityPagination, selectIsLoading, selectError } from '../../redux/slices/communitySlice';

const ActivityScreen = () => {
  const dispatch = useDispatch();
  const activity = useSelector(selectActivity);
  const pagination = useSelector(selectActivityPagination);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  useEffect(() => {
    dispatch(fetchActivity({ page: 1, pageSize: 20 }));
  }, [dispatch]);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={[styles.title, { color: theme.colors?.text || '#000' }]}>{item.title}</Text>
      <Text style={[styles.message, { color: theme.colors?.textSecondary || '#666' }]}>{item.message}</Text>
      <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F2F2' }]}>
      {error ? <Text style={{ color: 'red', padding: 12 }}>{String(error)}</Text> : null}
      <FlatList
        data={activity}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  message: { fontSize: 14, marginBottom: 4 },
  time: { fontSize: 12 },
});

export default ActivityScreen;


