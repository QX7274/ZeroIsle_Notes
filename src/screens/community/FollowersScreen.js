import React, { useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { fetchFollowers, selectFollowers, selectFollowersPagination, selectIsLoading, selectError } from '../../redux/slices/communitySlice';

const FollowersScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const dispatch = useDispatch();
  const followers = useSelector(selectFollowers);
  const pagination = useSelector(selectFollowersPagination);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  useEffect(() => {
    if (userId) {
      dispatch(fetchFollowers({ userId, page: 1, pageSize: 20 }));
    }
  }, [dispatch, userId]);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.colors?.text || '#000' }]}>{item.nickname}</Text>
        <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>{new Date(item.followedAt).toLocaleString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F2F2' }]}>
      {error ? <Text style={{ color: 'red', padding: 12 }}>{String(error)}</Text> : null}
      <FlatList
        data={followers}
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
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#ddd' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  time: { fontSize: 12 },
});

export default FollowersScreen;
