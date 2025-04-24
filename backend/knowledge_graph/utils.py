\"""知识图谱工具函数"""

from collections import defaultdict, deque
from .models import KnowledgeNode, KnowledgeEdge


def build_graph(user):
    """构建用户的知识图谱"""
    # 获取用户的所有节点和边
    nodes = KnowledgeNode.objects.filter(user=user)
    edges = KnowledgeEdge.objects.filter(user=user)
    
    # 构建图结构
    graph = defaultdict(list)
    for edge in edges:
        graph[edge.source.id].append((edge.target.id, edge.type, edge.weight))
        # 无向图处理
        if edge.type == 'related':
            graph[edge.target.id].append((edge.source.id, edge.type, edge.weight))
    
    # 节点映射
    node_map = {node.id: node for node in nodes}
    
    return graph, node_map


def find_shortest_path(user, source_id, target_id):
    """查找两个知识点之间的最短路径"""
    graph, node_map = build_graph(user)
    
    if source_id not in node_map or target_id not in node_map:
        return None
    
    # BFS查找最短路径
    queue = deque([(source_id, [])])
    visited = set([source_id])
    
    while queue:
        node_id, path = queue.popleft()
        
        # 找到目标节点
        if node_id == target_id:
            # 构建完整路径
            full_path = []
            for i in range(len(path)):
                if i == 0:
                    full_path.append({
                        'node': node_map[source_id],
                        'edge': None
                    })
                
                node_id, edge_type, edge_weight = path[i]
                full_path.append({
                    'node': node_map[node_id],
                    'edge': {
                        'type': edge_type,
                        'weight': edge_weight
                    }
                })
            
            return full_path
        
        # 遍历相邻节点
        for neighbor, edge_type, edge_weight in graph[node_id]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [(neighbor, edge_type, edge_weight)]))
    
    return None


def find_related_concepts(user, node_id, max_depth=2):
    """查找与指定知识点相关的概念"""
    graph, node_map = build_graph(user)
    
    if node_id not in node_map:
        return []
    
    # BFS查找相关概念
    queue = deque([(node_id, 0)])
    visited = {node_id: 0}  # 节点ID: 深度
    
    while queue:
        current_id, depth = queue.popleft()
        
        # 达到最大深度
        if depth >= max_depth:
            continue
        
        # 遍历相邻节点
        for neighbor, _, _ in graph[current_id]:
            if neighbor not in visited:
                visited[neighbor] = depth + 1
                queue.append((neighbor, depth + 1))
    
    # 构建结果
    result = []
    for node_id, depth in visited.items():
        if node_id in node_map:
            result.append({
                'node': node_map[node_id],
                'depth': depth
            })
    
    return result


def analyze_knowledge_structure(user):
    """分析知识结构"""
    graph, node_map = build_graph(user)
    
    # 计算每个节点的度
    node_degrees = {node_id: len(connections) for node_id, connections in graph.items()}
    
    # 找出中心节点（度最大的节点）
    central_nodes = sorted(node_degrees.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # 计算连通分量
    components = []
    unvisited = set(node_map.keys())
    
    while unvisited:
        # 选择一个未访问的节点
        start = next(iter(unvisited))
        
        # BFS查找连通分量
        component = set()
        queue = deque([start])
        component.add(start)
        unvisited.remove(start)
        
        while queue:
            node_id = queue.popleft()
            for neighbor, _, _ in graph[node_id]:
                if neighbor in unvisited:
                    component.add(neighbor)
                    queue.append(neighbor)
                    unvisited.remove(neighbor)
        
        components.append(component)
    
    # 构建结果
    result = {
        'central_nodes': [{
            'node': node_map[node_id],
            'degree': degree
        } for node_id, degree in central_nodes if node_id in node_map],
        'components': [{
            'size': len(component),
            'nodes': [node_map[node_id] for node_id in component if node_id in node_map]
        } for component in components]
    }
    
    return result