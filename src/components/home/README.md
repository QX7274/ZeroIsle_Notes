# 首页组件

本目录包含与应用首页相关的组件。

## 组件列表

### SortControl

排序控制组件，用于控制首页内容的排序方式。

**主要功能**：
- 支持多种排序方式（最新、最热、最近编辑等）
- 支持排序方向切换（升序/降序）
- 支持自定义排序
- 支持排序记忆

### RecentNotes

最近笔记组件，用于显示最近编辑或查看的笔记。

**主要功能**：
- 显示最近笔记列表
- 支持笔记预览
- 支持快速访问
- 支持列表刷新

### QuickActions

快速操作组件，用于提供常用操作的快捷入口。

**主要功能**：
- 提供新建笔记、录音等快捷操作
- 支持自定义快捷操作
- 支持拖拽排序
- 支持快捷操作统计

### StatisticsCard

统计卡片组件，用于显示用户的使用统计信息。

**主要功能**：
- 显示笔记总数、标签总数等统计信息
- 显示使用时长、活跃天数等统计信息
- 支持统计图表
- 支持时间范围选择

### RecommendedContent

推荐内容组件，用于显示推荐给用户的内容。

**主要功能**：
- 显示推荐笔记
- 显示推荐标签
- 显示推荐用户
- 支持推荐原因说明

## 使用方法

```javascript
import { SortControl, RecentNotes, QuickActions } from '../components/home';

function HomeScreen() {
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [recentNotes, setRecentNotes] = useState([]);
  
  useEffect(() => {
    // 获取最近笔记
    fetchRecentNotes(sortBy, sortDirection).then(setRecentNotes);
  }, [sortBy, sortDirection]);
  
  return (
    <View style={styles.container}>
      <SortControl
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortByChange={setSortBy}
        onSortDirectionChange={setSortDirection}
      />
      
      <QuickActions onActionPress={handleQuickAction} />
      
      <RecentNotes
        notes={recentNotes}
        onNotePress={(note) => navigation.navigate('NoteDetail', { noteId: note.id })}
      />
    </View>
  );
}
```
