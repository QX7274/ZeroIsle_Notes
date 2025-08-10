import { realmService } from '../database/realmService';
import { analyticsService } from '../analytics/analyticsService';
import { apiService } from './api';
import { authService } from '../auth/authService';

class GroupService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.groups = [];
    this.pendingOperations = [];
  }

  /**
   * 初始化群组服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        // 注册群组相关模型
        this.registerSchemas();

        this.initialized = true;
        console.info('群组服务初始化成功');
        resolve();
      } catch (error) {
        console.error('群组服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 注册群组相关模型
   */
  registerSchemas() {
    // 群组模型
    realmService.registerSchema({
      name: 'Group',
      primaryKey: '_id',
      properties: {
        _id: 'string',
        name: 'string',
        description: 'string?',
        created_at: 'date',
        updated_at: 'date',
        is_deleted: { type: 'bool', default: false },
        is_synced: { type: 'bool', default: false },
        deleted_at: 'date?',
        user_id: 'string?',
      }
    });

    // 群组成员模型
    realmService.registerSchema({
      name: 'GroupMember',
      primaryKey: '_id',
      properties: {
        _id: 'string',
        group_id: 'string',
        user_id: 'string',
        role: 'string',
        joined_at: 'date',
        is_deleted: { type: 'bool', default: false },
        is_synced: { type: 'bool', default: false },
      }
    });

    // 分享笔记模型
    realmService.registerSchema({
      name: 'SharedNote',
      primaryKey: '_id',
      properties: {
        _id: 'string',
        note_id: 'string',
        group_id: 'string',
        user_id: 'string',
        shared_at: 'date',
        is_deleted: { type: 'bool', default: false },
        is_synced: { type: 'bool', default: false },
      }
    });
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
      
      // 特殊处理401错误
      if (error.response && error.response.status === 401) {
        // 触发令牌刷新或跳转登录
        authService.handleUnauthorized();
        return []; // 返回空数组避免UI报错
      }
      
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
      await this.initialize();

      const groups = await this.getGroups();
      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('群组不存在');

      const members = await this.getMembers(groupId);
      if (members.some(m => m.userId === userId)) {
        throw new Error('用户已在群组中');
      }

      // 生成唯一ID
      const memberId = `${groupId}_${userId}_${Date.now()}`;

      // 使用Realm创建群组成员
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('GroupMember', {
          _id: memberId,
          group_id: groupId,
          user_id: userId,
          role: role,
          joined_at: new Date(),
          is_deleted: false,
          is_synced: false,
        });
      });

      analyticsService.trackGroupAction('add_member', { groupId, userId });
    } catch (error) {
      console.error('添加成员失败:', error);
      analyticsService.trackError(error, { action: 'add_member' });
      throw error;
    }
  }

  async getMembers(groupId) {
    try {
      await this.initialize();

      // 使用Realm查询群组成员
      const realm = await realmService.getRealm();
      const members = realm.objects('GroupMember')
        .filtered('group_id == $0 AND is_deleted == false', groupId);

      // 转换为普通对象数组
      return Array.from(members).map(member => ({
        userId: member.user_id,
        role: member.role,
        joinedAt: member.joined_at.toISOString(),
      }));
    } catch (error) {
      console.error('获取成员失败:', error);
      throw error;
    }
  }

  async getSharedNotes(userId) {
    try {
      await this.initialize();

      // 使用Realm查询分享笔记
      const realm = await realmService.getRealm();
      const sharedNotes = realm.objects('SharedNote')
        .filtered('user_id == $0 AND is_deleted == false', userId);

      // 转换为普通对象数组
      return Array.from(sharedNotes).map(note => ({
        id: note._id,
        noteId: note.note_id,
        groupId: note.group_id,
        sharedAt: note.shared_at.toISOString(),
      }));
    } catch (error) {
      console.error('获取分享笔记失败:', error);
      throw error;
    }
  }

  async removeMember(groupId, userId) {
    try {
      await this.initialize();

      // 使用Realm查询群组成员
      const realm = await realmService.getRealm();
      const members = realm.objects('GroupMember')
        .filtered('group_id == $0 AND user_id == $1 AND is_deleted == false', groupId, userId);

      if (members.length === 0) {
        throw new Error('成员不存在');
      }

      // 软删除成员
      realm.write(() => {
        for (const member of members) {
          member.is_deleted = true;
          member.is_synced = false;
        }
      });

      analyticsService.trackGroupAction('remove_member', { groupId, userId });
    } catch (error) {
      console.error('移除成员失败:', error);
      analyticsService.trackError(error, { action: 'remove_member' });
      throw error;
    }
  }

  async deleteGroup(groupId) {
    try {
      await this.initialize();

      // 使用Realm查询群组
      const realm = await realmService.getRealm();
      const group = realm.objectForPrimaryKey('Group', groupId);

      if (!group) {
        throw new Error('群组不存在');
      }

      // 软删除群组
      realm.write(() => {
        group.is_deleted = true;
        group.deleted_at = new Date();
        group.is_synced = false;
      });

      // 同时软删除所有成员
      const members = realm.objects('GroupMember')
        .filtered('group_id == $0 AND is_deleted == false', groupId);

      realm.write(() => {
        for (const member of members) {
          member.is_deleted = true;
          member.is_synced = false;
        }
      });

      analyticsService.trackGroupAction('delete', { groupId });
    } catch (error) {
      console.error('删除群组失败:', error);
      analyticsService.trackError(error, { action: 'delete_group' });
      throw error;
    }
  }
}

export const groupService = new GroupService();
