/**
 * 思维导图内置模板服务
 */
import mindMapApi from './mindMapApi';

const now = new Date().toISOString();

const BUILTIN_TEMPLATES = [
  {
    id: 'template-study-plan',
    title: '学习计划',
    description: '用于规划课程、技能和复盘节奏',
    type: 'study',
    thumbnail_url: null,
    created_at: now,
    updated_at: now,
    nodes: [
      { id: 'study-root', title: '学习计划', type: 'root', x: 0, y: 0 },
      { id: 'study-goal', title: '学习目标', type: 'topic', parent_id: 'study-root', x: -220, y: -120 },
      { id: 'study-content', title: '学习内容', type: 'topic', parent_id: 'study-root', x: 220, y: -120 },
      { id: 'study-review', title: '复盘机制', type: 'topic', parent_id: 'study-root', x: 0, y: 180 },
      { id: 'study-goal-1', title: '阶段目标', type: 'subtopic', parent_id: 'study-goal', x: -320, y: -220 },
      { id: 'study-content-1', title: '资料来源', type: 'subtopic', parent_id: 'study-content', x: 320, y: -220 },
      { id: 'study-review-1', title: '每周复盘', type: 'subtopic', parent_id: 'study-review', x: 0, y: 300 },
    ],
    edges: [
      { id: 'study-edge-1', source: 'study-root', target: 'study-goal' },
      { id: 'study-edge-2', source: 'study-root', target: 'study-content' },
      { id: 'study-edge-3', source: 'study-root', target: 'study-review' },
      { id: 'study-edge-4', source: 'study-goal', target: 'study-goal-1' },
      { id: 'study-edge-5', source: 'study-content', target: 'study-content-1' },
      { id: 'study-edge-6', source: 'study-review', target: 'study-review-1' },
    ],
  },
  {
    id: 'template-project-plan',
    title: '项目规划',
    description: '用于拆解里程碑、任务和风险',
    type: 'project',
    thumbnail_url: null,
    created_at: now,
    updated_at: now,
    nodes: [
      { id: 'project-root', title: '项目规划', type: 'root', x: 0, y: 0 },
      { id: 'project-scope', title: '范围', type: 'topic', parent_id: 'project-root', x: -240, y: -140 },
      { id: 'project-exec', title: '执行', type: 'topic', parent_id: 'project-root', x: 240, y: -140 },
      { id: 'project-risk', title: '风险', type: 'topic', parent_id: 'project-root', x: 0, y: 190 },
      { id: 'project-scope-1', title: '需求边界', type: 'subtopic', parent_id: 'project-scope', x: -360, y: -240 },
      { id: 'project-exec-1', title: '里程碑', type: 'subtopic', parent_id: 'project-exec', x: 360, y: -240 },
      { id: 'project-risk-1', title: '资源风险', type: 'subtopic', parent_id: 'project-risk', x: 0, y: 320 },
    ],
    edges: [
      { id: 'project-edge-1', source: 'project-root', target: 'project-scope' },
      { id: 'project-edge-2', source: 'project-root', target: 'project-exec' },
      { id: 'project-edge-3', source: 'project-root', target: 'project-risk' },
      { id: 'project-edge-4', source: 'project-scope', target: 'project-scope-1' },
      { id: 'project-edge-5', source: 'project-exec', target: 'project-exec-1' },
      { id: 'project-edge-6', source: 'project-risk', target: 'project-risk-1' },
    ],
  },
  {
    id: 'template-brainstorm',
    title: '头脑风暴',
    description: '用于快速发散想法并收敛方向',
    type: 'brainstorm',
    thumbnail_url: null,
    created_at: now,
    updated_at: now,
    nodes: [
      { id: 'brainstorm-root', title: '核心问题', type: 'root', x: 0, y: 0 },
      { id: 'brainstorm-idea-1', title: '用户视角', type: 'topic', parent_id: 'brainstorm-root', x: -260, y: -120 },
      { id: 'brainstorm-idea-2', title: '产品视角', type: 'topic', parent_id: 'brainstorm-root', x: 260, y: -120 },
      { id: 'brainstorm-idea-3', title: '实现路径', type: 'topic', parent_id: 'brainstorm-root', x: 0, y: 220 },
      { id: 'brainstorm-note-1', title: '关键痛点', type: 'subtopic', parent_id: 'brainstorm-idea-1', x: -380, y: -230 },
      { id: 'brainstorm-note-2', title: '增长假设', type: 'subtopic', parent_id: 'brainstorm-idea-2', x: 380, y: -230 },
      { id: 'brainstorm-note-3', title: '验证实验', type: 'subtopic', parent_id: 'brainstorm-idea-3', x: 0, y: 340 },
    ],
    edges: [
      { id: 'brainstorm-edge-1', source: 'brainstorm-root', target: 'brainstorm-idea-1' },
      { id: 'brainstorm-edge-2', source: 'brainstorm-root', target: 'brainstorm-idea-2' },
      { id: 'brainstorm-edge-3', source: 'brainstorm-root', target: 'brainstorm-idea-3' },
      { id: 'brainstorm-edge-4', source: 'brainstorm-idea-1', target: 'brainstorm-note-1' },
      { id: 'brainstorm-edge-5', source: 'brainstorm-idea-2', target: 'brainstorm-note-2' },
      { id: 'brainstorm-edge-6', source: 'brainstorm-idea-3', target: 'brainstorm-note-3' },
    ],
  },
  {
    id: 'template-knowledge-map',
    title: '知识体系',
    description: '用于整理主题、分支和关键概念',
    type: 'general',
    thumbnail_url: null,
    created_at: now,
    updated_at: now,
    nodes: [
      { id: 'knowledge-root', title: '知识体系', type: 'root', x: 0, y: 0 },
      { id: 'knowledge-core', title: '核心概念', type: 'topic', parent_id: 'knowledge-root', x: -220, y: -120 },
      { id: 'knowledge-tools', title: '方法工具', type: 'topic', parent_id: 'knowledge-root', x: 220, y: -120 },
      { id: 'knowledge-practice', title: '实践案例', type: 'topic', parent_id: 'knowledge-root', x: 0, y: 190 },
      { id: 'knowledge-core-1', title: '基础定义', type: 'subtopic', parent_id: 'knowledge-core', x: -340, y: -220 },
      { id: 'knowledge-tools-1', title: '常用框架', type: 'subtopic', parent_id: 'knowledge-tools', x: 340, y: -220 },
      { id: 'knowledge-practice-1', title: '真实场景', type: 'subtopic', parent_id: 'knowledge-practice', x: 0, y: 320 },
    ],
    edges: [
      { id: 'knowledge-edge-1', source: 'knowledge-root', target: 'knowledge-core' },
      { id: 'knowledge-edge-2', source: 'knowledge-root', target: 'knowledge-tools' },
      { id: 'knowledge-edge-3', source: 'knowledge-root', target: 'knowledge-practice' },
      { id: 'knowledge-edge-4', source: 'knowledge-core', target: 'knowledge-core-1' },
      { id: 'knowledge-edge-5', source: 'knowledge-tools', target: 'knowledge-tools-1' },
      { id: 'knowledge-edge-6', source: 'knowledge-practice', target: 'knowledge-practice-1' },
    ],
  },
];

