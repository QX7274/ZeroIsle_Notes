"""
数据导出服务
支持笔记、标签、知识图谱的多格式导出
"""

import logging
import json
import csv
import io
import zipfile
from datetime import datetime
from typing import List, Dict, Any, Optional
from django.utils import timezone

logger = logging.getLogger(__name__)


class ExportFormat:
    """导出格式"""
    JSON = 'json'
    MARKDOWN = 'markdown'
    HTML = 'html'
    CSV = 'csv'
    PDF = 'pdf'


class DataExportService:
    """
    数据导出服务
    
    使用方法:
        service = DataExportService()
        
        # 导出单个笔记
        content = service.export_note(note, format='markdown')
        
        # 批量导出
        zip_buffer = service.export_all(user, formats=['markdown', 'json'])
    """
    
    def export_note(self, note, format: str = ExportFormat.MARKDOWN) -> str:
        """
        导出单个笔记
        
        Args:
            note: 笔记对象
            format: 导出格式
            
        Returns:
            str: 导出内容
        """
        if format == ExportFormat.JSON:
            return self._export_note_json(note)
        elif format == ExportFormat.MARKDOWN:
            return self._export_note_markdown(note)
        elif format == ExportFormat.HTML:
            return self._export_note_html(note)
        else:
            return self._export_note_markdown(note)
    
    def _export_note_json(self, note) -> str:
        """导出为JSON"""
        data = {
            'id': str(note.id),
            'title': note.title,
            'content': note.content,
            'created_at': note.created_at.isoformat() if note.created_at else None,
            'updated_at': note.updated_at.isoformat() if note.updated_at else None,
            'tags': [str(tag.id) for tag in getattr(note, 'tags', [])] if hasattr(note, 'tags') else [],
            'category': str(note.category.id) if hasattr(note, 'category') and note.category else None,
            'is_pinned': getattr(note, 'is_pinned', False),
            'is_archived': getattr(note, 'is_archived', False),
        }
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def _export_note_markdown(self, note) -> str:
        """导出为Markdown"""
        lines = []
        
        # 标题
        lines.append(f"# {note.title or '无标题'}")
        lines.append("")
        
        # 元数据
        lines.append("---")
        lines.append(f"创建时间: {note.created_at.strftime('%Y-%m-%d %H:%M') if note.created_at else '未知'}")
        lines.append(f"更新时间: {note.updated_at.strftime('%Y-%m-%d %H:%M') if note.updated_at else '未知'}")
        if hasattr(note, 'tags') and note.tags:
            tags = [tag.name for tag in note.tags]
            lines.append(f"标签: {', '.join(tags)}")
        lines.append("---")
        lines.append("")
        
        # 内容
        lines.append(note.content or '')
        
        return '\n'.join(lines)
    
    def _export_note_html(self, note) -> str:
        """导出为HTML"""
        import markdown
        
        md_content = self._export_note_markdown(note)
        html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{note.title or '无标题'}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }}
        h1 {{ color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }}
        pre {{ background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }}
        code {{ background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }}
        hr {{ border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }}
    </style>
