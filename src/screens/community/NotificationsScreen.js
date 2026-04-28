import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, selectNotifications, selectNotificationsPagination, selectIsLoading, selectError } from '../../redux/slices/communitySlice';

const NotificationsScreen = () => {
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);
  const pagination = useSelector(selectNotificationsPagination);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  useEffect(() => {
    dispatch(fetchNotifications({ page: 1, pageSize: 20 }));
  }, [dispatch]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, { opacity: item.is_read ? 0.6 : 1 }]}
      onPress={() => dispatch(markNotificationRead(item.id))}
    >
      <Text style={[styles.title, { color: theme.colors?.text || '#000' }]}>{item.title}</Text>
      <Text style={[styles.message, { color: theme.colors?.textSecondary || '#666' }]}>{item.message}</Text>
      <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F2F2' }]}>
      {error ? <Text style={{ color: 'red', padding: 12 }}>{String(error)}</Text> : null}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.btn} onPress={() => dispatch(markAllNotificationsRead())}>
          <Text style={styles.btnText}>全部标记已读</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
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
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#2196F3', borderRadius: 6 },
  btnText: { color: '#fff', fontWeight: '600' },
  item: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  message: { fontSize: 14, marginBottom: 4 },
  time: { fontSize: 12 },
});

export default NotificationsScreen;