const filterTemplates = (templates, params) => {
  let filtered = [...templates];

  if (params.type && params.type !== 'all') {
    filtered = filtered.filter((template) => template.type === params.type);
  }

  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter((template) =>
      template.title.toLowerCase().includes(searchLower) ||
      template.description.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
};

export const getTemplates = async (params = {}) => {
  const templates = filterTemplates(BUILTIN_TEMPLATES, params).map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    type: template.type,
    thumbnail_url: template.thumbnail_url,
    node_count: template.nodes.length,
    created_at: template.created_at,
    updated_at: template.updated_at,
    source: 'builtin',
  }));

  return {
    success: true,
    data: {
      results: templates,
      count: templates.length,
      fromLocal: true,
    },
  };
};

export const useTemplate = async (id) => {
  const template = BUILTIN_TEMPLATES.find((item) => item.id === id);

  if (!template) {
    throw new Error('未找到指定模板');
  }

  return mindMapApi.createMindMap({
    title: template.title,
    description: template.description,
    layout_type: 'tree',
    theme: 'default',
    data: {
      nodes: template.nodes,
      edges: template.edges,
    },
    metadata: {
      template_id: template.id,
      template_type: template.type,
      source: 'builtin',
    },
  });
};

const mindMapTemplateApi = {
  getTemplates,
  useTemplate,
};

export default mindMapTemplateApi;
