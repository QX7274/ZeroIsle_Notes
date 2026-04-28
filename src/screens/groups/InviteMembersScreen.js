/**
 * 邀请成员屏幕
 */
import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ToastAndroid, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { useRoute } from '@react-navigation/native';
import { Button, Text } from 'react-native-paper';
import { inviteUserToGroup } from '../../redux/slices/groupsSlice';
import { COLORS } from '../../utils/constants/colors';

const InviteMembersScreen = () => {
  const route = useRoute();
  const dispatch = useDispatch();
  const { groupId } = route.params;

  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineHint, setInlineHint] = useState('');

  const notifyNonBlocking = (message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const handleInvite = async () => {
    const value = userId.trim();
    if (!value) {
      notifyNonBlocking('请输入用户ID');
      return;
    }

    try {
      setLoading(true);
      await dispatch(inviteUserToGroup({ groupId, userId: value })).unwrap();
      notifyNonBlocking('邀请已发送');
      setUserId('');
    } catch (err) {
      notifyNonBlocking(err?.message || '邀请失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      <Text style={styles.label}>输入用户ID以邀请加入群组</Text>
      <TextInput
        style={styles.input}
        placeholder="用户ID"
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
      />
      <Button mode="contained" onPress={handleInvite} loading={loading}>
        发送邀请
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    padding: 16,
  },
  hintText: {
    marginBottom: 10,
    color: COLORS.WARNING || '#ff9800',
    fontSize: 13,
  },
  label: {
    marginBottom: 8,
    color: COLORS.TEXT,
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
});

export default InviteMembersScreen;


