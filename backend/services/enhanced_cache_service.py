import redis
import json
import hashlib
import time
import asyncio
from typing import Any, Optional, Dict, List
from django.conf import settings
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder
import logging

logger = logging.getLogger(__name__)

class EnhancedCacheService:
    """
    Multi-layer caching service with intelligent cache strategies
    """
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=getattr(settings, 'REDIS_HOST', 'localhost'),
            port=getattr(settings, 'REDIS_PORT', 6379),
            db=getattr(settings, 'REDIS_DB', 0),
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True
        )
        
        self.cache_ttl = {
            'user_notes': 300,      # 5 minutes
            'ai_results': 3600,     # 1 hour
            'file_metadata': 1800,  # 30 minutes
            'search_results': 600,  # 10 minutes
            'user_sessions': 86400, # 24 hours
            'system_config': 3600   # 1 hour
        }
        
        self.compression_threshold = 1024  # Compress data larger than 1KB
        self.max_cache_size = 100 * 1024 * 1024  # 100MB max cache size
        
    async def get(self, key: str, cache_type: str = 'default') -> Optional[Any]:
        """
        Get value from cache with fallback strategy
        """
        try:
            # Try Redis first
            cached_data = await self._get_from_redis(key)
            if cached_data:
                return self._deserialize_data(cached_data)
            
            # Fallback to Django cache
            cached_data = cache.get(key)
            if cached_data:
                # Promote to Redis for future requests
                await self._set_to_redis(key, cached_data, cache_type)
                return cached_data
                
            return None
            
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: Any, cache_type: str = 'default', 
                  ttl: Optional[int] = None) -> bool:
        """
        Set value in cache with intelligent storage strategy
        """
        try:
            if ttl is None:
                ttl = self.cache_ttl.get(cache_type, 300)
            
            # Serialize data
            serialized_data = self._serialize_data(value)
            
            # Choose storage strategy based on data size
            data_size = len(serialized_data.encode('utf-8'))
            
            if data_size > self.compression_threshold:
                # Use Redis with compression for large data
                await self._set_to_redis_compressed(key, serialized_data, ttl)
            else:
                # Use both Redis and Django cache for small data
                await self._set_to_redis(key, serialized_data, ttl)
                cache.set(key, value, ttl)
            
            return True
            
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def get_or_set(self, key: str, callable_func, cache_type: str = 'default',
                        ttl: Optional[int] = None) -> Any:
        """
        Get from cache or execute function and cache result
        """
        # Try to get from cache first
        cached_value = await self.get(key, cache_type)
        if cached_value is not None:
            return cached_value
        
        # Execute function and cache result
        try:
            if asyncio.iscoroutinefunction(callable_func):
                value = await callable_func()
            else:
                value = callable_func()
            
            await self.set(key, value, cache_type, ttl)
            return value
            
        except Exception as e:
            logger.error(f"Error in get_or_set for key {key}: {e}")
            raise
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from all cache layers
        """
        try:
            # Delete from Redis
            await self._delete_from_redis(key)
            
            # Delete from Django cache
            cache.delete(key)
            
            return True
            
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern
        """
        try:
            keys = await self._get_keys_by_pattern(pattern)
            deleted_count = 0
            
            for key in keys:
                if await self.delete(key):
                    deleted_count += 1
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def get_user_notes_cached(self, user_id: int, page: int = 1, 
                                   page_size: int = 20) -> Dict:
        """
        Get user notes with intelligent caching
        """
        cache_key = f"user_notes:{user_id}:page:{page}:size:{page_size}"
        
        async def fetch_notes():
            from notes.models import Note
            from notes.serializers import NoteSerializer
            
            notes = Note.objects.filter(user_id=user_id) \
                               .select_related('user') \
                               .prefetch_related('tags', 'ai_history') \
                               .order_by('-created_at')
            
            # Implement pagination
            start = (page - 1) * page_size
            end = start + page_size
            paginated_notes = notes[start:end]
            
            serializer = NoteSerializer(paginated_notes, many=True)
            
            return {
                'notes': serializer.data,
                'total_count': notes.count(),
                'page': page,
                'page_size': page_size,
                'has_next': end < notes.count()
            }
        
        return await self.get_or_set(cache_key, fetch_notes, 'user_notes')
    
    async def cache_ai_result(self, text: str, task_type: str, result: Dict) -> str:
        """
        Cache AI processing result with content-based key
        """
        # Generate content-based cache key
        content_hash = hashlib.sha256(
            f"{task_type}:{text}".encode('utf-8')
        ).hexdigest()
        cache_key = f"ai_result:{content_hash}"
        
        # Add metadata to result
        cached_result = {
            'result': result,
            'timestamp': time.time(),
            'task_type': task_type,
            'text_length': len(text)
        }
        
        await self.set(cache_key, cached_result, 'ai_results')
        return cache_key
    
    async def get_cached_ai_result(self, text: str, task_type: str) -> Optional[Dict]:
        """
        Get cached AI result by content
        """
        content_hash = hashlib.sha256(
            f"{task_type}:{text}".encode('utf-8')
        ).hexdigest()
        cache_key = f"ai_result:{content_hash}"
        
        cached_data = await self.get(cache_key, 'ai_results')
        if cached_data:
            # Update access time for LRU
            cached_data['last_accessed'] = time.time()
            await self.set(cache_key, cached_data, 'ai_results')
            return cached_data['result']
        
        return None
    
    async def find_similar_ai_results(self, text: str, task_type: str, 
                                     similarity_threshold: float = 0.8) -> List[Dict]:
        """
        Find similar cached AI results using text similarity
        """
        pattern = f"ai_result:*"
        keys = await self._get_keys_by_pattern(pattern)
        similar_results = []
        
        for key in keys:
            cached_data = await self.get(key)
            if cached_data and cached_data.get('task_type') == task_type:
                # Simple similarity check (can be enhanced with more sophisticated algorithms)
                similarity = self._calculate_text_similarity(
                    text, cached_data.get('original_text', '')
                )
                
                if similarity >= similarity_threshold:
                    similar_results.append({
                        'result': cached_data['result'],
                        'similarity': similarity,
                        'cache_key': key
                    })
        
        # Sort by similarity
        similar_results.sort(key=lambda x: x['similarity'], reverse=True)
        return similar_results[:5]  # Return top 5 similar results
    
    async def invalidate_user_cache(self, user_id: int):
        """
        Invalidate all cache entries for a specific user
        """
        patterns = [
            f"user_notes:{user_id}:*",
            f"user_session:{user_id}:*",
            f"user_files:{user_id}:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            deleted = await self.delete_pattern(pattern)
            total_deleted += deleted
        
        logger.info(f"Invalidated {total_deleted} cache entries for user {user_id}")
        return total_deleted
    
    async def get_cache_stats(self) -> Dict:
        """
        Get cache performance statistics
        """
        try:
            redis_info = self.redis_client.info('memory')
            redis_keys = len(self.redis_client.keys('*'))
            
            return {
                'redis_memory_used': redis_info.get('used_memory_human', 'Unknown'),
                'redis_keys_count': redis_keys,
                'redis_connected': True,
                'cache_hit_ratio': self._calculate_hit_ratio(),
                'cache_size_mb': redis_info.get('used_memory', 0) / (1024 * 1024)
            }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {
                'redis_connected': False,
                'error': str(e)
            }
    
    async def cleanup_expired_cache(self):
        """
        Clean up expired cache entries
        """
        try:
            # Redis handles TTL automatically, but we can clean up Django cache
            # This is a placeholder for custom cleanup logic
            logger.info("Cache cleanup completed")
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")
    
    # Private methods
    
    async def _get_from_redis(self, key: str) -> Optional[str]:
        """Get value from Redis"""
        try:
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    async def _set_to_redis(self, key: str, value: str, ttl: int) -> bool:
        """Set value in Redis"""
        try:
            return self.redis_client.setex(key, ttl, value)
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    async def _set_to_redis_compressed(self, key: str, value: str, ttl: int) -> bool:
        """Set compressed value in Redis"""
        try:
            import gzip
            compressed_value = gzip.compress(value.encode('utf-8'))
            return self.redis_client.setex(f"{key}:compressed", ttl, compressed_value)
        except Exception as e:
            logger.error(f"Redis compressed set error: {e}")
            return False
    
    async def _delete_from_redis(self, key: str) -> bool:
        """Delete key from Redis"""
        try:
            self.redis_client.delete(key)
            self.redis_client.delete(f"{key}:compressed")  # Also delete compressed version
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    async def _get_keys_by_pattern(self, pattern: str) -> List[str]:
        """Get keys matching pattern from Redis"""
        try:
            return self.redis_client.keys(pattern)
        except Exception as e:
            logger.error(f"Redis keys pattern error: {e}")
            return []
    
    def _serialize_data(self, data: Any) -> str:
        """Serialize data to JSON string"""
        return json.dumps(data, cls=DjangoJSONEncoder)
    
    def _deserialize_data(self, data: str) -> Any:
        """Deserialize JSON string to data"""
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return data
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple text similarity"""
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union)
    
    def _calculate_hit_ratio(self) -> float:
        """Calculate cache hit ratio"""
        try:
            info = self.redis_client.info('stats')
            hits = info.get('keyspace_hits', 0)
            misses = info.get('keyspace_misses', 0)
            
            if hits + misses == 0:
                return 0.0
            
            return hits / (hits + misses)
        except Exception:
            return 0.0

# Global cache service instance
cache_service = EnhancedCacheService()
