import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { fetchFollowing, selectFollowing, selectFollowingPagination, selectIsLoading, selectError } from '../../redux/slices/communitySlice';

const FollowingScreen = ({ route }) => {
  const { userId } = route.params || {};
  const dispatch = useDispatch();
  const following = useSelector(selectFollowing);
  const pagination = useSelector(selectFollowingPagination);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  useEffect(() => {
    if (userId) {
      dispatch(fetchFollowing({ userId, page: 1, pageSize: 20 }));
    }
  }, [dispatch, userId]);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={[styles.name, { color: theme.colors?.text || '#000' }]}>
        对象: {item.contentType}:{item.targetId}
      </Text>
      <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
        {new Date(item.followedAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F2F2' }]}>
      {error ? <Text style={{ color: 'red', padding: 12 }}>{String(error)}</Text> : null}
      <FlatList
        data={following}
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
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5' },
  name: { fontSize: 16, fontWeight: '600' },
  time: { fontSize: 12, marginTop: 4 },
});

export default FollowingScreen;


