/**
 * 思维导图本地优先 API 服务
 */
import realmService from '../database/realmService';

const MIND_MAP_SCHEMA = 'MindMap';
const MIND_MAP_NODE_SCHEMA = 'MindMapNode';
const MIND_MAP_EDGE_SCHEMA = 'MindMapEdge';

const ensureString = (value, fallback = '') => {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return fallback;
  }

  return String(value);
};

const parseMetadata = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const normalizeNode = (node = {}, index = 0) => ({
  id: ensureString(node.id || node._id || `node-${Date.now()}-${index}`),
  title: ensureString(node.title || node.text || node.label || `节点 ${index + 1}`),
  content: ensureString(node.content || node.note || ''),
  type: ensureString(node.type || (index === 0 ? 'root' : 'topic'), index === 0 ? 'root' : 'topic'),
  parent_id: node.parent_id ? ensureString(node.parent_id) : null,
  x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
  y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
  order: Number.isFinite(Number(node.order)) ? Number(node.order) : index,
  metadata: parseMetadata(node.metadata),
});

const normalizeEdge = (edge = {}, index = 0) => ({
  id: ensureString(edge.id || edge._id || `edge-${Date.now()}-${index}`),
  source: ensureString(edge.source),
  target: ensureString(edge.target),
  type: ensureString(edge.type || 'default', 'default'),
  style: ensureString(edge.style || 'solid', 'solid'),
  label: edge.label ? ensureString(edge.label) : '',
  metadata: parseMetadata(edge.metadata),
});

const createDefaultRootNode = (title) => ({
  id: `node-${realmService.createObjectId()}`,
  title: ensureString(title || '中心主题', '中心主题'),
  content: '',
  type: 'root',
  parent_id: null,
  x: 0,
  y: 0,
  order: 0,
  metadata: {},
});

const normalizeMindMapPayload = (payload = {}) => {
  const title = ensureString(payload.title || '未命名思维导图', '未命名思维导图').trim() || '未命名思维导图';
  const rawNodes = Array.isArray(payload?.data?.nodes)
    ? payload.data.nodes
    : Array.isArray(payload.nodes)
      ? payload.nodes
      : [];
  const rawEdges = Array.isArray(payload?.data?.edges)
    ? payload.data.edges
    : Array.isArray(payload.edges)
      ? payload.edges
      : [];

  const nodes = rawNodes.length > 0
    ? rawNodes.map((node, index) => normalizeNode(node, index))
    : [createDefaultRootNode(title)];
  const edges = rawEdges.map((edge, index) => normalizeEdge(edge, index));
  const rootNode = nodes.find(node => !node.parent_id) || nodes[0];

  return {
    title,
    description: ensureString(payload.description || ''),
    layout_type: ensureString(payload.layout_type || payload.layout || 'tree', 'tree'),
    theme: ensureString(payload.theme || 'default', 'default'),
    metadata: parseMetadata(payload.metadata),
    nodes,
    edges,
    rootNodeId: rootNode?.id || null,
  };
};

const toIsoString = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date(value).toISOString();
};

const mapNodeRecord = (node) => ({
  _id: node._id,
  id: node._id,
  title: node.title,
  content: node.content || '',
  type: node.type || 'topic',
  parent_id: node.parent_id || null,
  x: node.x ?? 0,
  y: node.y ?? 0,
  order: node.order ?? 0,
  metadata: parseMetadata(node.metadata),
  created_at: toIsoString(node.created_at),
  updated_at: toIsoString(node.updated_at),
});

const mapEdgeRecord = (edge) => ({
  _id: edge._id,
  id: edge._id,
  source: edge.source,
  target: edge.target,
  type: edge.type || 'default',
  style: edge.style || 'solid',
  label: edge.label || '',
  metadata: parseMetadata(edge.metadata),
  created_at: toIsoString(edge.created_at),
  updated_at: toIsoString(edge.updated_at),
});

