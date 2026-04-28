/**
 * 知识库设置标签页
 * @description 管理知识库的名称、描述、成员和权限等设置。
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { deleteKnowledgeBase, updateKnowledgeBase } from '../../redux/slices/knowledgeBaseSlice';
import { Card, Button, EmptyState } from '../../components/common';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';

const ROLE_LABELS = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

const SettingsTab = ({ kbId }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { currentKnowledgeBase } = useSelector((state) => state.knowledgeBase);
  const members = currentKnowledgeBase?.members || [];

  const [kbName, setKbName] = useState('');
  const [kbDescription, setKbDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  useEffect(() => {
    if (currentKnowledgeBase) {
      setKbName(currentKnowledgeBase.name);
      setKbDescription(currentKnowledgeBase.description || '');
      setIsPublic(currentKnowledgeBase.is_public || false);
    }
  }, [currentKnowledgeBase]);

  const handleSave = async () => {
    try {
      const kbData = {
        name: kbName.trim(),
        description: kbDescription.trim(),
        is_public: isPublic,
      };
      await dispatch(updateKnowledgeBase({ id: kbId, kbData })).unwrap();
      setShowEditModal(false);
      notifyNonBlocking('知识库信息已更新');
    } catch (error) {
      notifyNonBlocking(error?.message || '更新失败，请重试');
    }
  };

  const handleDeleteKB = async () => {
    try {
      await dispatch(deleteKnowledgeBase(kbId)).unwrap();
      notifyNonBlocking('知识库已删除');
      navigation.goBack();
    } catch (error) {
      notifyNonBlocking(error?.message || '删除失败，请重试');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      {/* 基本信息卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <TouchableOpacity style={styles.settingItem} onPress={() => setShowEditModal(true)}>
          <Icon name="edit" size={24} color={theme.colors.primary} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={styles.itemLabel}>名称</Text>
            <Text style={styles.itemValue}>{kbName}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem} onPress={() => setShowEditModal(true)}>
          <Icon name="description" size={24} color={theme.colors.primary} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={styles.itemLabel}>描述</Text>
            <Text style={styles.itemValue} numberOfLines={1}>{kbDescription}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      {/* 权限设置卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>权限设置</Text>
        <View style={styles.settingItem}>
          <Icon name="public" size={24} color={theme.colors.primary} style={styles.itemIcon} />
          <View style={styles.itemContent}>
            <Text style={styles.itemLabel}>公开知识库</Text>
            <Text style={styles.itemDescription}>允许其他用户查看此知识库</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </Card>

      {/* 成员管理卡片 */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>成员管理</Text>
          <TouchableOpacity>
            <Icon name="person-add" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        {members.length === 0 ? (
          <EmptyState message="还没有成员" icon="group-add" />
        ) : (
          members.map(member => (
            <View key={member.id} style={styles.memberItem}>
              <View style={styles.memberAvatar}>
                <Icon name="person" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{ROLE_LABELS[member.role]}</Text>
              </View>
              {member.role !== 'owner' && (
                <TouchableOpacity>
                  <Icon name="more-vert" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </Card>

      {/* 危险操作卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>危险操作</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={() => setShowDeleteConfirm(true)}>
          <Icon name="delete" size={24} color="#E74C3C" style={styles.itemIcon} />
          <Text style={styles.dangerText}>删除知识库</Text>
        </TouchableOpacity>
      </Card>

      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.modalTitle}>删除知识库</Text>
            <Text style={styles.confirmMessage}>确定要删除这个知识库吗？此操作无法撤销。</Text>
            <View style={styles.modalButtons}>
              <Button
                title="取消"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="删除"
                onPress={async () => {
                  setShowDeleteConfirm(false);
                  await handleDeleteKB();
                }}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 编辑模态框 */}
      <Modal visible={showEditModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑知识库信息</Text>
            <TextInput
              style={styles.input}
              value={kbName}
              onChangeText={setKbName}
              placeholder="知识库名称"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={kbDescription}
              onChangeText={setKbDescription}
              placeholder="知识库描述"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <Button title="取消" onPress={() => setShowEditModal(false)} variant="outline" style={styles.modalButton} />
              <Button title="保存" onPress={handleSave} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: SPACING.medium,
  },
  hintText: {
    marginHorizontal: 16,
    marginTop: 8,
    color: theme.colors.warning || '#ff9800',
    fontSize: 13,
  },
  card: {
    marginBottom: SPACING.medium,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.large,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.medium,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemIcon: {
    marginRight: SPACING.medium,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  itemValue: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    marginTop: SPACING.extraSmall,
  },
  itemDescription: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    marginTop: SPACING.extraSmall,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.medium,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  memberRole: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    marginTop: SPACING.extraSmall,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.small,
  },
  dangerText: {
    fontSize: FONT_SIZES.medium,
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.large,
    width: '85%',
  },
  confirmModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.large,
    width: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmMessage: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: SPACING.medium,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xlarge,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.medium,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.medium,
    fontSize: FONT_SIZES.medium,
    color: theme.colors.text,
    marginBottom: SPACING.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: SPACING.small,
  },
});

export default SettingsTab;

