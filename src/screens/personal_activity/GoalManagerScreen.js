/**
 * 目标管理界面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import NetworkErrorAlert from '../../components/common/NetworkErrorAlert';
import { showToast } from '../../components/common/ToastHelper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import personalActivityApi from '../../services/api/personalActivityApi';
import networkErrorService from '../../services/networkErrorService';
import tryRestoreDevSession from '../../services/auth/devSessionRestore';

const normalizeGoalListPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const extractGoalValidationMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

  if (!responseData || typeof responseData !== 'object') {
    return fallbackMessage;
  }

  const candidateFields = [
    responseData.non_field_errors,
    responseData.detail,
    responseData.message,
    responseData.error,
    responseData.errors?.non_field_errors,
    responseData.errors?.detail,
  ];

  for (const candidate of candidateFields) {
    if (Array.isArray(candidate) && candidate[0]) {
      return String(candidate[0]);
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (responseData.errors && typeof responseData.errors === 'object') {
    for (const fieldErrors of Object.values(responseData.errors)) {
      if (Array.isArray(fieldErrors) && fieldErrors[0]) {
        return String(fieldErrors[0]);
      }

      if (typeof fieldErrors === 'string' && fieldErrors.trim()) {
        return fieldErrors.trim();
      }
    }
  }

  return fallbackMessage;
};

const GoalManagerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [progressDialogVisible, setProgressDialogVisible] = useState(false);
  const [networkErrorVisible, setNetworkErrorVisible] = useState(false);
  const [networkErrorState, setNetworkErrorState] = useState(null);
  const [formStatus, setFormStatus] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [pendingDeleteGoal, setPendingDeleteGoal] = useState(null);
  const [progressGoal, setProgressGoal] = useState(null);
  const [progressValueInput, setProgressValueInput] = useState('');
  const [progressStatusInput, setProgressStatusInput] = useState('active');
  const [goalActionLoading, setGoalActionLoading] = useState({});
  const modalTitle = editingGoal ? '编辑目标' : '新建目标';
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'quantitative',
    target_value: '',
    unit: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const goalTypes = [
    { key: 'quantitative', label: '数量目标', icon: 'trending-up' },
    { key: 'habit', label: '习惯养成', icon: 'repeat' },
    { key: 'milestone', label: '里程碑', icon: 'flag' },
    { key: 'qualitative', label: '定性目标', icon: 'star' },
  ];
  const goalStatuses = [
    { key: 'active', label: '进行中', icon: 'play-arrow' },
    { key: 'paused', label: '已暂停', icon: 'pause' },
    { key: 'completed', label: '已完成', icon: 'check-circle' },
    { key: 'cancelled', label: '已取消', icon: 'cancel' },
  ];

  const dismissNetworkError = () => {
    setNetworkErrorVisible(false);
    setNetworkErrorState(null);
    networkErrorService.clearCurrentError();
  };

  const presentNetworkError = (error, customMessage, onRetry) => {
    if (networkErrorService.isNetworkError(error)) {
      const enhancedError = {
        ...error,
        errorType: networkErrorService.getNetworkErrorType(error),
        userMessage: customMessage,
      };
      setNetworkErrorState({ error: enhancedError, onRetry });
      setNetworkErrorVisible(true);
      return true;
    }

    return false;
  };

  const showFormStatus = (message, type = 'info') => {
    setFormStatus({ message, type });
  };

  const clearFormStatus = () => {
    setFormStatus(null);
  };

  const setGoalBusy = (goalId, busy) => {
    setGoalActionLoading(prev => {
      if (!goalId) {
        return prev;
      }
      return {
        ...prev,
        [goalId]: busy,
      };
    });
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const isUnauthorizedGoalError = (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const detail = error?.response?.data?.detail;
    const message = error?.message;

    return status === 401
      || code === 'token_not_valid'
      || detail === '身份认证信息未提供。'
      || String(message || '').includes('登录状态已失效');
  };

  const loadGoals = async (options = {}) => {
    const {
      hasRetriedAuth = false,
    } = options;

    try {
      setLoading(true);
      const response = await personalActivityApi.getGoals({ suppressGlobalErrorUI: true });
      setGoals(normalizeGoalListPayload(response));
    } catch (error) {
      if (!hasRetriedAuth && isUnauthorizedGoalError(error)) {
        const restoredSession = await tryRestoreDevSession({ forceRefresh: true });
        if (restoredSession?.token) {
          await loadGoals({ hasRetriedAuth: true });
          return;
        }
      }

      if (
        error?.response?.status >= 500
        && !presentNetworkError(error, '目标数据加载失败，请确认当前设备与后端联通后重试', loadGoals)
      ) {
        showToast.error('目标数据加载失败，请稍后重试');
        return;
      }

      if (!presentNetworkError(error, '网络连接失败，请检查网络设置后重试', loadGoals)) {
        showToast.error('加载目标失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!formData.title.trim()) {
      showFormStatus('目标标题不能为空', 'warning');
      return;
    }

    clearFormStatus();

    try {
      const goalData = {
        ...formData,
        target_value: formData.target_value ? parseFloat(formData.target_value) : null,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      };

      if (editingGoal) {
        await personalActivityApi.updateGoal(editingGoal._id, goalData, { suppressGlobalErrorUI: true });
        showFormStatus('目标更新成功', 'success');
        showToast.success('目标更新成功');
      } else {
        await personalActivityApi.createGoal(goalData, { suppressGlobalErrorUI: true });
        showFormStatus('目标创建成功', 'success');
        showToast.success('目标创建成功');
      }

      setModalVisible(false);
      setEditingGoal(null);
      resetForm();
      loadGoals();
    } catch (error) {
      const actionLabel = editingGoal ? '更新' : '创建';
      const fallbackMessage = `目标${actionLabel}失败，请稍后重试`;
      const validationMessage = extractGoalValidationMessage(error, fallbackMessage);

      if (error?.response?.status === 400) {
        showFormStatus(validationMessage, 'error');
        return;
      }

      if (!presentNetworkError(error, `目标${actionLabel}失败，请确认网络与后端服务正常后重试`, handleSaveGoal)) {
        showFormStatus(validationMessage, 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'quantitative',
      target_value: '',
      unit: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  const handleEditGoal = (goal) => {
    clearFormStatus();
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      type: goal.type,
      target_value: goal.target_value?.toString() || '',
      unit: goal.unit || '',
      start_date: new Date(goal.start_date).toISOString().split('T')[0],
      end_date: new Date(goal.end_date).toISOString().split('T')[0],
    });
    setModalVisible(true);
  };

  const handleDeleteGoal = (goal) => {
    setPendingDeleteGoal(goal);
    setConfirmDialogVisible(true);
  };

  const canTrackGoalValue = (goal) => (
    goal?.type === 'quantitative' || goal?.type === 'habit'
  );

  const openProgressDialog = (goal) => {
    setProgressGoal(goal);
    setProgressValueInput(
      goal?.current_value === null || goal?.current_value === undefined
        ? ''
        : String(goal.current_value)
    );
    setProgressStatusInput(goal?.status || 'active');
    setProgressDialogVisible(true);
  };

  const closeProgressDialog = () => {
    setProgressDialogVisible(false);
    setProgressGoal(null);
    setProgressValueInput('');
    setProgressStatusInput('active');
  };

  const handleQuickStatusUpdate = async (goal, nextStatus) => {
    if (!goal?._id || goal.status === nextStatus) {
      return;
    }

    try {
      setGoalBusy(goal._id, true);
      await personalActivityApi.updateGoalStatus(goal._id, nextStatus, { suppressGlobalErrorUI: true });
      showToast.success(`目标已更新为${getStatusText(nextStatus)}`);
      await loadGoals();
    } catch (error) {
      if (!presentNetworkError(error, '目标状态更新失败，请确认网络与后端服务正常后重试', () => handleQuickStatusUpdate(goal, nextStatus))) {
        showToast.error(extractGoalValidationMessage(error, '目标状态更新失败，请稍后重试'));
      }
    } finally {
      setGoalBusy(goal._id, false);
    }
  };

  const handleSaveProgress = async () => {
    if (!progressGoal?._id) {
      return;
    }

    const shouldUpdateValue = canTrackGoalValue(progressGoal);
    const parsedValue = progressValueInput === '' ? null : parseFloat(progressValueInput);

    if (shouldUpdateValue && (parsedValue === null || Number.isNaN(parsedValue) || parsedValue < 0)) {
      showToast.error('请输入有效的当前进度值');
      return;
    }

    try {
      setGoalBusy(progressGoal._id, true);
      const payload = {
        status: progressStatusInput,
      };

      if (shouldUpdateValue) {
        payload.current_value = parsedValue;
      }

      await personalActivityApi.updateGoal(progressGoal._id, payload, { suppressGlobalErrorUI: true });
      showToast.success('目标进度已更新');
      closeProgressDialog();
      await loadGoals();
    } catch (error) {
      if (!presentNetworkError(error, '目标进度更新失败，请确认网络与后端服务正常后重试', handleSaveProgress)) {
        showToast.error(extractGoalValidationMessage(error, '目标进度更新失败，请稍后重试'));
      }
    } finally {
      setGoalBusy(progressGoal._id, false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteGoal?._id) {
      setConfirmDialogVisible(false);
      setPendingDeleteGoal(null);
      return;
    }

    try {
      await personalActivityApi.deleteGoal(pendingDeleteGoal._id, { suppressGlobalErrorUI: true });
      showToast.success('目标删除成功');
      setConfirmDialogVisible(false);
      setPendingDeleteGoal(null);
      loadGoals();
    } catch (error) {
      const validationMessage = extractGoalValidationMessage(error, '删除目标失败，请稍后重试');

      if (error?.response?.status === 400) {
        showToast.error(validationMessage);
        return;
      }

      if (!presentNetworkError(error, '删除目标失败，请确认网络与后端服务正常后重试', handleConfirmDelete)) {
        showToast.error(validationMessage);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'active': return colors.primary;
      case 'paused': return colors.warning;
      case 'cancelled': return colors.error;
      default: return colors.text;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'active': return '进行中';
      case 'paused': return '已暂停';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const renderGoalItem = (goal) => (
    <View key={goal._id} style={[styles.goalItem, { backgroundColor: colors.card }]}>
      <View style={styles.goalHeader}>
        <Text variant="body" style={styles.goalTitle}>{goal.title}</Text>
        <View style={styles.goalActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditGoal(goal)}
          >
            <Icon name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteGoal(goal)}
          >
            <Icon name="delete" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <Text variant="caption" style={styles.goalDescription}>
        {goal.description || '无描述'}
      </Text>

      <View style={styles.goalProgress}>
        <View style={styles.progressInfo}>
          <Text variant="caption" style={styles.progressText}>
            进度: {goal.completion_rate || 0}%
          </Text>
          <Text variant="caption" style={[styles.statusText, { color: getStatusColor(goal.status) }]}>
            {getStatusText(goal.status)}
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: getStatusColor(goal.status),
                width: `${goal.completion_rate || 0}%`,
              },
            ]}
          />
        </View>
      </View>

      {goal.target_value && (
        <Text variant="caption" style={styles.goalTarget}>
          目标: {goal.current_value || 0} / {goal.target_value} {goal.unit}
        </Text>
      )}

      <View style={styles.goalMetaRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(goal.status)}18` }]}>
          <Text style={[styles.statusBadgeText, { color: getStatusColor(goal.status) }]}>
            {getStatusText(goal.status)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.progressShortcutButton, { borderColor: `${colors.primary}33` }]}
          onPress={() => openProgressDialog(goal)}
          activeOpacity={0.88}
        >
          <Icon name={canTrackGoalValue(goal) ? 'tune' : 'flag'} size={16} color={colors.primary} />
          <Text style={[styles.progressShortcutText, { color: colors.primary }]}>
            {canTrackGoalValue(goal) ? '更新进度' : '更新状态'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickStatusRow}>
        {goalStatuses.map(statusOption => {
          const active = goal.status === statusOption.key;
          const busy = Boolean(goalActionLoading[goal._id]);
          return (
            <TouchableOpacity
              key={`${goal._id}_${statusOption.key}`}
              style={[
                styles.quickStatusChip,
                {
                  backgroundColor: active ? `${getStatusColor(statusOption.key)}18` : `${colors.border}30`,
                  borderColor: active ? `${getStatusColor(statusOption.key)}45` : `${colors.border}70`,
                },
              ]}
              activeOpacity={0.88}
              disabled={busy}
              onPress={() => handleQuickStatusUpdate(goal, statusOption.key)}
            >
              {busy && active ? (
                <ActivityIndicator size="small" color={getStatusColor(statusOption.key)} />
              ) : (
                <Icon
                  name={statusOption.icon}
                  size={15}
                  color={active ? getStatusColor(statusOption.key) : colors.textSecondary || `${colors.text}99`}
                />
              )}
              <Text
                style={[
                  styles.quickStatusText,
                  {
                    color: active ? getStatusColor(statusOption.key) : colors.textSecondary || `${colors.text}99`,
                  },
                ]}
              >
                {statusOption.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text variant="caption" style={styles.goalDates}>
        {new Date(goal.start_date).toLocaleDateString()} - {new Date(goal.end_date).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 头部 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.goalManager.back"
          style={styles.backButton}
        />
        <Text variant="h2" style={styles.headerTitle}>目标管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingGoal(null);
            resetForm();
            setModalVisible(true);
          }}
        >
          <Icon name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 目标列表 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {goals.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: `${colors.primary}20` }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}12` }]}>
              <Icon name="flag" size={34} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              还没有设置目标
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.text + '80' }]}>
              点击右上角的 + 号创建第一个目标，列表会在这里集中展示进度与周期。
            </Text>
          </View>
        ) : (
          <View style={styles.goalListSection}>
            <View style={styles.goalList}>
              {goals.map(renderGoalItem)}
            </View>
            <View style={[styles.goalListFooter, { backgroundColor: colors.card, borderColor: `${colors.primary}20` }]}>
              <Text style={[styles.goalListFooterTitle, { color: colors.text }]}>
                已创建 {goals.length} 个目标
              </Text>
              <Text style={[styles.goalListFooterText, { color: colors.text + '80' }]}>
                继续点击右上角的 + 号补充规划，让列表区在平板上保持完整承接，不留下生硬空白。
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 编辑模态框 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
            <View style={styles.modalHeaderSide}>
              <ScreenHeaderBackButton
                onPress={() => setModalVisible(false)}
                testID="action.goalManager.modalBack"
              />
            </View>
            <View style={styles.modalHeaderCenter}>
              <Text variant="h3" style={[styles.modalTitle, { color: colors.text }]}>
                {modalTitle}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary || `${colors.text}80` }]}>
                保持顶部风格统一，减少原始表单感和异常留白
              </Text>
            </View>
            <View style={[styles.modalHeaderSide, styles.modalHeaderActionWrap]}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSaveButton,
                  {
                    backgroundColor: pressed ? `${colors.primary}D9` : colors.primary,
                  },
                ]}
                onPress={handleSaveGoal}
                testID="action.goalManager.save"
              >
                <Text style={styles.modalSaveText}>保存</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.modalIntroCard, { backgroundColor: colors.card, borderColor: `${colors.primary}22` }]}>
              <Text style={[styles.modalIntroTitle, { color: colors.text }]}>
                {modalTitle}
              </Text>
              <Text style={[styles.modalIntroText, { color: colors.textSecondary || `${colors.text}99` }]}>
                目标名称、周期和数值会直接影响列表展示，保存后会立即回到目标管理页。
              </Text>
            </View>
            {formStatus ? (
              <View
                style={[
                  styles.formStatusCard,
                  {
                    backgroundColor:
                      formStatus.type === 'success'
                        ? `${colors.success || '#22C55E'}14`
                        : formStatus.type === 'warning'
                          ? `${colors.warning || '#F59E0B'}16`
                          : formStatus.type === 'error'
                            ? `${colors.error || '#EF4444'}16`
                            : `${colors.primary}14`,
                    borderColor:
                      formStatus.type === 'success'
                        ? `${colors.success || '#22C55E'}36`
                        : formStatus.type === 'warning'
                          ? `${colors.warning || '#F59E0B'}36`
                          : formStatus.type === 'error'
                            ? `${colors.error || '#EF4444'}36`
                            : `${colors.primary}30`,
                  },
                ]}
              >
                <Icon
                  name={
                    formStatus.type === 'success'
                      ? 'check-circle'
                      : formStatus.type === 'warning'
                        ? 'error-outline'
                        : formStatus.type === 'error'
                          ? 'highlight-off'
                          : 'info-outline'
                  }
                  size={18}
                  color={
                    formStatus.type === 'success'
                      ? colors.success || '#22C55E'
                      : formStatus.type === 'warning'
                        ? colors.warning || '#F59E0B'
                        : formStatus.type === 'error'
                          ? colors.error || '#EF4444'
                          : colors.primary
                  }
                />
                <Text
                  style={[
                    styles.formStatusText,
                    {
                      color:
                        formStatus.type === 'success'
                          ? colors.success || '#22C55E'
                          : formStatus.type === 'warning'
                            ? colors.warning || '#F59E0B'
                            : formStatus.type === 'error'
                              ? colors.error || '#EF4444'
                              : colors.primary,
                    },
                  ]}
                >
                  {formStatus.message}
                </Text>
              </View>
            ) : null}
            <View style={styles.formSection}>
              <View style={styles.formGroup}>
                <Text variant="body" style={styles.formLabel}>标题 *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                  value={formData.title}
                  onChangeText={(text) => {
                    if (formStatus?.type === 'warning' || formStatus?.type === 'error') {
                      clearFormStatus();
                    }
                    setFormData({ ...formData, title: text });
                  }}
                  placeholder="输入目标标题"
                  placeholderTextColor={colors.text + '60'}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text variant="body" style={styles.formLabel}>类型</Text>
              <View style={styles.typeSelector}>
                {goalTypes.map(type => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeOption,
                      { backgroundColor: colors.card },
                      formData.type === type.key && { backgroundColor: colors.primary + '20' },
                    ]}
                    onPress={() => setFormData({ ...formData, type: type.key })}
                  >
                    <Icon
                      name={type.icon}
                      size={20}
                      color={formData.type === type.key ? colors.primary : colors.text}
                    />
                    <Text
                      style={[
                        styles.typeText,
                        { color: formData.type === type.key ? colors.primary : colors.text },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(formData.type === 'quantitative' || formData.type === 'habit') && (
              <View style={styles.formSection}>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 2 }]}>
                    <Text variant="body" style={styles.formLabel}>目标值</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                      value={formData.target_value}
                      onChangeText={(text) => setFormData({ ...formData, target_value: text })}
                      placeholder="输入目标数值"
                      placeholderTextColor={colors.text + '60'}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text variant="body" style={styles.formLabel}>单位</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                      value={formData.unit}
                      onChangeText={(text) => setFormData({ ...formData, unit: text })}
                      placeholder="单位"
                      placeholderTextColor={colors.text + '60'}
                    />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.formSection}>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text variant="body" style={styles.formLabel}>开始日期</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                    value={formData.start_date}
                    onChangeText={(text) => setFormData({ ...formData, start_date: text })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text + '60'}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text variant="body" style={styles.formLabel}>结束日期</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                    value={formData.end_date}
                    onChangeText={(text) => setFormData({ ...formData, end_date: text })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text + '60'}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <View style={[styles.formGroup, styles.formGroupCompact]}>
                <Text variant="body" style={styles.formLabel}>描述</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { backgroundColor: colors.card, color: colors.text }]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="输入目标描述"
                  placeholderTextColor={colors.text + '60'}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={progressDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={closeProgressDialog}
      >
        <View style={styles.dialogOverlay}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: `${colors.primary}16` }]}>
              <Icon name="track-changes" size={24} color={colors.primary} />
            </View>
            <Text variant="h3" style={[styles.confirmTitle, { color: colors.text }]}>
              更新目标进度
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary || `${colors.text}99` }]}>
              {progressGoal ? `正在更新“${progressGoal.title}”` : '正在更新当前目标'}
            </Text>

            <View style={styles.progressDialogBody}>
              {canTrackGoalValue(progressGoal) ? (
                <View style={styles.formGroup}>
                  <Text variant="body" style={[styles.formLabel, { color: colors.text }]}>当前值</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={progressValueInput}
                    onChangeText={setProgressValueInput}
                    placeholder="输入当前完成值"
                    placeholderTextColor={colors.text + '60'}
                    keyboardType="numeric"
                  />
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text variant="body" style={[styles.formLabel, { color: colors.text }]}>状态</Text>
                <View style={styles.quickStatusRow}>
                  {goalStatuses.map(statusOption => {
                    const active = progressStatusInput === statusOption.key;
                    return (
                      <TouchableOpacity
                        key={`progress_${statusOption.key}`}
                        style={[
                          styles.quickStatusChip,
                          {
                            backgroundColor: active ? `${getStatusColor(statusOption.key)}18` : `${colors.border}30`,
                            borderColor: active ? `${getStatusColor(statusOption.key)}45` : `${colors.border}70`,
                          },
                        ]}
                        activeOpacity={0.88}
                        onPress={() => setProgressStatusInput(statusOption.key)}
                      >
                        <Icon
                          name={statusOption.icon}
                          size={15}
                          color={active ? getStatusColor(statusOption.key) : colors.textSecondary || `${colors.text}99`}
                        />
                        <Text
                          style={[
                            styles.quickStatusText,
                            {
                              color: active ? getStatusColor(statusOption.key) : colors.textSecondary || `${colors.text}99`,
                            },
                          ]}
                        >
                          {statusOption.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmSecondaryButton, { borderColor: colors.border }]}
                onPress={closeProgressDialog}
                activeOpacity={0.88}
              >
                <Text style={[styles.confirmSecondaryText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmPrimaryButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveProgress}
                activeOpacity={0.88}
              >
                <Text style={styles.confirmPrimaryText}>保存进度</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmDialogVisible(false);
          setPendingDeleteGoal(null);
        }}
      >
        <View style={styles.dialogOverlay}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: `${colors.error || '#FF6B6B'}16` }]}>
              <Icon name="delete-outline" size={24} color={colors.error || '#FF6B6B'} />
            </View>
            <Text variant="h3" style={[styles.confirmTitle, { color: colors.text }]}>删除目标</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary || `${colors.text}99` }]}>
              {pendingDeleteGoal ? `确认删除“${pendingDeleteGoal.title}”吗？删除后将无法恢复。` : '确认删除当前目标吗？'}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmSecondaryButton, { borderColor: colors.border }]}
                onPress={() => {
                  setConfirmDialogVisible(false);
                  setPendingDeleteGoal(null);
                }}
                activeOpacity={0.88}
              >
                <Text style={[styles.confirmSecondaryText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmPrimaryButton, { backgroundColor: colors.error || '#FF6B6B' }]}
                onPress={handleConfirmDelete}
                activeOpacity={0.88}
              >
                <Text style={styles.confirmPrimaryText}>确认删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NetworkErrorAlert
        visible={networkErrorVisible}
        error={networkErrorState?.error}
        onRetry={networkErrorState?.onRetry}
        onDismiss={dismissNetworkError}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 24,
  },
  goalListSection: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  goalList: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  goalListFooter: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  goalListFooterTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  goalListFooterText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 420,
  },
  goalItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  goalTitle: {
    flex: 1,
    fontWeight: '600',
    fontSize: 16,
  },
  goalActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  goalDescription: {
    opacity: 0.7,
    marginBottom: 10,
  },
  goalProgress: {
    marginBottom: 6,
  },
  goalMetaRow: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressShortcutButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressShortcutText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBar: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  quickStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  quickStatusChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  goalTarget: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  goalDates: {
    fontSize: 12,
    opacity: 0.6,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalHeaderSide: {
    width: 88,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalHeaderActionWrap: {
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  modalSaveButton: {
    minWidth: 74,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  modalIntroCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  modalIntroTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalIntroText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  progressDialogBody: {
    marginTop: 14,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontWeight: '700',
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  confirmSecondaryButton: {
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  confirmPrimaryButton: {
    minWidth: 116,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formGroup: {
    marginBottom: 10,
  },
  formGroupCompact: {
    marginBottom: 0,
  },
  formSection: {
    marginBottom: 6,
  },
  formStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  formStatusText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    marginBottom: 4,
    fontWeight: '500',
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
  },
  textArea: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: '48%',
  },
  typeText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default GoalManagerScreen;
