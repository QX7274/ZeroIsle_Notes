"""
数据库查询优化工具
提供查询分析、N+1检测和批量操作优化
"""

import logging
import functools
from typing import List, Dict, Any, Callable, TypeVar, Generic
from django.db import connection
from django.conf import settings
from contextlib import contextmanager

logger = logging.getLogger(__name__)

T = TypeVar('T')


class QueryOptimizer:
    """
    查询优化器
    
    提供查询分析和优化建议
    
    使用方法:
        optimizer = QueryOptimizer()
        
        # 分析查询
        with optimizer.analyze():
            result = MyModel.objects.filter(...).all()
        
        # 获取分析结果
        stats = optimizer.get_stats()
    """
    
    def __init__(self):
        self.queries = []
        self.start_count = 0
        self.is_analyzing = False
    
    @contextmanager
    def analyze(self):
        """分析查询上下文管理器"""
        if not settings.DEBUG:
            yield
            return
        
        self.start_count = len(connection.queries)
        self.is_analyzing = True
        
        try:
            yield
        finally:
            self.is_analyzing = False
            end_count = len(connection.queries)
            self.queries = connection.queries[self.start_count:end_count]
            
            # 检测问题
            self._detect_issues()
    
    def _detect_issues(self):
        """检测查询问题"""
        if len(self.queries) > 10:
            logger.warning(f"查询过多: {len(self.queries)}个查询，可能存在N+1问题")
        
        # 检测重复查询
        sql_list = [q['sql'] for q in self.queries]
        duplicates = {sql: sql_list.count(sql) for sql in set(sql_list) if sql_list.count(sql) > 1}
        
        if duplicates:
            for sql, count in duplicates.items():
                logger.warning(f"重复查询（{count}次）: {sql[:100]}...")
        
        # 检测慢查询
        for query in self.queries:
            time = float(query.get('time', 0))
            if time > 0.1:  # 100ms
                logger.warning(f"慢查询（{time:.3f}s）: {query['sql'][:100]}...")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        total_time = sum(float(q.get('time', 0)) for q in self.queries)
        
        return {
            'query_count': len(self.queries),
            'total_time': round(total_time, 4),
            'average_time': round(total_time / len(self.queries), 4) if self.queries else 0,
            'queries': [
                {
                    'sql': q['sql'][:200],
                    'time': float(q.get('time', 0))
                }
                for q in self.queries
            ]
        }


class BatchLoader(Generic[T]):
    """
    批量加载器
    
    解决N+1查询问题
    
    使用方法:
        loader = BatchLoader(User, 'id')
        
        # 添加要加载的ID
        loader.add(user_id_1)
        loader.add(user_id_2)
        
        # 批量加载
        users = loader.load()
        
        # 获取单个对象
        user = loader.get(user_id_1)
    """
    
    def __init__(self, model_class, lookup_field: str = 'id'):
        self.model_class = model_class
        self.lookup_field = lookup_field
        self.pending_ids = set()
        self.cached_objects = {}
        self._loaded = False
    
    def add(self, id_value) -> 'BatchLoader':
        """添加要加载的ID"""
        if id_value is not None and id_value not in self.cached_objects:
            self.pending_ids.add(id_value)
            self._loaded = False
        return self
    
    def add_many(self, id_values) -> 'BatchLoader':
        """添加多个ID"""
        for id_value in id_values:
            self.add(id_value)
        return self
    
    def load(self) -> Dict[Any, T]:
        """执行批量加载"""
        if not self.pending_ids:
            return self.cached_objects
        
        # 构建查询
        filter_kwargs = {f'{self.lookup_field}__in': list(self.pending_ids)}
        
        try:
            objects = self.model_class.objects.filter(**filter_kwargs)
            
            for obj in objects:
                key = getattr(obj, self.lookup_field)
                self.cached_objects[key] = obj
            
            self.pending_ids.clear()
            self._loaded = True
            
        except Exception as e:
            logger.error(f"批量加载失败: {e}")
        
        return self.cached_objects
    
    def get(self, id_value) -> T:
        """获取单个对象"""
        if not self._loaded and self.pending_ids:
            self.load()
        
        return self.cached_objects.get(id_value)
    
    def clear(self):
        """清空缓存"""
        self.pending_ids.clear()
        self.cached_objects.clear()
        self._loaded = False


