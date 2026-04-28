"""
知识图谱导入导出视图
"""

import json
import logging
from datetime import datetime

from django.http import JsonResponse, HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from knowledge_graph.services.neo4j_service import Neo4jService
from knowledge_graph.services.extraction_service import ExtractionService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_knowledge_graph(request):
    """
    导出用户的知识图谱
    
    支持格式: json, csv, graphml
    
    Query Parameters:
        format: 导出格式 (json, csv, graphml)
        include_notes: 是否包含笔记内容 (true/false)
    """
    try:
        user_id = str(request.user.id)
        export_format = request.GET.get('format', 'json')
        include_notes = request.GET.get('include_notes', 'false').lower() == 'true'
        
        neo4j_service = Neo4jService()
        
        # 获取用户的所有节点
        nodes_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        RETURN n {
            .id, .title, .type, .content, .tags, 
            .created_at, .updated_at, .metadata
        } as node
        """
        nodes_result = neo4j_service.run_query(nodes_query, {'user_id': user_id})
        nodes = [record['node'] for record in nodes_result]
        
        # 获取用户的所有边
        edges_query = """
        MATCH (a:KnowledgeNode {user_id: $user_id})-[r]->(b:KnowledgeNode {user_id: $user_id})
        RETURN a.id as source, type(r) as relation, b.id as target, r.weight as weight
        """
        edges_result = neo4j_service.run_query(edges_query, {'user_id': user_id})
        edges = [
            {
                'source': record['source'],
                'relation': record['relation'],
                'target': record['target'],
                'weight': record.get('weight', 1.0)
            }
            for record in edges_result
        ]
        
        # 根据格式生成响应
        if export_format == 'json':
            export_data = {
                'version': '1.0',
                'exported_at': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'statistics': {
                    'nodes_count': len(nodes),
                    'edges_count': len(edges),
                },
                'nodes': nodes,
                'edges': edges,
            }
            
            response = HttpResponse(
                json.dumps(export_data, ensure_ascii=False, indent=2),
                content_type='application/json'
            )
            response['Content-Disposition'] = f'attachment; filename="knowledge_graph_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
            return response
            
        elif export_format == 'csv':
            # CSV格式: 分别导出节点和边
            import csv
            from io import StringIO
            
            output = StringIO()
            
            # 写入节点
            output.write("# NODES\n")
            if nodes:
                writer = csv.DictWriter(output, fieldnames=['id', 'title', 'type', 'tags'])
                writer.writeheader()
                for node in nodes:
                    writer.writerow({
                        'id': node.get('id', ''),
                        'title': node.get('title', ''),
                        'type': node.get('type', ''),
                        'tags': ','.join(node.get('tags', []) or []),
                    })
            
            output.write("\n# EDGES\n")
            if edges:
                writer = csv.DictWriter(output, fieldnames=['source', 'relation', 'target', 'weight'])
                writer.writeheader()
                for edge in edges:
                    writer.writerow(edge)
            
            response = HttpResponse(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="knowledge_graph_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
            return response
            
        elif export_format == 'graphml':
            # GraphML XML格式
            graphml = ['<?xml version="1.0" encoding="UTF-8"?>']
            graphml.append('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">')
            graphml.append('  <key id="title" for="node" attr.name="title" attr.type="string"/>')
            graphml.append('  <key id="type" for="node" attr.name="type" attr.type="string"/>')
            graphml.append('  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>')
            graphml.append('  <graph id="G" edgedefault="directed">')
            
            for node in nodes:
                node_id = node.get('id', '')
                title = node.get('title', '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                node_type = node.get('type', '')
                graphml.append(f'    <node id="{node_id}">')
                graphml.append(f'      <data key="title">{title}</data>')
                graphml.append(f'      <data key="type">{node_type}</data>')
                graphml.append('    </node>')
            
            for i, edge in enumerate(edges):
                graphml.append(f'    <edge id="e{i}" source="{edge["source"]}" target="{edge["target"]}">')
                graphml.append(f'      <data key="weight">{edge.get("weight", 1.0)}</data>')
                graphml.append('    </edge>')
            
            graphml.append('  </graph>')
            graphml.append('</graphml>')
            
            response = HttpResponse('\n'.join(graphml), content_type='application/xml')
            response['Content-Disposition'] = f'attachment; filename="knowledge_graph_{datetime.now().strftime("%Y%m%d_%H%M%S")}.graphml"'
            return response
            
        else:
            return JsonResponse({'error': f'Unsupported format: {export_format}'}, status=400)
            
    except Exception as e:
        logger.error(f"导出知识图谱失败: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_knowledge_graph(request):
    """
    导入知识图谱数据
    
    支持格式: json
    
    Request Body:
        - file: 上传的JSON文件
        - merge_strategy: 合并策略 (replace, merge, skip)
    """
    try:
        user_id = str(request.user.id)
        merge_strategy = request.POST.get('merge_strategy', 'merge')
        
        # 获取上传文件
        if 'file' not in request.FILES:
            return JsonResponse({'error': '请上传文件'}, status=400)
        
        uploaded_file = request.FILES['file']
        
        # 解析JSON
        try:
            import_data = json.load(uploaded_file)
        except json.JSONDecodeError as e:
            return JsonResponse({'error': f'JSON解析失败: {str(e)}'}, status=400)
        
        # 验证数据格式
        if 'nodes' not in import_data or 'edges' not in import_data:
            return JsonResponse({'error': '无效的数据格式，缺少nodes或edges'}, status=400)
        
        nodes = import_data.get('nodes', [])
        edges = import_data.get('edges', [])
        
        neo4j_service = Neo4jService()
        
        nodes_created = 0
        nodes_updated = 0
        edges_created = 0
        errors = []
        
        # 导入节点
        for node in nodes:
            try:
                node_id = node.get('id')
                if not node_id:
                    continue
                
                # 检查节点是否存在
                exists_query = """
                MATCH (n:KnowledgeNode {id: $id, user_id: $user_id})
                RETURN n
                """
                existing = neo4j_service.run_query(exists_query, {'id': node_id, 'user_id': user_id})
                
                if existing and merge_strategy == 'skip':
                    continue
                elif existing and merge_strategy == 'replace':
                    # 删除后重新创建
                    delete_query = "MATCH (n:KnowledgeNode {id: $id, user_id: $user_id}) DETACH DELETE n"
                    neo4j_service.run_query(delete_query, {'id': node_id, 'user_id': user_id})
                
                # 创建或更新节点
                create_query = """
                MERGE (n:KnowledgeNode {id: $id, user_id: $user_id})
                SET n.title = $title,
                    n.type = $type,
                    n.content = $content,
                    n.tags = $tags,
                    n.updated_at = datetime()
                RETURN n
                """
                neo4j_service.run_query(create_query, {
                    'id': node_id,
                    'user_id': user_id,
                    'title': node.get('title', ''),
                    'type': node.get('type', 'concept'),
                    'content': node.get('content', ''),
                    'tags': node.get('tags', []),
                })
                
                if existing:
                    nodes_updated += 1
                else:
                    nodes_created += 1
                    
            except Exception as e:
                errors.append(f"节点导入失败 {node.get('id', 'unknown')}: {str(e)}")
        
        # 导入边
        for edge in edges:
            try:
                source = edge.get('source')
                target = edge.get('target')
                relation = edge.get('relation', 'RELATED_TO')
                
                if not source or not target:
                    continue
                
                create_edge_query = f"""
                MATCH (a:KnowledgeNode {{id: $source, user_id: $user_id}})
                MATCH (b:KnowledgeNode {{id: $target, user_id: $user_id}})
                MERGE (a)-[r:{relation}]->(b)
                SET r.weight = $weight
                RETURN r
                """
                neo4j_service.run_query(create_edge_query, {
                    'source': source,
                    'target': target,
                    'user_id': user_id,
                    'weight': edge.get('weight', 1.0),
                })
                edges_created += 1
                
            except Exception as e:
                errors.append(f"边导入失败 {source}->{target}: {str(e)}")
        
        return JsonResponse({
            'success': True,
            'statistics': {
                'nodes_created': nodes_created,
                'nodes_updated': nodes_updated,
                'edges_created': edges_created,
                'errors_count': len(errors),
            },
            'errors': errors[:10] if errors else [],  # 最多返回10个错误
        })
        
    except Exception as e:
        logger.error(f"导入知识图谱失败: {e}")
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_statistics(request):
    """
    获取知识图谱统计信息
    """
    try:
        user_id = str(request.user.id)
        neo4j_service = Neo4jService()
        
        # 节点统计
        nodes_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        RETURN n.type as type, count(*) as count
        """
        nodes_stats = neo4j_service.run_query(nodes_query, {'user_id': user_id})
        
        # 边统计
        edges_query = """
        MATCH (a:KnowledgeNode {user_id: $user_id})-[r]->(b:KnowledgeNode {user_id: $user_id})
        RETURN type(r) as relation, count(*) as count
        """
        edges_stats = neo4j_service.run_query(edges_query, {'user_id': user_id})
        
        return JsonResponse({
            'nodes': {record['type']: record['count'] for record in nodes_stats},
            'edges': {record['relation']: record['count'] for record in edges_stats},
            'total_nodes': sum(record['count'] for record in nodes_stats),
            'total_edges': sum(record['count'] for record in edges_stats),
        })
        
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        return JsonResponse({'error': str(e)}, status=500)
