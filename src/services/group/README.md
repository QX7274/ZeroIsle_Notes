# 群组服务

本目录包含零屿笔记应用的群组相关服务，用于管理用户群组、成员和群组内容共享。

## 文件结构

- **groupService.js**: 群组服务，提供群组管理功能

## 主要功能

### 群组服务 (groupService.js)

群组服务提供以下主要功能：

- **群组创建**: 创建新的用户群组
- **群组管理**: 更新、删除和查询群组
- **成员管理**: 添加、移除和管理群组成员
- **权限管理**: 设置和管理群组成员权限
- **内容共享**: 在群组内共享笔记和文件
- **群组活动**: 跟踪和记录群组活动
- **群组通知**: 发送群组相关通知

## 群组数据结构

群组的基本数据结构如下：

```javascript
{
  id: String,                 // 群组ID
  name: String,               // 群组名称
  description: String,        // 群组描述
  avatar: String,             // 群组头像URL
  createdBy: String,          // 创建者ID
  createdAt: Date,            // 创建时间
  updatedAt: Date,            // 更新时间
  type: String,               // 群组类型（公开/私有）
  members: [{                 // 群组成员
    userId: String,           // 用户ID
    role: String,             // 角色（管理员/成员）
    joinedAt: Date,           // 加入时间
    permissions: Object       // 权限设置
  }],
  settings: {                 // 群组设置
    joinApproval: Boolean,    // 是否需要批准加入
    memberInvite: Boolean,    // 成员是否可以邀请
    contentShare: Boolean,    // 成员是否可以分享内容
    notifications: Boolean    // 是否启用通知
  },
  tags: [String],             // 群组标签
  inviteCode: String          // 邀请码
}
```

## 成员角色和权限

群组服务支持以下成员角色和权限：

### 角色

- **创建者**: 群组的创建者，拥有所有权限
- **管理员**: 由创建者指定的管理员，拥有大部分管理权限
- **成员**: 普通群组成员，拥有基本权限

### 权限

- **查看**: 查看群组内容的权限
- **编辑**: 编辑群组信息的权限
- **邀请**: 邀请新成员的权限
- **移除**: 移除成员的权限
- **分享**: 分享内容的权限
- **管理**: 管理群组设置的权限

## 群组类型

群组服务支持以下群组类型：

- **公开群组**: 可以被搜索到，任何人可以申请加入
- **私有群组**: 不可被搜索，只能通过邀请加入

## 与其他服务的交互

群组服务与以下服务有交互：

- **API服务**: 与后端群组API通信
- **认证服务**: 验证用户身份和权限
- **通知服务**: 发送群组相关通知
- **WebSocket服务**: 提供群组实时通信
- **存储服务**: 存储群组数据和设置

## 使用方法

```javascript
import { groupService } from '../../services/group';

// 创建群组
async function createGroup(groupData) {
  try {
    const group = await groupService.createGroup({
      name: groupData.name,
      description: groupData.description,
      type: groupData.type,
      tags: groupData.tags,
      settings: groupData.settings
    });
    
    console.log('群组创建成功:', group);
    return group;
  } catch (error) {
    console.error('创建群组失败:', error);
    return null;
  }
}

// 获取群组列表
async function getGroups() {
  try {
    const groups = await groupService.getGroups();
    console.log('获取群组列表成功:', groups.length, '个群组');
    return groups;
  } catch (error) {
    console.error('获取群组列表失败:', error);
    return [];
  }
}

// 获取群组详情
async function getGroupDetails(groupId) {
  try {
    const group = await groupService.getGroupDetails(groupId);
    console.log('获取群组详情成功:', group);
    return group;
  } catch (error) {
    console.error('获取群组详情失败:', error);
    return null;
  }
}

// 更新群组信息
async function updateGroup(groupId, updates) {
  try {
    const updated = await groupService.updateGroup(groupId, updates);
    console.log('更新群组成功:', updated);
    return updated;
  } catch (error) {
    console.error('更新群组失败:', error);
    return null;
  }
}

// 删除群组
async function deleteGroup(groupId) {
  try {
    await groupService.deleteGroup(groupId);
    console.log('删除群组成功');
    return true;
  } catch (error) {
    console.error('删除群组失败:', error);
    return false;
  }
}

// 添加成员
async function addMember(groupId, userId, role = 'member') {
  try {
    await groupService.addMember(groupId, userId, role);
    console.log('添加成员成功');
    return true;
  } catch (error) {
    console.error('添加成员失败:', error);
    return false;
  }
}

// 移除成员
async function removeMember(groupId, userId) {
  try {
    await groupService.removeMember(groupId, userId);
    console.log('移除成员成功');
    return true;
  } catch (error) {
    console.error('移除成员失败:', error);
    return false;
  }
}

// 更新成员角色
async function updateMemberRole(groupId, userId, newRole) {
  try {
    await groupService.updateMemberRole(groupId, userId, newRole);
    console.log('更新成员角色成功');
    return true;
  } catch (error) {
    console.error('更新成员角色失败:', error);
    return false;
  }
}

// 在群组中分享笔记
async function shareNote(groupId, noteId) {
  try {
    await groupService.shareContent(groupId, 'note', noteId);
    console.log('分享笔记成功');
    return true;
  } catch (error) {
    console.error('分享笔记失败:', error);
    return false;
  }
}
```

## 注意事项

- 群组操作应检查用户权限，确保只有有权限的用户可以执行相应操作
- 群组数据应定期同步，确保多设备间的一致性
- 处理群组成员变更的通知，确保所有成员及时了解群组变化
- 考虑群组规模，对大型群组可能需要分页加载成员和内容
- 实现适当的缓存策略，减少网络请求和提高响应速度
