"""
索引服务
"""

import logging
import time
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from search.models import SearchIndex
from .vector_service import VectorService

logger = logging.getLogger('backend')

class IndexerService:
    """
    索引服务类
    处理内容索引的业务逻辑
    """
    
    def __init__(self):
        """初始化"""
        self.vector_service = VectorService()
    
    def index_object(self, obj, index_type=None, user=None, is_public=False):
        """
        索引对象
        
        Args:
            obj: 要索引的对象
            index_type: 索引类型，如果为None则自动推断
            user: 用户对象，如果为None则从对象获取
            is_public: 是否公开
            
        Returns:
            SearchIndex: 创建的索引对象
        """
        try:
            # 获取内容类型
            content_type = ContentType.objects.get_for_model(obj)
            
            # 自动推断索引类型
            if index_type is None:
                index_type = self._infer_index_type(obj)
            
            # 自动获取用户
            if user is None:
                user = self._get_user_from_object(obj)
            
            # 提取标题和内容
            title, content, keywords = self._extract_content(obj, index_type)
            
            # 生成向量表示
            vector = self.vector_service.generate_vector(title, content)
            
            # 创建或更新索引
            with transaction.atomic():
                index, created = SearchIndex.objects.update_or_create(
                    content_type=content_type,
                    object_id=str(obj.id),
                    defaults={
                        'user': user,
                        'title': title,
                        'content': content,
                        'keywords': keywords,
                        'index_type': index_type,
                        'vector': vector,
                        'is_public': is_public
                    }
                )
                
                logger.info(f"{'创建' if created else '更新'}索引: {index_type} - {title}")
                
                return index
        except Exception as e:
            logger.error(f"索引对象失败: {e}")
            raise
    
    def remove_index(self, obj):
        """
        移除索引
        
        Args:
            obj: 要移除索引的对象
            
        Returns:
            bool: 是否成功
        """
        try:
            # 获取内容类型
            content_type = ContentType.objects.get_for_model(obj)
            
            # 删除索引
            deleted, _ = SearchIndex.objects.filter(
                content_type=content_type,
                object_id=str(obj.id)
            ).delete()
            
            logger.info(f"移除索引: {obj.__class__.__name__} - {obj.id}, 删除数量: {deleted}")
            
            return deleted > 0
        except Exception as e:
            logger.error(f"移除索引失败: {e}")
            raise
    
    def reindex_all(self, model_class, index_type=None, batch_size=100):
        """
        重新索引所有对象
        
        Args:
            model_class: 模型类
            index_type: 索引类型，如果为None则自动推断
            batch_size: 批处理大小
            
        Returns:
            tuple: (成功数量, 失败数量)
        """
        try:
            # 获取所有对象
            objects = model_class.objects.all()
            total = objects.count()
            
            logger.info(f"开始重新索引 {model_class.__name__}, 总数: {total}")
            
            success_count = 0
            error_count = 0
            start_time = time.time()
            
            # 批量处理
            for i in range(0, total, batch_size):
                batch = objects[i:i+batch_size]
                
                for obj in batch:
                    try:
                        self.index_object(obj, index_type)
                        success_count += 1
                    except Exception as e:
                        logger.error(f"索引对象失败: {obj.id} - {e}")
                        error_count += 1
                
                logger.info(f"已处理: {i+len(batch)}/{total}, 成功: {success_count}, 失败: {error_count}")
            
            duration = time.time() - start_time
            logger.info(f"重新索引完成, 总数: {total}, 成功: {success_count}, 失败: {error_count}, 耗时: {duration:.2f}秒")
            
            return success_count, error_count
        except Exception as e:
            logger.error(f"重新索引失败: {e}")
            raise
    
    def _infer_index_type(self, obj):
        """
        推断索引类型
        
        Args:
            obj: 对象
            
        Returns:
            str: 索引类型
        """
        class_name = obj.__class__.__name__.lower()
        
        # 映射类名到索引类型
        type_map = {
            'note': 'note',
            'tag': 'tag',
            'category': 'category',
            'knowledgenode': 'knowledge_node',
            'transcription': 'transcription',
            'post': 'community_post',
            'comment': 'community_comment',
        }
        
        return type_map.get(class_name, 'note')
    
    def _get_user_from_object(self, obj):
        """
        从对象获取用户
        
        Args:
            obj: 对象
            
        Returns:
            User: 用户对象
        """
        # 尝试不同的属性名
        for attr in ['user', 'author', 'owner', 'creator']:
            if hasattr(obj, attr):
                return getattr(obj, attr)
        
        # 如果找不到用户，抛出异常
        raise ValueError(f"无法从对象获取用户: {obj.__class__.__name__}")
    
    def _extract_content(self, obj, index_type):
        """
        提取内容
        
        Args:
            obj: 对象
            index_type: 索引类型
            
        Returns:
            tuple: (标题, 内容, 关键词)
        """
        # 根据索引类型提取内容
        if index_type == 'note':
            title = getattr(obj, 'title', '')
            content = getattr(obj, 'content', '')
            keywords = self._extract_keywords_from_tags(obj)
        elif index_type == 'tag':
            title = getattr(obj, 'name', '')
            content = getattr(obj, 'description', '')
            keywords = title
        elif index_type == 'category':
            title = getattr(obj, 'name', '')
            content = getattr(obj, 'description', '')
            keywords = title
        elif index_type == 'knowledge_node':
            title = getattr(obj, 'title', '')
            content = getattr(obj, 'description', '')
            keywords = ''
        elif index_type == 'transcription':
            title = getattr(obj, 'audio_file', None)
            if title:
                title = getattr(title, 'file_name', '')
            else:
                title = f"转录 {obj.id}"
            content = getattr(obj, 'text', '')
            keywords = ''
        elif index_type == 'community_post':
            title = getattr(obj, 'title', '')
            content = getattr(obj, 'content', '')
            keywords = self._extract_keywords_from_tags(obj)
        elif index_type == 'community_comment':
            title = f"评论 {obj.id}"
            content = getattr(obj, 'content', '')
            keywords = ''
        else:
            # 默认提取方法
            title = getattr(obj, 'title', '') or getattr(obj, 'name', '') or f"{obj.__class__.__name__} {obj.id}"
            content = getattr(obj, 'content', '') or getattr(obj, 'description', '') or getattr(obj, 'text', '')
            keywords = ''
        
        return title, content, keywords
    
    def _extract_keywords_from_tags(self, obj):
        """
        从标签提取关键词
        
        Args:
            obj: 对象
            
        Returns:
            str: 关键词
        """
        # 尝试获取标签
        if hasattr(obj, 'tags'):
            tags = obj.tags.all()
            return ','.join(tag.name for tag in tags)
        return ''
