"""
知识图谱相关异步任务
"""

import logging
import uuid

from celery import shared_task

from knowledge_graph.services.knowledge_graph_builder_service import (
    KnowledgeGraphBuilderService,
)
from knowledge_graph.services.extraction_service import ExtractionService
from notes.mongodb_models import Note


logger = logging.getLogger(__name__)


@shared_task
def build_graph_for_note_task(note_id: str, user_id: str, extract_concepts: bool = True):
    """
    异步任务：为指定笔记构建知识图谱，并通过WebSocket通知前端

    Args:
        note_id: 笔记UUID字符串
        user_id: 用户UUID字符串（用于WebSocket分组）
        extract_concepts: 是否提取概念

    Returns:
        dict: 构建结果
    """
    try:
        # 读取笔记
        note_uuid = uuid.UUID(note_id)
        note = Note.objects.get(id=note_uuid)

        # 执行构建
        service = KnowledgeGraphBuilderService()
        result = service.build_graph_from_note(note, extract_concepts)

        # WebSocket通知（若已配置channels）
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            if channel_layer:
                group_name = f"knowledge_graph_{user_id}"
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'knowledge_graph.built',
                        'event': 'knowledge_graph.built',
                        'note_id': note_id,
                        'payload': result,
                    },
                )
        except Exception as ws_err:
            logger.warning(f"知识图谱构建完成但WebSocket通知失败: {ws_err}")

        return result
    except Exception as e:
        logger.error(f"构建知识图谱异步任务失败 note_id={note_id}: {e}")
        raise


@shared_task
def auto_extract_entities_task(note_id: str, user_id: str):
    """
    异步任务：自动提取笔记中的实体、关系、概念
    
    当笔记保存时自动触发，提取结果存储到知识图谱
    
    Args:
        note_id: 笔记UUID字符串
        user_id: 用户UUID字符串
        
    Returns:
        dict: 提取结果统计
    """
    try:
        note_uuid = uuid.UUID(note_id)
        note = Note.objects.get(id=note_uuid)
        
        # 执行知识提取
        extraction_service = ExtractionService()
        extraction_result = extraction_service.extract_from_note(note)
        
        # 构建知识图谱节点
        builder_service = KnowledgeGraphBuilderService()
        graph_result = builder_service.build_graph_from_extraction(
            note=note,
            entities=extraction_result.get('entities', []),
            relations=extraction_result.get('relations', []),
            concepts=extraction_result.get('concepts', []),
            keywords=extraction_result.get('keywords', []),
        )
        
        result = {
            'note_id': note_id,
            'entities_count': len(extraction_result.get('entities', [])),
            'relations_count': len(extraction_result.get('relations', [])),
            'concepts_count': len(extraction_result.get('concepts', [])),
            'keywords_count': len(extraction_result.get('keywords', [])),
            'graph_nodes_created': graph_result.get('nodes_created', 0),
            'graph_edges_created': graph_result.get('edges_created', 0),
        }
        
        # WebSocket通知
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            
            channel_layer = get_channel_layer()
            if channel_layer:
                group_name = f"knowledge_graph_{user_id}"
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'entities_extracted',
                        'event': 'entities_extracted',
                        'note_id': note_id,
                        'payload': result,
                    },
                )
        except Exception as ws_err:
            logger.warning(f"实体提取完成但WebSocket通知失败: {ws_err}")
        
        logger.info(f"自动实体提取完成 note_id={note_id}: {result}")
        return result
        
    except Note.DoesNotExist:
        logger.error(f"笔记不存在 note_id={note_id}")
        return {'error': 'Note not found'}
    except Exception as e:
        logger.error(f"自动实体提取失败 note_id={note_id}: {e}")
        raise


@shared_task
def batch_extract_entities_task(note_ids: list, user_id: str):
    """
    异步任务：批量提取多个笔记的实体
    
    Args:
        note_ids: 笔记UUID字符串列表
        user_id: 用户UUID字符串
        
    Returns:
        dict: 批量提取结果统计
    """
    results = []
    success_count = 0
    error_count = 0
    
    for note_id in note_ids:
        try:
            result = auto_extract_entities_task.apply(
                args=[note_id, user_id]
            ).get(timeout=60)
            results.append(result)
            success_count += 1
        except Exception as e:
            logger.error(f"批量提取失败 note_id={note_id}: {e}")
            results.append({'note_id': note_id, 'error': str(e)})
            error_count += 1
    
    summary = {
        'total': len(note_ids),
        'success': success_count,
        'errors': error_count,
        'results': results,
    }
    
    # WebSocket通知完成
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if channel_layer:
            group_name = f"knowledge_graph_{user_id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'batch_extraction_complete',
                    'event': 'batch_extraction_complete',
                    'payload': summary,
                },
            )
    except Exception as ws_err:
        logger.warning(f"批量提取完成但WebSocket通知失败: {ws_err}")
    
    return summary


@shared_task
def rebuild_user_knowledge_graph_task(user_id: str):
    """
    异步任务：重建用户的整个知识图谱
    
    Args:
        user_id: 用户UUID字符串
        
    Returns:
        dict: 重建结果
    """
    try:
        user_uuid = uuid.UUID(user_id)
        
        # 获取用户所有笔记
        notes = Note.objects.filter(user_id=user_uuid, is_deleted=False)
        note_ids = [str(note.id) for note in notes]
        
        logger.info(f"开始重建知识图谱: user_id={user_id}, notes_count={len(note_ids)}")
        
        # 批量提取
        result = batch_extract_entities_task.apply(
            args=[note_ids, user_id]
        ).get(timeout=300)
        
        logger.info(f"知识图谱重建完成: user_id={user_id}")
        return result
        
    except Exception as e:
        logger.error(f"知识图谱重建失败 user_id={user_id}: {e}")
        raise

