import { axiosInstance } from '../config';

const knowledgeGraphApi = {
  fetchKnowledgeGraph: (userId) => 
    axiosInstance.get(`/knowledge-graph/${userId}`),
    
  updateNode: (nodeData) => 
    axiosInstance.put('/knowledge-graph/nodes', nodeData),

  createRelation: (relationData) =>
    axiosInstance.post('/knowledge-graph/relations', relationData),

  deleteNode: (nodeId) =>
    axiosInstance.delete(`/knowledge-graph/nodes/${nodeId}`),

  searchNodes: (query) =>
    axiosInstance.get('/knowledge-graph/search', { params: { query } })
};

export default knowledgeGraphApi;