def prefetch_related_decorator(*prefetch_fields):
    """
    预获取装饰器
    
    自动为返回的QuerySet添加prefetch_related
    
    使用方法:
        @prefetch_related_decorator('user', 'tags')
        def get_notes(user_id):
            return Note.objects.filter(user_id=user_id)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # 如果返回的是QuerySet，添加prefetch_related
            if hasattr(result, 'prefetch_related'):
                return result.prefetch_related(*prefetch_fields)
            
            return result
        
        return wrapper
    return decorator


def select_related_decorator(*select_fields):
    """
    关联选择装饰器
    
    自动为返回的QuerySet添加select_related
    
    使用方法:
        @select_related_decorator('user', 'category')
        def get_notes(user_id):
            return Note.objects.filter(user_id=user_id)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            if hasattr(result, 'select_related'):
                return result.select_related(*select_fields)
            
            return result
        
        return wrapper
    return decorator


class BulkOperationHelper:
    """
    批量操作助手
    
    优化大量数据的创建/更新/删除
    
    使用方法:
        helper = BulkOperationHelper(Note, batch_size=1000)
        
        # 批量创建
        for data in large_dataset:
            helper.add_create(Note(**data))
        helper.flush_creates()
        
        # 批量更新
        for note in notes:
            note.updated = True
            helper.add_update(note, ['updated'])
        helper.flush_updates()
    """
    
    def __init__(self, model_class, batch_size: int = 1000):
        self.model_class = model_class
        self.batch_size = batch_size
        self.create_queue = []
        self.update_queue = []
        self.delete_queue = []
        self._update_fields = set()
    
    def add_create(self, obj) -> 'BulkOperationHelper':
        """添加待创建对象"""
        self.create_queue.append(obj)
        
        if len(self.create_queue) >= self.batch_size:
            self.flush_creates()
        
        return self
    
    def add_update(self, obj, fields: List[str]) -> 'BulkOperationHelper':
        """添加待更新对象"""
        self.update_queue.append(obj)
        self._update_fields.update(fields)
        
        if len(self.update_queue) >= self.batch_size:
            self.flush_updates()
        
        return self
    
    def add_delete(self, obj_id) -> 'BulkOperationHelper':
        """添加待删除ID"""
        self.delete_queue.append(obj_id)
        
        if len(self.delete_queue) >= self.batch_size:
            self.flush_deletes()
        
        return self
    
    def flush_creates(self) -> int:
        """执行批量创建"""
        if not self.create_queue:
            return 0
        
        try:
            created = self.model_class.objects.bulk_create(
                self.create_queue,
                ignore_conflicts=True
            )
            count = len(created)
            self.create_queue.clear()
            logger.info(f"批量创建完成: {count}条")
            return count
        except Exception as e:
            logger.error(f"批量创建失败: {e}")
            return 0
    
    def flush_updates(self) -> int:
        """执行批量更新"""
        if not self.update_queue:
            return 0
        
        try:
            count = self.model_class.objects.bulk_update(
                self.update_queue,
                list(self._update_fields)
            )
            self.update_queue.clear()
            self._update_fields.clear()
            logger.info(f"批量更新完成: {count}条")
            return count
        except Exception as e:
            logger.error(f"批量更新失败: {e}")
            return 0
    
    def flush_deletes(self) -> int:
        """执行批量删除"""
        if not self.delete_queue:
            return 0
        
        try:
            result = self.model_class.objects.filter(
                id__in=self.delete_queue
            ).delete()
            count = result[0] if result else 0
            self.delete_queue.clear()
            logger.info(f"批量删除完成: {count}条")
            return count
        except Exception as e:
            logger.error(f"批量删除失败: {e}")
            return 0
    
    def flush_all(self):
        """执行所有挂起的操作"""
        self.flush_creates()
        self.flush_updates()
        self.flush_deletes()


# MongoDB批量操作助手
class MongoBulkOperationHelper:
    """
    MongoDB批量操作助手
    
    使用方法:
        helper = MongoBulkOperationHelper(Note, batch_size=1000)
        
        for data in large_dataset:
            helper.add_insert(data)
        helper.execute()
    """
    
    def __init__(self, document_class, batch_size: int = 1000):
        self.document_class = document_class
        self.batch_size = batch_size
        self.insert_queue = []
        self.update_queue = []
    
    def add_insert(self, data: Dict) -> 'MongoBulkOperationHelper':
        """添加待插入数据"""
        self.insert_queue.append(self.document_class(**data))
        
        if len(self.insert_queue) >= self.batch_size:
            self.flush_inserts()
        
        return self
    
    def flush_inserts(self) -> int:
        """执行批量插入"""
        if not self.insert_queue:
            return 0
        
        try:
            result = self.document_class.objects.insert(
                self.insert_queue,
                load_bulk=False
            )
            count = len(result) if result else 0
            self.insert_queue.clear()
            logger.info(f"MongoDB批量插入完成: {count}条")
            return count
        except Exception as e:
            logger.error(f"MongoDB批量插入失败: {e}")
            return 0
    
    def execute(self):
        """执行所有挂起的操作"""
        self.flush_inserts()
