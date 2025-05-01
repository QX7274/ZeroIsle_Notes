import api from './authService';

// 获取笔记列表
export const getNotes = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/notes', { params });
    // return response.data;

    // 使用模拟数据
    return mockNotes(params);
  } catch (error) {
    console.error('获取笔记列表错误:', error);
    throw error;
  }
};

// 获取笔记详情
export const getNoteDetail = async (id) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get(`/notes/${id}`);
    // return response.data;

    // 使用模拟数据
    return mockNoteDetail(id);
  } catch (error) {
    console.error('获取笔记详情错误:', error);
    throw error;
  }
};

// 创建笔记
export const createNote = async (noteData) => {
  try {
    const response = await api.post('/notes', noteData);
    return response.data;
  } catch (error) {
    console.error('创建笔记错误:', error);
    throw error;
  }
};

// 更新笔记
export const updateNote = async (id, noteData) => {
  try {
    const response = await api.put(`/notes/${id}`, noteData);
    return response.data;
  } catch (error) {
    console.error('更新笔记错误:', error);
    throw error;
  }
};

// 删除笔记
export const deleteNote = async (id) => {
  try {
    const response = await api.delete(`/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除笔记错误:', error);
    throw error;
  }
};

// 更新笔记状态
export const updateNoteStatus = async (id, status) => {
  try {
    const response = await api.patch(`/notes/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('更新笔记状态错误:', error);
    throw error;
  }
};

// 获取笔记版本历史
export const getNoteVersions = async (id) => {
  try {
    const response = await api.get(`/notes/${id}/versions`);
    return response.data;
  } catch (error) {
    console.error('获取笔记版本历史错误:', error);
    throw error;
  }
};

// 恢复笔记到指定版本
export const restoreNoteVersion = async (id, versionId) => {
  try {
    const response = await api.post(`/notes/${id}/versions/${versionId}/restore`);
    return response.data;
  } catch (error) {
    console.error('恢复笔记版本错误:', error);
    throw error;
  }
};

// 获取笔记统计数据
export const getNoteStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/notes/stats');
    // return response.data;

    // 使用模拟数据
    return mockNoteStats();
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};

// 模拟数据
const mockNotes = (params) => {
  // 生成模拟笔记数据
  const generateMockNotes = (count) => {
    const notes = [];
    for (let i = 1; i <= count; i++) {
      notes.push({
        id: `note-${i}`,
        title: `笔记标题 ${i}`,
        content: `这是笔记 ${i} 的内容，包含了用户记录的信息。`,
        author: {
          id: `user-${i % 5 + 1}`,
          username: `用户${i % 5 + 1}`,
          avatar: null,
        },
        category: {
          id: `category-${i % 3 + 1}`,
          name: ['工作', '学习', '生活'][i % 3],
        },
        tags: [
          {
            id: `tag-${i % 5 + 1}`,
            name: ['重要', '会议', '项目', '学习', '生活'][i % 5],
            color: ['red', 'blue', 'green', 'orange', 'purple'][i % 5],
          },
          {
            id: `tag-${(i + 2) % 5 + 1}`,
            name: ['重要', '会议', '项目', '学习', '生活'][(i + 2) % 5],
            color: ['red', 'blue', 'green', 'orange', 'purple'][(i + 2) % 5],
          },
        ],
        status: i % 3 === 0 ? 'draft' : 'published',
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        updatedAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString().split('T')[0],
        views: Math.floor(Math.random() * 100),
        likes: Math.floor(Math.random() * 20),
        commentsCount: Math.floor(Math.random() * 10),
      });
    }
    return notes;
  };

  // 模拟分页和筛选
  const allNotes = generateMockNotes(50);
  let filteredNotes = [...allNotes];

  // 关键词筛选
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredNotes = filteredNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(keyword) ||
        note.content.toLowerCase().includes(keyword)
    );
  }

  // 分类筛选
  if (params.categoryId) {
    filteredNotes = filteredNotes.filter(
      (note) => note.category.id === params.categoryId
    );
  }

  // 标签筛选
  if (params.tagId) {
    filteredNotes = filteredNotes.filter(
      (note) => note.tags.some((tag) => tag.id === params.tagId)
    );
  }

  // 状态筛选
  if (params.status) {
    filteredNotes = filteredNotes.filter(
      (note) => note.status === params.status
    );
  }

  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredNotes = filteredNotes.filter(
      (note) =>
        note.createdAt >= params.startDate && note.createdAt <= params.endDate
    );
  }

  // 排序
  if (params.sortField && params.sortOrder) {
    filteredNotes.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  }

  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedNotes = filteredNotes.slice(start, end);

  return {
    data: paginatedNotes,
    total: filteredNotes.length,
    page,
    pageSize,
  };
};

