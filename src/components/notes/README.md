# 笔记组件

本目录包含与笔记功能相关的组件。

## 组件列表

### NoteEditor

笔记编辑器组件，用于创建和编辑笔记。

**主要功能**：
- 支持富文本编辑
- 支持Markdown编辑
- 支持图片和附件插入
- 支持代码块和表格

### NoteList

笔记列表组件，用于显示笔记列表。

**主要功能**：
- 显示笔记列表
- 支持列表排序
- 支持列表筛选
- 支持列表搜索

### NoteCard

笔记卡片组件，用于显示笔记预览。

**主要功能**：
- 显示笔记标题和摘要
- 显示笔记标签
- 显示最后编辑时间
- 支持快速操作

### TagSelector

标签选择器组件，用于选择和管理笔记标签。

**主要功能**：
- 显示标签列表
- 支持标签选择
- 支持创建新标签
- 支持标签搜索

### CategorySelector

分类选择器组件，用于选择和管理笔记分类。

**主要功能**：
- 显示分类列表
- 支持分类选择
- 支持创建新分类
- 支持分类搜索

### NoteToolbar

笔记工具栏组件，提供笔记编辑工具。

**主要功能**：
- 提供格式化工具
- 提供插入工具
- 提供撤销和重做
- 提供保存和分享

### NoteVersionHistory

笔记版本历史组件，用于查看和管理笔记的历史版本。

**主要功能**：
- 显示版本列表
- 支持版本比较
- 支持版本恢复
- 支持版本删除

## 使用方法

```javascript
import { NoteEditor, NoteToolbar, TagSelector } from '../components/notes';

function NoteEditScreen({ route }) {
  const { noteId } = route.params;
  const [note, setNote] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  
  useEffect(() => {
    if (noteId) {
      // 获取笔记详情
      fetchNoteDetail(noteId).then(setNote);
    } else {
      // 创建新笔记
      setNote({
        id: null,
        title: '',
        content: '',
        tags: [],
      });
    }
  }, [noteId]);
  
  const handleSave = async () => {
    try {
      if (noteId) {
        // 更新笔记
        await updateNote(noteId, {
          ...note,
          tags: selectedTags,
        });
      } else {
        // 创建笔记
        await createNote({
          ...note,
          tags: selectedTags,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error('Save note error:', error);
    }
  };
  
  if (!note) return <Loading />;
  
  return (
    <View style={styles.container}>
      <NoteToolbar onSave={handleSave} />
      
      <NoteEditor
        value={note.content}
        onChange={(content) => setNote({ ...note, content })}
      />
      
      <TagSelector
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
      />
    </View>
  );
}
```