const buildMindMapDetail = async (realm, mindMapRecord) => {
  const nodeResults = realm
    .objects(MIND_MAP_NODE_SCHEMA)
    .filtered('mind_map_id == $0 AND is_deleted == false', mindMapRecord._id)
    .sorted('order');
  const edgeResults = realm
    .objects(MIND_MAP_EDGE_SCHEMA)
    .filtered('mind_map_id == $0 AND is_deleted == false', mindMapRecord._id);

  const nodes = Array.from(nodeResults).map(mapNodeRecord);
  const edges = Array.from(edgeResults).map(mapEdgeRecord);

  return {
    _id: mindMapRecord._id,
    id: mindMapRecord._id,
    title: mindMapRecord.title,
    description: mindMapRecord.description || '',
    layout_type: mindMapRecord.layout_type || 'tree',
    theme: mindMapRecord.theme || 'default',
    root_node_id: mindMapRecord.root_node_id || null,
    node_count: nodes.length,
    edge_count: edges.length,
    metadata: parseMetadata(mindMapRecord.metadata),
    created_at: toIsoString(mindMapRecord.created_at),
    updated_at: toIsoString(mindMapRecord.updated_at),
    data: {
      nodes,
      edges,
    },
    nodes,
    edges,
  };
};

const listMindMapItems = async (realm, params = {}) => {
  const search = ensureString(params.search || '').trim().toLowerCase();
  const page = Number.isFinite(Number(params.page)) ? Number(params.page) : 1;
  const pageSize = Number.isFinite(Number(params.page_size || params.limit))
    ? Number(params.page_size || params.limit)
    : null;
  const skip = Number.isFinite(Number(params.skip)) ? Number(params.skip) : pageSize ? (page - 1) * pageSize : 0;

  let results = realm
    .objects(MIND_MAP_SCHEMA)
    .filtered('is_deleted == false')
    .sorted('updated_at', true);

  let items = Array.from(results).map((item) => ({
    _id: item._id,
    id: item._id,
    title: item.title,
    description: item.description || '',
    layout_type: item.layout_type || 'tree',
    theme: item.theme || 'default',
    node_count: item.node_count || 0,
    edge_count: item.edge_count || 0,
    created_at: toIsoString(item.created_at),
    updated_at: toIsoString(item.updated_at),
  }));

  if (search) {
    items = items.filter((item) =>
      item.title.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search)
    );
  }

  const count = items.length;
  const pagedItems = pageSize ? items.slice(skip, skip + pageSize) : items;

  return {
    results: pagedItems,
    count,
  };
};

export const getMindMaps = async (params = {}) => {
  const realm = await realmService.getRealm();
  const data = await listMindMapItems(realm, params);

  return {
    success: true,
    data,
  };
};

export const getMindMapById = async (id) => {
  const realm = await realmService.getRealm();
  const mindMapRecord = realm.objectForPrimaryKey(MIND_MAP_SCHEMA, ensureString(id));

  if (!mindMapRecord || mindMapRecord.is_deleted) {
    throw new Error('思维导图不存在或已被删除');
  }

  const detail = await buildMindMapDetail(realm, mindMapRecord);

  return {
    success: true,
    data: detail,
  };
};

export const getMindMap = getMindMapById;

export const createMindMap = async (payload = {}) => {
  const realm = await realmService.getRealm();
  const normalized = normalizeMindMapPayload(payload);
  const now = new Date();
  const mindMapId = ensureString(payload.id || payload._id || realmService.createObjectId());

  realm.write(() => {
    realm.create(MIND_MAP_SCHEMA, {
      _id: mindMapId,
      title: normalized.title,
      description: normalized.description,
      layout_type: normalized.layout_type,
      theme: normalized.theme,
      root_node_id: normalized.rootNodeId,
      node_count: normalized.nodes.length,
      edge_count: normalized.edges.length,
      metadata: JSON.stringify(normalized.metadata),
      created_at: now,
      updated_at: now,
      is_deleted: false,
      is_synced: false,
    }, 'modified');

    normalized.nodes.forEach((node, index) => {
      realm.create(MIND_MAP_NODE_SCHEMA, {
        _id: node.id,
        mind_map_id: mindMapId,
        title: node.title,
        content: node.content,
        type: node.type,
        parent_id: node.parent_id,
        x: node.x,
        y: node.y,
        order: Number.isFinite(Number(node.order)) ? Number(node.order) : index,
        metadata: JSON.stringify(node.metadata || {}),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_synced: false,
      }, 'modified');
    });

    normalized.edges.forEach((edge) => {
      realm.create(MIND_MAP_EDGE_SCHEMA, {
        _id: edge.id,
        mind_map_id: mindMapId,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        style: edge.style,
        label: edge.label || null,
        metadata: JSON.stringify(edge.metadata || {}),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_synced: false,
      }, 'modified');
    });
  });

  return getMindMapById(mindMapId);
};

