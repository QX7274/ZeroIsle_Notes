import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from './analytics';
import { apiService } from './api';

class GroupService {
  constructor() {
    this.groupsKey = '@groups';
    this.membersKey = '@group_members';
    this.groups = [];
    this.pendingOperations = [];
  }

  async createGroup(name, description) {
    try {
      const response = await apiService.post('/groups', {
        name,
        description,
      });
      
      analyticsService.trackGroupAction('create_group', {
        groupName: name,
        descriptionLength: description.length,
      });
      
      return response.data.group;
    } catch (error) {
      console.error('创建群组错误:', error);
      analyticsService.trackError(error, { action: 'create_group' });
      throw error;
    }
  }

  async joinGroup(groupId) {
    try {
      const response = await apiService.post(`/groups/${groupId}/join`);
      
      analyticsService.trackGroupAction('join_group', {
        groupId,
      });
      
      return response.data.group;
    } catch (error) {
      console.error('加入群组错误:', error);
      analyticsService.trackError(error, { action: 'join_group' });
      throw error;
    }
  }

  async shareNote(groupId, noteId) {
    try {
      const response = await apiService.post(`/groups/${groupId}/notes`, {
        noteId,
      });
      
      analyticsService.trackGroupAction('share_note', {
        groupId,
        noteId,
      });
      
      return response.data.sharedNote;
    } catch (error) {
      console.error('分享笔记错误:', error);
      analyticsService.trackError(error, { action: 'share_note' });
      throw error;
    }
  }

  async getGroupNotes(groupId) {
    try {
      const response = await apiService.get(`/groups/${groupId}/notes`);
      
      analyticsService.trackGroupAction('get_group_notes', {
        groupId,
        noteCount: response.data.notes.length,
      });
      
      return response.data.notes;
    } catch (error) {
      console.error('获取群组笔记错误:', error);
      analyticsService.trackError(error, { action: 'get_group_notes' });
      throw error;
    }
  }

  async compareNotes(noteId1, noteId2) {
    try {
      const response = await apiService.post('/notes/compare', {
        noteId1,
        noteId2,
      });
      
      analyticsService.trackGroupAction('compare_notes', {
        noteId1,
        noteId2,
        differenceCount: response.data.differences.length,
      });
      
      return response.data;
    } catch (error) {
      console.error('比较笔记错误:', error);
      analyticsService.trackError(error, { action: 'compare_notes' });
      throw error;
    }
  }

  async suggestCorrections(noteId, corrections) {
    try {
      const response = await apiService.post(`/notes/${noteId}/corrections`, {
        corrections,
      });
      
      analyticsService.trackGroupAction('suggest_corrections', {
        noteId,
        correctionCount: corrections.length,
      });
      
      return response.data;
    } catch (error) {
      console.error('建议修改错误:', error);
      analyticsService.trackError(error, { action: 'suggest_corrections' });
      throw error;
    }
  }

  async getGroups() {
    try {
      const response = await apiService.get('/groups');
      
      analyticsService.trackGroupAction('get_groups', {
        groupCount: response.data.groups.length,
      });
      
      return response.data.groups;
    } catch (error) {
      console.error('获取群组列表错误:', error);
      analyticsService.trackError(error, { action: 'get_groups' });
      throw error;
    }
  }

  async leaveGroup(groupId) {
    try {
      await apiService.post(`/groups/${groupId}/leave`);
      
      analyticsService.trackGroupAction('leave_group', {
        groupId,
      });
    } catch (error) {
      console.error('退出群组错误:', error);
      analyticsService.trackError(error, { action: 'leave_group' });
      throw error;
    }
  }

  async addMember(groupId, userId, role = 'member') {
    try {
      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('群组不存在');

      const members = await this.getMembers(groupId);
      if (members.some(m => m.userId === userId)) {
        throw new Error('用户已在群组中');
      }

      members.push({ userId, role, joinedAt: new Date().toISOString() });
      await AsyncStorage.setItem(
        `${this.membersKey}_${groupId}`,
        JSON.stringify(members)
      );

      analyticsService.trackGroupAction('add_member', { groupId, userId });
    } catch (error) {
      console.error('添加成员失败:', error);
      analyticsService.trackError(error, { action: 'add_member' });
      throw error;
    }
  }

  async getMembers(groupId) {
    try {
      const membersJson = await AsyncStorage.getItem(`${this.membersKey}_${groupId}`);
      return membersJson ? JSON.parse(membersJson) : [];
    } catch (error) {
      console.error('获取成员失败:', error);
      throw error;
    }
  }

  async getSharedNotes(userId) {
    try {
      const memberSharesKey = `@member_shares_${userId}`;
      const shares = JSON.parse(await AsyncStorage.getItem(memberSharesKey) || '[]');
      return shares;
    } catch (error) {
      console.error('获取分享笔记失败:', error);
      throw error;
    }
  }

  async removeMember(groupId, userId) {
    try {
      const members = await this.getMembers(groupId);
      const updatedMembers = members.filter(m => m.userId !== userId);
      await AsyncStorage.setItem(
        `${this.membersKey}_${groupId}`,
        JSON.stringify(updatedMembers)
      );

      analyticsService.trackGroupAction('remove_member', { groupId, userId });
    } catch (error) {
      console.error('移除成员失败:', error);
      analyticsService.trackError(error, { action: 'remove_member' });
      throw error;
    }
  }

  async deleteGroup(groupId) {
    try {
      const groups = await this.getGroups();
      const updatedGroups = groups.filter(g => g.id !== groupId);
      await AsyncStorage.setItem(this.groupsKey, JSON.stringify(updatedGroups));
      await AsyncStorage.removeItem(`${this.membersKey}_${groupId}`);

      analyticsService.trackGroupAction('delete', { groupId });
    } catch (error) {
      console.error('删除群组失败:', error);
      analyticsService.trackError(error, { action: 'delete_group' });
      throw error;
    }
  }
}

export const groupService = new GroupService(); 