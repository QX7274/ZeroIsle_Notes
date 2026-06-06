import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
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
import { showToast } from '../../components/common/ToastHelper';

const BindQQ = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMode, setConfirmMode] = useState('bind');
  const isBound = Boolean(user?.qq_openid);
  const pageState = loading ? 'busy' : 'ready';

  const closeConfirm = () => {
    if (!loading) {
      setConfirmVisible(false);
    }
  };

  const runBindQQ = async () => {
    setLoading(true);
    setConfirmVisible(false);
    try {
      const code = `mock_qq_code_${Date.now()}`;
      const response = await userApi.bindQQ({ code });
      if (response.success) {
        dispatch(setUserInfo(response.data.user));
        showToast.success('QQ 绑定成功');
        navigation.goBack();
      } else {
        showToast.error(response.message || '绑定失败');
      }
    } catch (error) {
      showToast.error(error.message || '绑定失败');
    } finally {
      setLoading(false);
    }
  };

  const runUnbindQQ = async () => {
    setLoading(true);
    setConfirmVisible(false);
    try {
      const response = await userApi.unbindQQ();
      if (response.success) {
        dispatch(setUserInfo(response.data.user));
        showToast.success('QQ 解绑成功');
      } else {
        showToast.error(response.message || '解绑失败');
      }
    } catch (error) {
      showToast.error(error.message || '解绑失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBindQQ = async () => {
    setConfirmMode('bind');
    setConfirmVisible(true);
  };

  const handleUnbindQQ = async () => {
    setConfirmMode('unbind');
    setConfirmVisible(true);
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

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmCard, styles.glassCard]}>
            <Text variant="heading" level="h5" style={styles.confirmTitle}>
              {confirmMode === 'bind' ? 'QQ 绑定确认' : '确认解绑 QQ'}
            </Text>
            <Text variant="body" color="hint" style={styles.confirmMessage}>
              {confirmMode === 'bind'
                ? 'QQ 绑定功能需要 QQ SDK 支持，当前为模拟流程。是否继续？'
                : '确定要解除 QQ 绑定吗？解除后将无法使用 QQ 快捷登录。'}
            </Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={closeConfirm}
                disabled={loading}
              >
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, confirmMode === 'bind' ? styles.confirmPrimaryButton : styles.confirmDangerButton]}
                onPress={confirmMode === 'bind' ? runBindQQ : runUnbindQQ}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmPrimaryText}>
                    {confirmMode === 'bind' ? '继续' : '解绑'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,28,56,0.34)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
  },
  confirmTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmMessage: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.22)',
  },
  confirmPrimaryButton: {
    backgroundColor: '#1D4ED8',
  },
  confirmDangerButton: {
    backgroundColor: '#DC2626',
  },
  confirmCancelText: {
    color: '#1F5FBF',
    fontWeight: '600',
  },
  confirmPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default BindQQ;