</head>
<body>
{html_content}
</body>
</html>"""
        return html
    
    def export_notes_batch(self, notes, format: str = ExportFormat.MARKDOWN) -> bytes:
        """
        批量导出笔记为ZIP
        
        Args:
            notes: 笔记列表
            format: 导出格式
            
        Returns:
            bytes: ZIP文件内容
        """
        buffer = io.BytesIO()
        
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i, note in enumerate(notes):
                content = self.export_note(note, format)
                
                # 生成文件名
                title = note.title or f'note_{i+1}'
                # 清理文件名中的非法字符
                safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()[:50]
                
                ext = {
                    ExportFormat.JSON: '.json',
                    ExportFormat.MARKDOWN: '.md',
                    ExportFormat.HTML: '.html',
                }.get(format, '.md')
                
                filename = f"{safe_title}{ext}"
                zf.writestr(filename, content.encode('utf-8'))
        
        buffer.seek(0)
        return buffer.read()
    
    def export_knowledge_graph(self, user, format: str = 'json') -> str:
        """
        导出知识图谱
        
        Args:
            user: 用户对象
            format: 导出格式 (json/graphml)
            
        Returns:
            str: 导出内容
        """
        try:
            from knowledge_graph.services.neo4j_service import Neo4jService
            
            service = Neo4jService.get_instance()
            
            # 获取用户的所有节点和关系
            nodes_query = """
            MATCH (n:KnowledgeNode {user_id: $user_id})
            RETURN n
            """
            
            edges_query = """
            MATCH (n1:KnowledgeNode {user_id: $user_id})-[r]->(n2:KnowledgeNode {user_id: $user_id})
            RETURN n1, type(r) as rel_type, r, n2
            """
            
            nodes = service.run_query(nodes_query, {'user_id': str(user.id)})
            edges = service.run_query(edges_query, {'user_id': str(user.id)})
            
            if format == 'json':
                return self._format_graph_json(nodes, edges)
            elif format == 'graphml':
                return self._format_graph_graphml(nodes, edges)
            else:
                return self._format_graph_json(nodes, edges)
                
        except Exception as e:
            logger.error(f"导出知识图谱失败: {e}")
            return json.dumps({'error': str(e)}, ensure_ascii=False)
    
    def _format_graph_json(self, nodes, edges) -> str:
        """格式化为JSON"""
        data = {
            'nodes': [
                {
                    'id': str(n['n'].get('id')),
                    'label': n['n'].get('label', ''),
                    'type': n['n'].get('type', ''),
                    'properties': dict(n['n'])
                }
                for n in nodes
            ],
            'edges': [
                {
                    'source': str(e['n1'].get('id')),
                    'target': str(e['n2'].get('id')),
                    'type': e['rel_type'],
                    'properties': dict(e['r']) if e['r'] else {}
                }
                for e in edges
            ],
            'exported_at': timezone.now().isoformat()
        }
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def _format_graph_graphml(self, nodes, edges) -> str:
        """格式化为GraphML"""
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
            '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
            '  <key id="type" for="node" attr.name="type" attr.type="string"/>',
            '  <graph id="G" edgedefault="directed">',
        ]
        
        # 节点
        for n in nodes:
            node_id = n['n'].get('id', '')
            label = n['n'].get('label', '')
            node_type = n['n'].get('type', '')
            lines.append(f'    <node id="{node_id}">')
            lines.append(f'      <data key="label">{label}</data>')
            lines.append(f'      <data key="type">{node_type}</data>')
            lines.append('    </node>')
        
        # 边
        for i, e in enumerate(edges):
            source = e['n1'].get('id', '')
            target = e['n2'].get('id', '')
            rel_type = e['rel_type']
            lines.append(f'    <edge id="e{i}" source="{source}" target="{target}" label="{rel_type}"/>')
        
        lines.extend([
            '  </graph>',
            '</graphml>'
        ])
        
        return '\n'.join(lines)
    
    def export_user_data(self, user) -> bytes:
        """
        导出用户所有数据（GDPR合规）
        
        Args:
            user: 用户对象
            
        Returns:
            bytes: ZIP文件内容
        """
        buffer = io.BytesIO()
        
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 用户信息
            user_data = {
                'id': str(user.id),
                'username': user.username,
                'email': getattr(user, 'email', ''),
                'created_at': user.created_at.isoformat() if hasattr(user, 'created_at') else None,
                'exported_at': timezone.now().isoformat(),
            }
            zf.writestr('user_info.json', json.dumps(user_data, ensure_ascii=False, indent=2))
            
            # 笔记
            try:
                from notes.mongodb_models import Note
                notes = Note.objects(user=user)
                notes_zip = self.export_notes_batch(notes, ExportFormat.MARKDOWN)
                zf.writestr('notes.zip', notes_zip)
            except Exception as e:
                logger.error(f"导出笔记失败: {e}")
            
            # 知识图谱
            try:
                graph_data = self.export_knowledge_graph(user, 'json')
                zf.writestr('knowledge_graph.json', graph_data)
            except Exception as e:
                logger.error(f"导出知识图谱失败: {e}")
            
            # 导出说明
            readme = """# 数据导出说明

本压缩包包含您在零屿笔记中的所有数据：

- user_info.json: 您的账户信息
- notes.zip: 您的所有笔记（Markdown格式）
- knowledge_graph.json: 您的知识图谱数据

导出时间: {}
""".format(timezone.now().strftime('%Y-%m-%d %H:%M:%S'))
            zf.writestr('README.md', readme)
        
        buffer.seek(0)
        return buffer.read()


# 全局服务实例
_export_service = None


def get_export_service() -> DataExportService:
    """获取导出服务实例"""
    global _export_service
    if _export_service is None:
        _export_service = DataExportService()
    return _export_service
