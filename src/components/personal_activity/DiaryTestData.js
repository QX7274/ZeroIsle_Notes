/**
 * 朋友圈式日记测试数据
 */

export const mockDiaryData = [
  {
    _id: '1',
    title: '今天的心情很好',
    content: '今天天气特别好，和朋友一起去公园散步，看到了很多美丽的花朵。生活中的小确幸总是让人感到温暖。',
    content_type: 'diary',
    start_time: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    location_name: '中山公园',
    mood: 'happy',
    satisfaction: 4,
    is_public: true,
    images: [
      {
        url: 'https://picsum.photos/400/300?random=1',
        description: '公园里的花朵',
      },
      {
        url: 'https://picsum.photos/400/300?random=2',
        description: '蓝天白云',
      },
    ],
    tags: ['散步', '心情', '公园'],
    category: {
      name: '生活',
      color: '#4ECDC4',
      icon: 'home',
    },
  },
  {
    _id: '2',
    title: '工作思考',
    content: '今天在项目中遇到了一个技术难题，经过几个小时的思考和调试，终于找到了解决方案。这种解决问题后的成就感真的很棒！',
    content_type: 'thought',
    start_time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2小时前
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    mood: 'excited',
    satisfaction: 5,
    is_public: false,
    tags: ['工作', '技术', '成长'],
    category: {
      name: '工作',
      color: '#FF6B6B',
      icon: 'work',
    },
  },
  {
    _id: '3',
    title: '健身打卡',
    content: '今天完成了30分钟的跑步训练，虽然很累但是感觉很充实。坚持运动真的能让人保持好心情。',
    content_type: 'activity',
    start_time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1天前
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    location_name: '健身房',
    mood: 'happy',
    satisfaction: 4,
    is_public: true,
    images: [
      {
        url: 'https://picsum.photos/400/300?random=3',
        description: '健身房',
      },
    ],
    tags: ['健身', '跑步', '运动'],
    category: {
      name: '健康',
      color: '#45B7D1',
      icon: 'fitness_center',
    },
  },
  {
    _id: '4',
    title: '读书笔记',
    content: '今天读完了《人类简史》的第三章，对人类文明的发展有了更深的理解。书中提到的认知革命概念特别有意思。',
    content_type: 'thought',
    start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2天前
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    mood: 'neutral',
    satisfaction: 4,
    is_public: true,
    tags: ['读书', '学习', '思考'],
    category: {
      name: '学习',
      color: '#9B59B6',
      icon: 'school',
    },
  },
  {
    _id: '5',
    title: '美食探店',
    content: '和朋友们一起去尝试了一家新开的日料店，味道真的很不错！特别是那个三文鱼刺身，新鲜度满分。',
    content_type: 'diary',
    start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3天前
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    location_name: '樱花日料',
    mood: 'happy',
    satisfaction: 5,
    is_public: true,
    images: [
      {
        url: 'https://picsum.photos/400/300?random=4',
        description: '三文鱼刺身',
      },
      {
        url: 'https://picsum.photos/400/300?random=5',
        description: '日式料理',
      },
      {
        url: 'https://picsum.photos/400/300?random=6',
        description: '餐厅环境',
      },
    ],
    tags: ['美食', '朋友', '日料'],
    category: {
      name: '美食',
      color: '#F39C12',
      icon: 'restaurant',
    },
  },
  {
    _id: '6',
    title: '工作压力',
    content: '最近项目进度有点紧张，需要加班处理一些紧急任务。虽然有压力，但团队合作很好，相信能够按时完成。',
    content_type: 'thought',
    start_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5天前
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    mood: 'stressed',
    satisfaction: 3,
    is_public: false,
    tags: ['工作', '压力', '团队'],
    category: {
      name: '工作',
      color: '#FF6B6B',
      icon: 'work',
    },
  },
];

export const mockDashboardData = {
  totalActivities: mockDiaryData.length,
  thisWeekActivities: mockDiaryData.filter(item => {
    const itemDate = new Date(item.start_time);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return itemDate > weekAgo;
  }).length,
  averageSatisfaction: mockDiaryData.reduce((sum, item) => sum + (item.satisfaction || 0), 0) / mockDiaryData.length,
  moodDistribution: {
    happy: mockDiaryData.filter(item => item.mood === 'happy').length,
    neutral: mockDiaryData.filter(item => item.mood === 'neutral').length,
    sad: mockDiaryData.filter(item => item.mood === 'sad').length,
    excited: mockDiaryData.filter(item => item.mood === 'excited').length,
    stressed: mockDiaryData.filter(item => item.mood === 'stressed').length,
  },
};