export const updateMindMap = async (id, payload = {}) => {
  const realm = await realmService.getRealm();
  const mindMapId = ensureString(id);
  const existing = realm.objectForPrimaryKey(MIND_MAP_SCHEMA, mindMapId);

  if (!existing || existing.is_deleted) {
    throw new Error('思维导图不存在，无法更新');
  }

  const normalized = normalizeMindMapPayload({
    ...payload,
    title: payload.title ?? existing.title,
    description: payload.description ?? existing.description,
    layout_type: payload.layout_type ?? existing.layout_type,
    theme: payload.theme ?? existing.theme,
  });
  const now = new Date();

  realm.write(() => {
    existing.title = normalized.title;
    existing.description = normalized.description;
    existing.layout_type = normalized.layout_type;
    existing.theme = normalized.theme;
    existing.root_node_id = normalized.rootNodeId;
    existing.node_count = normalized.nodes.length;
    existing.edge_count = normalized.edges.length;
    existing.metadata = JSON.stringify(normalized.metadata);
    existing.updated_at = now;
    existing.is_deleted = false;

    const oldNodes = realm
      .objects(MIND_MAP_NODE_SCHEMA)
      .filtered('mind_map_id == $0', mindMapId);
    const oldEdges = realm
      .objects(MIND_MAP_EDGE_SCHEMA)
      .filtered('mind_map_id == $0', mindMapId);

    realm.delete(oldNodes);
    realm.delete(oldEdges);

    normalized.nodes.forEach((node, index) => {
      realm.create(MIND_MAP_NODE_SCHEMA, {
        _id: node.id,
        mind_map_id: mindMapId,
        title: node.title,
        content: node.content,
        type: node.type,
        parent_id: node.parent_id,
        x: node.x,
        y: node.y,
        order: Number.isFinite(Number(node.order)) ? Number(node.order) : index,
        metadata: JSON.stringify(node.metadata || {}),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_synced: false,
      }, 'modified');
    });

    normalized.edges.forEach((edge) => {
      realm.create(MIND_MAP_EDGE_SCHEMA, {
        _id: edge.id,
        mind_map_id: mindMapId,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        style: edge.style,
        label: edge.label || null,
        metadata: JSON.stringify(edge.metadata || {}),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_synced: false,
      }, 'modified');
    });
  });

  return getMindMapById(mindMapId);
};

export const deleteMindMap = async (id) => {
  const realm = await realmService.getRealm();
  const mindMapId = ensureString(id);
  const existing = realm.objectForPrimaryKey(MIND_MAP_SCHEMA, mindMapId);

  if (!existing || existing.is_deleted) {
    return { success: true };
  }

  const now = new Date();

  realm.write(() => {
    existing.is_deleted = true;
    existing.deleted_at = now;
    existing.updated_at = now;

    const nodes = realm
      .objects(MIND_MAP_NODE_SCHEMA)
      .filtered('mind_map_id == $0 AND is_deleted == false', mindMapId);
    const edges = realm
      .objects(MIND_MAP_EDGE_SCHEMA)
      .filtered('mind_map_id == $0 AND is_deleted == false', mindMapId);

    Array.from(nodes).forEach((node) => {
      node.is_deleted = true;
      node.deleted_at = now;
      node.updated_at = now;
    });

    Array.from(edges).forEach((edge) => {
      edge.is_deleted = true;
      edge.deleted_at = now;
      edge.updated_at = now;
    });
  });

  return {
    success: true,
  };
};

const mindMapApi = {
  getMindMaps,
  getMindMap,
  getMindMapById,
  createMindMap,
  updateMindMap,
  deleteMindMap,
};

export default mindMapApi;
