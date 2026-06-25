jest.mock('../../../services/api/knowledgeGraphApi', () => ({
  getKnowledgeGraph: jest.fn(),
  createNode: jest.fn(),
  createEdge: jest.fn(),
}));

jest.mock('../../../services/websocket/websocket', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(),
  },
}));

import reducer, {
  fetchKnowledgeGraph,
  setFilters,
  setVisualization,
  setLayout,
  setCurrentNode,
} from '../knowledgeGraphSlice';

describe('knowledgeGraphSlice basic regressions', () => {
  it('handles auth fallback payload on fetchKnowledgeGraph.fulfilled', () => {
    const payload = {
      nodes: [],
      edges: [],
      isAuthError: true,
      message: 'auth expired',
    };
    const next = reducer(undefined, fetchKnowledgeGraph.fulfilled(payload, 'req-auth'));
    expect(next.authRequired).toBe(true);
    expect(next.authMessage).toBe('auth expired');
    expect(next.nodes).toEqual([]);
    expect(next.edges).toEqual([]);
  });

  it('handles network fallback payload on fetchKnowledgeGraph.fulfilled', () => {
    const payload = {
      nodes: [],
      edges: [],
      isNetworkFallback: true,
      message: 'offline graph fallback',
    };
    const next = reducer(undefined, fetchKnowledgeGraph.fulfilled(payload, 'req-offline'));
    expect(next.authRequired).toBe(false);
    expect(next.networkFallbackMessage).toBe('offline graph fallback');
    expect(next.nodes).toEqual([]);
    expect(next.edges).toEqual([]);
  });

  it('merges filter and visualization updates predictably', () => {
    const filtered = reducer(undefined, setFilters({ nodeTypes: ['note'] }));
    expect(filtered.filters.nodeTypes).toEqual(['note']);

    const layouted = reducer(filtered, setLayout('circular'));
    expect(layouted.layout).toBe('circular');

    const withNode = reducer(layouted, setCurrentNode({ id: 'n-1', label: 'A' }));
    expect(withNode.currentNode?.id).toBe('n-1');

    const visualized = reducer(withNode, setVisualization({ zoomLevel: 1.5, centerNode: 'n-1' }));
    expect(visualized.visualization.zoomLevel).toBe(1.5);
    expect(visualized.visualization.centerNode).toBe('n-1');
  });
});
