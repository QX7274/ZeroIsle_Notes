import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { userApi } from '../../services/api';
import { setUserInfo } from '../../redux/slices/authSlice';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const BindQQ = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const isBound = Boolean(user?.qq_openid);
  const pageState = loading ? 'busy' : 'ready';

  const handleBindQQ = async () => {
    setLoading(true);
    Alert.alert(
      '提示',
      'QQ 绑定功能需要 QQ SDK 支持，当前为模拟流程。',
      [
        { text: '取消', style: 'cancel', onPress: () => setLoading(false) },
        {
          text: '继续',
          onPress: async () => {
            try {
              const code = `mock_qq_code_${Date.now()}`;
              const response = await userApi.bindQQ({ code });
              if (response.success) {
                dispatch(setUserInfo(response.data.user));
                Alert.alert('成功', 'QQ 绑定成功');
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
  };

  const handleUnbindQQ = async () => {
    Alert.alert(
      '确认解绑',
      '确定要解除 QQ 绑定吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '解绑',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await userApi.unbindQQ();
              if (response.success) {
                dispatch(setUserInfo(response.data.user));
                Alert.alert('成功', 'QQ 解绑成功');
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
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID={`state.settings.bindQQ.state.${pageState}`}>
      <View testID="state.settings.bindQQ.visibility.visible" />
      <View testID={`state.settings.bindQQ.loading.visibility.${loading ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.bindQQ.bound.${isBound ? 'yes' : 'no'}`} />

      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.settings.bindQQ.back"
          style={styles.backButton}
        />
        <Text variant="heading" level="h5" style={styles.pageTitle}>QQ 账号绑定</Text>
      </View>

      <View style={[styles.card, styles.glassCard]}>
        <View style={styles.cardHeader}>
          <Icon name="chat" size={36} color="#12B7F5" />
          <View style={styles.cardHeaderTextWrap}>
            <Text variant="heading" level="h5">QQ 账号绑定</Text>
            <Text variant="body" color="hint" style={styles.cardSubTitle}>绑定后可用于快捷登录</Text>
          </View>
        </View>

        <Text variant="body" style={styles.description} testID="state.settings.bindQQ.description">
          {isBound
            ? '你已绑定 QQ 账号，可使用 QQ 快捷登录。'
            : '绑定 QQ 账号后，可使用 QQ 快捷登录。'}
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: isBound ? '#FEE2E2' : colors.primary }]}
            onPress={isBound ? handleUnbindQQ : handleBindQQ}
            testID={isBound ? 'action.settings.bindQQ.unbind' : 'action.settings.bindQQ.bind'}
          >
            <Text variant="button" color={isBound ? 'error' : 'card'}>
              {isBound ? '解除绑定' : '绑定 QQ'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: {
    flex: 1,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    borderRadius: 16,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  card: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  cardSubTitle: {
    marginTop: 4,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 20,
  },
});

export default BindQQ;
