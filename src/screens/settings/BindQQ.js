/**
 * QQ绑定屏幕
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { userApi } from '../../services/api';
import { setUserInfo } from '../../redux/slices/authSlice';

const BindQQ = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const [loading, setLoading] = useState(false);

  // 绑定QQ
  const handleBindQQ = async () => {
    try {
      setLoading(true);

      // 这里应该调用QQ SDK获取授权码
      // 由于我们没有实际的QQ SDK，这里只是模拟
      Alert.alert(
        '提示',
        'QQ绑定功能需要QQ SDK支持，当前为模拟操作',
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => setLoading(false),
          },
          {
            text: '继续',
            onPress: async () => {
              try {
                // 模拟获取授权码
                const code = 'mock_qq_code_' + Date.now();

                // 调用绑定API
                const response = await userApi.bindQQ({ code });

                if (response.success) {
                  // 更新用户信息
                  dispatch(setUserInfo(response.data.user));
                  Alert.alert('成功', 'QQ绑定成功');
                  navigation.goBack();
                } else {
                  Alert.alert('错误', response.message || '绑定失败');
                }
              } catch (error) {
                Alert.alert('错误', error.message || '绑定失败');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('错误', error.message || '绑定失败');
      setLoading(false);
    }
  };

  // 解绑QQ
  const handleUnbindQQ = async () => {
    try {
      Alert.alert(
        '确认解绑',
        '确定要解除QQ绑定吗？',
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '解绑',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                const response = await userApi.unbindQQ();

                if (response.success) {
                  // 更新用户信息
                  dispatch(setUserInfo(response.data.user));
                  Alert.alert('成功', 'QQ解绑成功');
                } else {
                  Alert.alert('错误', response.message || '解绑失败');
                }
              } catch (error) {
                Alert.alert('错误', error.message || '解绑失败');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('错误', error.message || '解绑失败');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Icon name="chat" size={36} color="#12B7F5" />
          <Text
            variant="heading"
            level="h5"
            style={styles.title}
          >
            QQ账号绑定
          </Text>
        </View>

        <Text
          variant="body"
          style={styles.description}
        >
          {user?.qq_openid
            ? '您已绑定QQ账号，可以使用QQ快速登录'
            : '绑定QQ账号后，可以使用QQ快速登录'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: user?.qq_openid ? colors.error + '20' : colors.primary,
              },
            ]}
            onPress={user?.qq_openid ? handleUnbindQQ : handleBindQQ}
          >
            <Text
              variant="button"
              color={user?.qq_openid ? 'error' : 'white'}
            >
              {user?.qq_openid ? '解除绑定' : '绑定QQ'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    marginLeft: 16,
  },
  description: {
    marginBottom: 30,
    lineHeight: 22,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 20,
  },
});

export default BindQQ;
