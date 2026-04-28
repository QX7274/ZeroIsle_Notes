jest.mock('../services/database/realmService', () => {
  const sortResults = (items, field, descending = false) => {
    const sorted = [...items].sort((a, b) => {
      const left = a[field];
      const right = b[field];

      if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
      }

      if (left > right) {
        return 1;
      }

      if (left < right) {
        return -1;
      }

      return 0;
    });

    return descending ? sorted.reverse() : sorted;
  };

  const createCollection = (store, name, items) => {
    const collection = [...items];

    collection.filtered = (query, ...params) => {
      let results = [...collection];

      if (name === 'MindMap' && query === 'is_deleted == false') {
        results = results.filter((item) => item.is_deleted === false);
      } else if (name === 'MindMapNode' && query === 'mind_map_id == $0 AND is_deleted == false') {
        results = results.filter((item) => item.mind_map_id === params[0] && item.is_deleted === false);
      } else if (name === 'MindMapEdge' && query === 'mind_map_id == $0 AND is_deleted == false') {
        results = results.filter((item) => item.mind_map_id === params[0] && item.is_deleted === false);
      } else if (query === 'mind_map_id == $0') {
        results = results.filter((item) => item.mind_map_id === params[0]);
      }

      return createCollection(store, name, results);
    };

    collection.sorted = (field, descending = false) => createCollection(store, name, sortResults(collection, field, descending));

    return collection;
  };

  const store = {
    MindMap: new Map(),
    MindMapNode: new Map(),
    MindMapEdge: new Map(),
  };

  const realm = {
    write(fn) {
      fn();
    },
    create(schemaName, data) {
      const record = { ...data };
      store[schemaName].set(record._id, record);
      return record;
    },
    objectForPrimaryKey(schemaName, id) {
      return store[schemaName].get(id) || null;
    },
    objects(schemaName) {
      return createCollection(store, schemaName, Array.from(store[schemaName].values()));
    },
    delete(target) {
      if (Array.isArray(target)) {
        target.forEach((item) => store[item.mind_map_id ? (item.source ? 'MindMapEdge' : 'MindMapNode') : 'MindMap'].delete(item._id));
        return;
      }

      if (!target || !target._id) {
        return;
      }

      if (target.source) {
        store.MindMapEdge.delete(target._id);
      } else if (target.mind_map_id) {
        store.MindMapNode.delete(target._id);
      } else {
        store.MindMap.delete(target._id);
      }
    },
  };

  let counter = 0;

  return {
    __store: store,
    createObjectId: jest.fn(() => `generated-${++counter}`),
    getRealm: jest.fn(async () => realm),
    default: {
      createObjectId: jest.fn(() => `generated-${++counter}`),
      getRealm: jest.fn(async () => realm),
    },
  };
});

const realmService = require('../services/database/realmService');
const mindMapApi = require('../services/api/mindMapApi').default;

describe('mindMapApi local-first', () => {
  beforeEach(() => {
    Object.values(realmService.__store).forEach((map) => map.clear());
  });

  it('creates and reads a local mind map with nodes and edges', async () => {
    const created = await mindMapApi.createMindMap({
      title: '本地导图',
      description: '仅本地',
      data: {
        nodes: [
          { id: 'root', title: '根节点', type: 'root', x: 1, y: 2 },
          { id: 'child', title: '子节点', parent_id: 'root', x: 3, y: 4 },
        ],
        edges: [
          { id: 'edge-1', source: 'root', target: 'child' },
        ],
      },
    });

    expect(created.success).toBe(true);
    expect(created.data.title).toBe('本地导图');
    expect(created.data.nodes).toHaveLength(2);
    expect(created.data.edges).toHaveLength(1);

    const fetched = await mindMapApi.getMindMapById(created.data.id);
    expect(fetched.data.description).toBe('仅本地');
    expect(fetched.data.nodes[0]).toHaveProperty('title');
    expect(fetched.data.edges[0]).toHaveProperty('source', 'root');
  });

  it('lists and filters mind maps by search keyword', async () => {
    await mindMapApi.createMindMap({ title: '学习计划' });
    await mindMapApi.createMindMap({ title: '项目管理' });

    const filtered = await mindMapApi.getMindMaps({ search: '学习' });

    expect(filtered.success).toBe(true);
    expect(filtered.data.count).toBe(1);
    expect(filtered.data.results[0].title).toBe('学习计划');
  });

  it('updates nodes and edges in place', async () => {
    const created = await mindMapApi.createMindMap({ title: '待更新导图' });

    const updated = await mindMapApi.updateMindMap(created.data.id, {
      title: '已更新导图',
      data: {
        nodes: [
          { id: 'new-root', title: '新的根节点', type: 'root', x: 10, y: 20 },
        ],
        edges: [],
      },
    });

    expect(updated.success).toBe(true);
    expect(updated.data.title).toBe('已更新导图');
    expect(updated.data.nodes).toHaveLength(1);
    expect(updated.data.nodes[0].title).toBe('新的根节点');
  });

  it('soft deletes mind maps and hides them from list', async () => {
    const created = await mindMapApi.createMindMap({ title: '待删除导图' });

    const deleted = await mindMapApi.deleteMindMap(created.data.id);
    expect(deleted.success).toBe(true);

    const listed = await mindMapApi.getMindMaps();
    expect(listed.data.results.find((item) => item.id === created.data.id)).toBeUndefined();
  });
});
