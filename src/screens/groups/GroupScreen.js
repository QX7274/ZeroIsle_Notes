import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { groupService } from '../../services/group/groupService';

const GroupScreen = () => {
  const { theme } = useTheme();
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const loadedGroups = await groupService.getGroups();
      setGroups(loadedGroups);
    } catch (error) {
      Alert.alert('错误', '加载群组失败');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('错误', '请输入群组名称');
      return;
    }

    try {
      await groupService.createGroup(newGroupName, newGroupDescription);
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateModal(false);
      loadGroups();
    } catch (error) {
      Alert.alert('错误', '创建群组失败');
    }
  };

  const handleViewMembers = async (group) => {
    try {
      const groupMembers = await groupService.getMembers(group.id);
      setMembers(groupMembers);
      setSelectedGroup(group);
      setShowMembersModal(true);
    } catch (error) {
      Alert.alert('错误', '获取成员列表失败');
    }
  };

  const handleDeleteGroup = async (groupId) => {
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
              loadGroups();
            } catch (error) {
              Alert.alert('错误', '删除群组失败');
            }
          },
        },
      ]
    );
  };

  const renderGroupItem = ({ item }) => (
    <View style={[styles.groupItem, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.groupInfo}>
        <Text style={[styles.groupName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.groupDescription, { color: theme.textSecondary }]}>
          {item.description}
        </Text>
      </View>
      <View style={styles.groupActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => handleViewMembers(item)}
        >
          <Icon name="people" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.error }]}
          onPress={() => handleDeleteGroup(item.id)}
        >
          <Icon name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: theme.primary }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>创建群组</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="群组名称"
              placeholderTextColor={theme.textSecondary}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="群组描述"
              placeholderTextColor={theme.textSecondary}
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.modalButtonText}>创建</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.error }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedGroup?.name} 的成员
            </Text>
            <FlatList
              data={members}
              renderItem={({ item }) => (
                <View style={[styles.memberItem, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {item.userId}
                  </Text>
                  <Text style={[styles.memberRole, { color: theme.textSecondary }]}>
                    {item.role}
                  </Text>
                </View>
              )}
              keyExtractor={item => item.userId}
            />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowMembersModal(false)}
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
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
  },
  groupActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 16,
    borderRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: 16,
  },
  memberRole: {
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default GroupScreen;