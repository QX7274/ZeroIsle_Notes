import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { groupService } from '../../services/group/groupService';
import networkErrorService from '../../services/networkErrorService';

const GroupScreen = () => {
  const { theme } = useTheme();
  const colors = theme.colors || theme;
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [inlineHint, setInlineHint] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const notifyNonBlocking = useCallback((message) => {
    if (!message) {return;}
    setInlineHint(String(message));
  }, []);

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    try {
      const loadedGroups = await groupService.getGroups();
      setGroups(loadedGroups || []);
      setInlineHint('');
    } catch (error) {
      setGroups([]);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '加载群组',
          customMessage: '网络连接失败，已显示离线空列表',
        });
        setInlineHint('加载群组失败，已显示离线空列表');
      } else {
        notifyNonBlocking('加载群组失败，已显示离线空列表');
      }
    } finally {
      setIsLoadingGroups(false);
    }
  }, [notifyNonBlocking]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      notifyNonBlocking('请输入群组名称');
      return;
    }
    setIsCreatingGroup(true);
    try {
      await groupService.createGroup(newGroupName, newGroupDescription);
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateModal(false);
      await loadGroups();
    } catch (error) {
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '创建群组',
          customMessage: '网络连接失败，请稍后重试',
        });
      } else {
        notifyNonBlocking('创建群组失败，请稍后重试');
      }
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleViewMembers = useCallback(async (group) => {
    setIsLoadingMembers(true);
    try {
      const groupMembers = await groupService.getMembers(group.id);
      setMembers(groupMembers || []);
      setSelectedGroup(group);
      setShowMembersModal(true);
      setInlineHint('');
    } catch (error) {
      setMembers([]);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '获取成员',
          customMessage: '网络连接失败，已显示离线空列表',
        });
        setInlineHint('获取成员失败，已显示离线空列表');
      } else {
        notifyNonBlocking('获取成员失败，已显示离线空列表');
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }, [notifyNonBlocking]);

  const handleDeleteGroup = useCallback(async (groupId) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个群组吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.deleteGroup(groupId);
              await loadGroups();
            } catch (error) {
              if (networkErrorService.isNetworkError(error)) {
                networkErrorService.handleApiError(error, {
                  context: '删除群组',
                  customMessage: '网络连接失败，请稍后重试',
                });
              } else {
                notifyNonBlocking('删除群组失败，请稍后重试');
              }
            }
          },
        },
      ]
    );
  }, [loadGroups, notifyNonBlocking]);

  const renderGroupItem = useCallback(({ item }) => (
    <View style={[styles.groupItem, { backgroundColor: 'rgba(255,255,255,0.90)' }]} testID={`entry.group.screen.item.${item.id}`}>
      <View style={styles.groupInfo}>
        <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.groupDescription, { color: colors.textSecondary }]}>{item.description || '暂无描述'}</Text>
      </View>
      <View style={styles.groupActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => handleViewMembers(item)}
          testID={`action.group.screen.viewMembers.${item.id}`}
        >
          <Icon name="people" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error || '#E53935' }]}
          onPress={() => handleDeleteGroup(item.id)}
          testID={`action.group.screen.delete.${item.id}`}
        >
          <Icon name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  ), [colors, handleViewMembers, handleDeleteGroup]);

  const renderMemberItem = useCallback(({ item }) => (
    <View style={[styles.memberItem, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
      <Text style={[styles.memberName, { color: colors.text }]}>{item.userId || 'unknown'}</Text>
      <Text style={[styles.memberRole, { color: colors.textSecondary }]}>{item.role || 'member'}</Text>
    </View>
  ), [colors]);

  const hasGroups = groups.length > 0;
  const busyVisible = isLoadingGroups || isCreatingGroup || isLoadingMembers;
  const pageState = busyVisible ? 'busy' : (hasGroups ? 'ready' : 'empty');

  return (
    <View style={[styles.container, { backgroundColor: '#F6FAFF' }]} testID={`state.group.screen.state.${pageState}`}>
      <View testID="state.group.screen.visibility.visible" />
      <View testID={`state.group.screen.busy.visibility.${busyVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.screen.createModal.visibility.${showCreateModal ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.screen.membersModal.visibility.${showMembersModal ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.screen.inlineHint.visibility.${inlineHint ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.screen.list.${hasGroups ? 'hasData' : 'empty'}`} />

      {!!inlineHint ? (
        <View style={[styles.hintBanner, { backgroundColor: '#EAF2FF' }]}>
          <Text style={[styles.hintText, { color: colors.text }]}>{inlineHint}</Text>
        </View>
      ) : null}

      <View style={styles.toolbar} testID="panel.group.screen.toolbar">
        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: '#BFD7FF' }]}
          onPress={loadGroups}
          disabled={isLoadingGroups}
          testID="action.group.screen.refresh"
        >
          {isLoadingGroups ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Icon name="refresh" size={16} color={colors.primary} />
              <Text style={[styles.refreshText, { color: colors.primary }]}>刷新</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews
        maxToRenderPerBatch={5}
        ListEmptyComponent={!busyVisible ? (
          <View style={styles.emptyWrap} testID="state.group.screen.empty">
            <Icon name="albums-outline" size={32} color="#93A7C2" />
            <Text style={styles.emptyText}>暂无群组，点击右下角创建</Text>
          </View>
        ) : null}
        testID="list.group.screen.groups"
      />

      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreateModal(true)}
        testID="action.group.screen.openCreateModal"
      >
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>创建群组</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: '#CFE1FF' }]}
              placeholder="群组名称"
              placeholderTextColor={colors.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
              testID="input.group.screen.groupName"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: '#CFE1FF' }]}
              placeholder="群组描述"
              placeholderTextColor={colors.textSecondary}
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
              testID="input.group.screen.groupDescription"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup}
                testID="action.group.screen.confirmCreate"
              >
                <Text style={styles.modalButtonText}>{isCreatingGroup ? '创建中...' : '创建'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.error || '#E53935' }]}
                onPress={() => setShowCreateModal(false)}
                disabled={isCreatingGroup}
                testID="action.group.screen.cancelCreate"
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMembersModal} transparent animationType="slide" onRequestClose={() => setShowMembersModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]} testID="state.group.screen.membersTitle">
              {selectedGroup?.name} 的成员
            </Text>
            <FlatList
              data={members}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.userId}
              ListEmptyComponent={!isLoadingMembers ? (
                <View style={styles.emptyMemberWrap}>
                  <Text style={styles.emptyMemberText}>暂无成员数据</Text>
                </View>
              ) : null}
              testID="list.group.screen.members"
            />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowMembersModal(false)}
              testID="action.group.screen.closeMembersModal"
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 88 },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    gap: 4,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  groupDescription: { fontSize: 14 },
  groupActions: { flexDirection: 'row' },
  actionButton: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  createButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
  },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(8, 24, 48, 0.38)',
  },
  modalContent: {
    width: '82%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 5,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 4,
  },
  modalButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  memberItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#DCE9FF',
  },
  memberName: { fontSize: 16 },
  memberRole: { fontSize: 14 },
  closeButton: {
    padding: 10, borderRadius: 10, alignItems: 'center', marginTop: 14,
  },
  closeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hintBanner: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  hintText: { fontSize: 13, lineHeight: 18 },
  emptyWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    marginTop: 8,
    color: '#74879E',
    fontSize: 14,
  },
  emptyMemberWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyMemberText: {
    color: '#7B8EA7',
    fontSize: 13,
  },
});

export default GroupScreen;
