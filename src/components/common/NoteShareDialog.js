/**
 * 笔记分享对话框组件
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Button, Toast } from './';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Clipboard from '@react-native-clipboard/clipboard';
import * as noteShareApi from '../../services/api/noteShareApi';
import { useTheme } from '@react-navigation/native';
import { dimensions } from '../../utils/constants/dimensions';

const NoteShareDialog = ({ visible, onClose, noteId, noteTitle }) => {
  // 创建一个引用，用于存储Modal的dismiss方法
  const modalRef = useRef(null);

  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const styles = getStyles(colors);

  // 分享设置状态
  const [accessType, setAccessType] = useState('link');
  const [password, setPassword] = useState('');
  const [isEditable, setIsEditable] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');

  // 分享结果状态
  const [shareResult, setShareResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [existingShares, setExistingShares] = useState([]);
  const [showExistingShares, setShowExistingShares] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 加载笔记的现有分享
  useEffect(() => {
    if (visible && noteId) {
      loadExistingShares();
    }
  }, [visible, noteId]);

  // 加载现有分享
  const loadExistingShares = async () => {
    try {
      setIsLoading(true);
      const response = await noteShareApi.getNoteShares(noteId);
      setExistingShares(response.data);
    } catch (error) {
      console.error('加载分享失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 显示Toast消息
  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // 创建分享
  const handleCreateShare = async () => {
    if (!noteId) {
      Alert.alert('错误', '请先保存笔记');
      return;
    }

    try {
      setIsLoading(true);

      // 准备分享数据
      const shareData = {
        note_id: noteId,
        access_type: accessType,
        is_editable: isEditable,
      };

      // 根据访问类型添加额外数据
      if (accessType === 'password') {
        if (!password) {
          Alert.alert('错误', '请设置访问密码');
          setIsLoading(false);
          return;
        }
        shareData.password = password;
      } else if (accessType === 'specific_users') {
        if (!allowedEmails) {
          Alert.alert('错误', '请输入允许访问的用户邮箱');
          setIsLoading(false);
          return;
        }
        // 分割邮箱地址并去除空白
        const emails = allowedEmails.split(',').map(email => email.trim()).filter(email => email);
        if (emails.length === 0) {
          Alert.alert('错误', '请输入有效的邮箱地址');
          setIsLoading(false);
          return;
        }
        shareData.allowed_users_emails = emails;
      }

      // 添加过期时间
      if (expiresAt) {
        shareData.expires_at = expiresAt.toISOString();
      }

      // 创建分享
      const response = await noteShareApi.createNoteShare(shareData);
      setShareResult(response.data);
      showToast('分享创建成功');

      // 重新加载分享列表
      loadExistingShares();
    } catch (error) {
      console.error('创建分享失败:', error);
      Alert.alert('创建分享失败', error.response?.data?.error || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 复制分享链接
  const copyShareLink = (shareUrl) => {
    const baseUrl = 'https://zeroislenotes.com';
    const fullUrl = `${baseUrl}${shareUrl}`;
    Clipboard.setString(fullUrl);
    showToast('链接已复制到剪贴板');
  };

  // 删除分享
  const handleDeleteShare = async (shareId) => {
    Alert.alert(
      '删除分享',
      '确定要删除这个分享吗？删除后无法恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await noteShareApi.deleteNoteShare(shareId);
              showToast('分享已删除');
              loadExistingShares();
            } catch (error) {
              console.error('删除分享失败:', error);
              Alert.alert('删除失败', '请稍后重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 重置分享链接
  const handleResetShareLink = async (shareId) => {
    Alert.alert(
      '重置链接',
      '确定要重置分享链接吗？旧链接将失效。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await noteShareApi.resetShareLink(shareId);
              showToast('分享链接已重置');

              // 更新分享列表中的对应项
              const updatedShares = existingShares.map(share =>
                share.id === shareId ? response.data : share
              );
              setExistingShares(updatedShares);
            } catch (error) {
              console.error('重置链接失败:', error);
              Alert.alert('重置失败', '请稍后重试');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 渲染访问类型选择器
  const renderAccessTypeSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>访问方式</Text>
      <View style={styles.accessTypeContainer}>
        <TouchableOpacity
          style={[styles.accessTypeButton, accessType === 'public' && styles.accessTypeButtonActive]}
          onPress={() => setAccessType('public')}
        >
          <Icon name="public" size={24} color={accessType === 'public' ? colors.primary : colors.text} />
          <Text style={styles.accessTypeText}>公开访问</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.accessTypeButton, accessType === 'link' && styles.accessTypeButtonActive]}
          onPress={() => setAccessType('link')}
        >
          <Icon name="link" size={24} color={accessType === 'link' ? colors.primary : colors.text} />
          <Text style={styles.accessTypeText}>链接访问</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.accessTypeButton, accessType === 'password' && styles.accessTypeButtonActive]}
          onPress={() => setAccessType('password')}
        >
          <Icon name="lock" size={24} color={accessType === 'password' ? colors.primary : colors.text} />
          <Text style={styles.accessTypeText}>密码访问</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.accessTypeButton, accessType === 'specific_users' && styles.accessTypeButtonActive]}
          onPress={() => setAccessType('specific_users')}
        >
          <Icon name="people" size={24} color={accessType === 'specific_users' ? colors.primary : colors.text} />
          <Text style={styles.accessTypeText}>指定用户</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染密码输入框
  const renderPasswordInput = () => {
    if (accessType !== 'password') {return null;}

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>访问密码</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="设置访问密码"
          secureTextEntry
        />
      </View>
    );
  };

  // 渲染指定用户输入框
  const renderAllowedUsersInput = () => {
    if (accessType !== 'specific_users') {return null;}

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>允许访问的用户</Text>
        <TextInput
          style={styles.input}
          value={allowedEmails}
          onChangeText={setAllowedEmails}
          placeholder="输入邮箱地址，多个用逗号分隔"
          multiline
        />
        <Text style={styles.helperText}>多个邮箱请用逗号分隔</Text>
      </View>
    );
  };

  // 渲染过期时间设置
  const renderExpirationSetting = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>过期时间</Text>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.datePickerText}>
          {expiresAt ? expiresAt.toLocaleString() : '永不过期'}
        </Text>
        <Icon name="event" size={24} color={colors.text} />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
          mode="datetime"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setExpiresAt(selectedDate);
            }
          }}
        />
      )}

      {expiresAt && (
        <TouchableOpacity
          style={styles.clearDateButton}
          onPress={() => setExpiresAt(null)}
        >
          <Text style={styles.clearDateText}>清除过期时间</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // 渲染编辑权限设置
  const renderEditPermissionSetting = () => (
    <View style={styles.section}>
      <View style={styles.switchContainer}>
        <Text style={styles.sectionTitle}>允许编辑</Text>
        <Switch
          value={isEditable}
          onValueChange={setIsEditable}
          trackColor={{ false: colors.lightGray, true: colors.primaryLight }}
          thumbColor={isEditable ? colors.primary : colors.gray}
        />
      </View>
      <Text style={styles.helperText}>
        启用后，被分享的用户可以编辑笔记内容
      </Text>
    </View>
  );

  // 渲染分享结果
  const renderShareResult = () => {
    if (!shareResult) {return null;}

    return (
      <View style={styles.shareResultContainer}>
        <Text style={styles.shareResultTitle}>分享成功</Text>
        <View style={styles.shareUrlContainer}>
          <Text style={styles.shareUrl} numberOfLines={1} ellipsizeMode="middle">
            https://zeroislenotes.com{shareResult.share_url}
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyShareLink(shareResult.share_url)}
          >
            <Icon name="content-copy" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.shareInfoContainer}>
          <Text style={styles.shareInfoLabel}>访问方式:</Text>
          <Text style={styles.shareInfoValue}>
            {{
              'public': '公开访问',
              'link': '链接访问',
              'password': '密码访问',
              'specific_users': '指定用户',
            }[shareResult.access_type]}
          </Text>
        </View>

        {shareResult.access_type === 'password' && (
          <View style={styles.shareInfoContainer}>
            <Text style={styles.shareInfoLabel}>访问密码:</Text>
            <Text style={styles.shareInfoValue}>{password}</Text>
          </View>
        )}

        {shareResult.expires_at && (
          <View style={styles.shareInfoContainer}>
            <Text style={styles.shareInfoLabel}>过期时间:</Text>
            <Text style={styles.shareInfoValue}>
              {new Date(shareResult.expires_at).toLocaleString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // 渲染现有分享列表
  const renderExistingShares = () => {
    if (existingShares.length === 0) {
      return (
        <View style={styles.emptySharesContainer}>
          <Icon name="share" size={48} color={colors.lightGray} />
          <Text style={styles.emptySharesText}>暂无分享记录</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.existingSharesContainer}>
        {existingShares.map(share => (
          <View key={share.id} style={styles.shareItem}>
            <View style={styles.shareItemHeader}>
              <View style={styles.shareTypeContainer}>
                <Icon
                  name={{
                    'public': 'public',
                    'link': 'link',
                    'password': 'lock',
                    'specific_users': 'people',
                  }[share.access_type]}
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.shareTypeText}>
                  {{
                    'public': '公开访问',
                    'link': '链接访问',
                    'password': '密码访问',
                    'specific_users': '指定用户',
                  }[share.access_type]}
                </Text>
              </View>
              <Text style={styles.shareDate}>
                {new Date(share.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.shareUrlContainer}>
              <Text style={styles.shareUrl} numberOfLines={1} ellipsizeMode="middle">
                https://zeroislenotes.com{share.share_url}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyShareLink(share.share_url)}
              >
                <Icon name="content-copy" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.shareItemFooter}>
              <View style={styles.shareStats}>
                <Icon name="visibility" size={16} color={colors.text} />
                <Text style={styles.shareStatsText}>{share.view_count} 次查看</Text>
                {share.is_editable && (
                  <View style={styles.editableTag}>
                    <Text style={styles.editableTagText}>可编辑</Text>
                  </View>
                )}
                {share.is_expired && (
                  <View style={[styles.editableTag, styles.expiredTag]}>
                    <Text style={styles.editableTagText}>已过期</Text>
                  </View>
                )}
              </View>

              <View style={styles.shareActions}>
                <TouchableOpacity
                  style={styles.shareAction}
                  onPress={() => handleResetShareLink(share.id)}
                >
                  <Icon name="refresh" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareAction}
                  onPress={() => handleDeleteShare(share.id)}
                >
                  <Icon name="delete" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // 安全关闭对话框
  const safeClose = () => {
    try {
      if (modalRef.current && modalRef.current.dismiss) {
        modalRef.current.dismiss();
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('关闭对话框时出错:', error);
      // 如果dismiss方法失败，仍然尝试调用onClose
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <Modal
      ref={modalRef}
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={safeClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {showExistingShares ? '分享管理' : '分享笔记'}
            </Text>
            <TouchableOpacity onPress={safeClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.noteInfoContainer}>
            <Icon name="description" size={20} color={colors.primary} />
            <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">
              {noteTitle || '未命名笔记'}
            </Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, !showExistingShares && styles.activeTab]}
              onPress={() => setShowExistingShares(false)}
            >
              <Text style={[styles.tabText, !showExistingShares && styles.activeTabText]}>创建分享</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, showExistingShares && styles.activeTab]}
              onPress={() => setShowExistingShares(true)}
            >
              <Text style={[styles.tabText, showExistingShares && styles.activeTabText]}>分享管理</Text>
              {existingShares.length > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{existingShares.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {!isLoading && !showExistingShares && (
            <ScrollView style={styles.modalContent}>
              {renderAccessTypeSelector()}
              {renderPasswordInput()}
              {renderAllowedUsersInput()}
              {renderExpirationSetting()}
              {renderEditPermissionSetting()}
              {renderShareResult()}

              <Button
                title="创建分享"
                onPress={handleCreateShare}
                style={styles.createButton}
              />
            </ScrollView>
          )}

          {!isLoading && showExistingShares && renderExistingShares()}

          <Toast visible={toastVisible} message={toastMessage} />
        </View>
      </View>
    </Modal>
  );
};

// 创建一个函数来获取样式，这样我们可以在组件内部使用它
const getStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 5,
  },
  noteInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: colors.cardBackground,
  },
  noteTitle: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 10,
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.text,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 5,
  },
  modalContent: {
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  accessTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  accessTypeButton: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  accessTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  accessTypeText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 5,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  datePickerText: {
    fontSize: 14,
    color: colors.text,
  },
  clearDateButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 14,
    color: colors.primary,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  shareResultContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 15,
    marginVertical: 15,
  },
  shareResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 10,
  },
  shareUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  shareUrl: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    padding: 5,
    marginLeft: 10,
  },
  shareInfoContainer: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  shareInfoLabel: {
    fontSize: 14,
    color: colors.textLight,
    width: 80,
  },
  shareInfoValue: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingSharesContainer: {
    padding: 15,
  },
  emptySharesContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySharesText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textLight,
  },
  shareItem: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  shareItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shareTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareTypeText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  shareDate: {
    fontSize: 12,
    color: colors.textLight,
  },
  shareItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  shareStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareStatsText: {
    fontSize: 12,
    color: colors.textLight,
    marginLeft: 5,
    marginRight: 10,
  },
  editableTag: {
    backgroundColor: colors.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  expiredTag: {
    backgroundColor: colors.danger,
  },
  editableTagText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  shareActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareAction: {
    marginLeft: 10,
    padding: 5,
  },
});

export default NoteShareDialog;
