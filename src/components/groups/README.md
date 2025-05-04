# 群组组件

本目录包含与群组功能相关的组件。

## 组件列表

### GroupList

群组列表组件，用于显示用户加入的群组列表。

**主要功能**：
- 显示群组列表
- 支持群组排序
- 支持群组搜索
- 支持群组分类

### GroupDetail

群组详情组件，用于显示群组的详细信息。

**主要功能**：
- 显示群组基本信息
- 显示群组成员列表
- 显示群组活动
- 支持群组设置

### CreateGroup

创建群组组件，用于创建新的群组。

**主要功能**：
- 设置群组名称和描述
- 设置群组类型（公开/私有）
- 设置群组标签
- 邀请初始成员

### JoinGroup

加入群组组件，用于加入现有群组。

**主要功能**：
- 显示可加入的群组列表
- 支持群组搜索
- 支持群组筛选
- 支持群组预览

### MemberList

成员列表组件，用于显示群组成员。

**主要功能**：
- 显示成员列表
- 支持成员角色显示
- 支持成员搜索
- 支持成员管理

### ScreenShare

屏幕共享组件，用于群组内共享屏幕。

**主要功能**：
- 支持屏幕共享
- 支持画面控制
- 支持权限管理
- 支持聊天互动

## 使用方法

```javascript
import { GroupList, GroupDetail, MemberList } from '../components/groups';

function GroupsScreen() {
  const [groups, setGroups] = useState([]);
  
  useEffect(() => {
    // 获取群组列表
    fetchGroups().then(setGroups);
  }, []);
  
  return (
    <View style={styles.container}>
      <GroupList
        groups={groups}
        onGroupPress={(group) => navigation.navigate('GroupDetail', { groupId: group.id })}
      />
    </View>
  );
}

function GroupDetailScreen({ route }) {
  const { groupId } = route.params;
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  
  useEffect(() => {
    // 获取群组详情
    fetchGroupDetail(groupId).then(setGroup);
    // 获取成员列表
    fetchGroupMembers(groupId).then(setMembers);
  }, [groupId]);
  
  return (
    <View style={styles.container}>
      {group && <GroupDetail group={group} />}
      
      <MemberList
        members={members}
        onMemberPress={handleMemberPress}
      />
    </View>
  );
}
```