const mockNoteDetail = (id) => {
  // 模拟笔记详情
  return {
    id,
    title: `笔记标题 ${id.split('-')[1]}`,
    content: `这是笔记 ${id.split('-')[1]} 的详细内容，包含了用户记录的信息。这里可以是很长的文本内容，包括格式化的文本、图片链接等。

## 第一部分
这是第一部分的内容，可以包含一些重要的信息。

## 第二部分
这是第二部分的内容，可以包含一些补充说明。

## 总结
这是总结部分，对整个笔记进行总结。`,
    author: {
      id: `user-${id.split('-')[1] % 5 + 1}`,
      username: `用户${id.split('-')[1] % 5 + 1}`,
      avatar: null,
    },
    category: {
      id: `category-${id.split('-')[1] % 3 + 1}`,
      name: ['工作', '学习', '生活'][id.split('-')[1] % 3],
    },
    tags: [
      {
        id: `tag-${id.split('-')[1] % 5 + 1}`,
        name: ['重要', '会议', '项目', '学习', '生活'][id.split('-')[1] % 5],
        color: ['red', 'blue', 'green', 'orange', 'purple'][id.split('-')[1] % 5],
      },
      {
        id: `tag-${(parseInt(id.split('-')[1]) + 2) % 5 + 1}`,
        name: ['重要', '会议', '项目', '学习', '生活'][(parseInt(id.split('-')[1]) + 2) % 5],
        color: ['red', 'blue', 'green', 'orange', 'purple'][(parseInt(id.split('-')[1]) + 2) % 5],
      },
    ],
    status: parseInt(id.split('-')[1]) % 3 === 0 ? 'draft' : 'published',
    createdAt: new Date(Date.now() - parseInt(id.split('-')[1]) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    updatedAt: new Date(Date.now() - parseInt(id.split('-')[1]) * 12 * 60 * 60 * 1000).toISOString().split('T')[0],
    views: Math.floor(Math.random() * 100),
    likes: Math.floor(Math.random() * 20),
    commentsCount: Math.floor(Math.random() * 10),
  };
};

const mockNoteVersions = (id) => {
  // 模拟笔记版本历史
  const versions = [];
  const count = Math.floor(Math.random() * 5) + 1;

  for (let i = 1; i <= count; i++) {
    versions.push({
      id: `version-${id}-${i}`,
      version: i,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdBy: {
        id: `user-${i % 3 + 1}`,
        username: `用户${i % 3 + 1}`,
      },
    });
  }

  return versions;
};

const mockNoteStats = () => {
  // 模拟笔记统计数据
  return {
    totalNotes: 50,
    publishedNotes: 35,
    draftNotes: 15,
    todayNewNotes: 3,
    categories: [
      { id: 'category-1', name: '工作', count: 20 },
      { id: 'category-2', name: '学习', count: 15 },
      { id: 'category-3', name: '生活', count: 15 },
    ],
    tags: [
      { id: 'tag-1', name: '重要', count: 10 },
      { id: 'tag-2', name: '会议', count: 8 },
      { id: 'tag-3', name: '项目', count: 12 },
      { id: 'tag-4', name: '学习', count: 15 },
      { id: 'tag-5', name: '生活', count: 5 },
    ],
  };
};
