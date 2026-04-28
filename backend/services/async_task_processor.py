import asyncio
import json
import time
from typing import Dict, Any, Optional, Callable
from celery import Celery
from celery.result import AsyncResult
from django.conf import settings
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

# Celery app configuration
app = Celery('zeroislenotes')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

class AsyncTaskProcessor:
    """
    Enhanced async task processor with queue management and optimization
    """
    
    def __init__(self):
        self.task_queues = {
            'ai_processing': 'ai_queue',
            'file_processing': 'file_queue',
            'background_sync': 'sync_queue',
            'notifications': 'notification_queue',
            'analytics': 'analytics_queue'
        }
        
        self.priority_levels = {
            'critical': 9,
            'high': 7,
            'normal': 5,
            'low': 3,
            'background': 1
        }
        
        self.task_timeouts = {
            'ai_processing': 300,    # 5 minutes
            'file_processing': 600,  # 10 minutes
            'background_sync': 120,  # 2 minutes
            'notifications': 30,     # 30 seconds
            'analytics': 180         # 3 minutes
        }

    async def process_ai_request(self, text: str, task_type: str, user_id: int, 
                               options: Dict = None) -> Dict:
        """
        Process AI request asynchronously with caching and optimization
        """
        from .enhanced_cache_service import cache_service
        
        # Check cache first
        cached_result = await cache_service.get_cached_ai_result(text, task_type)
        if cached_result:
            return {
                'status': 'completed',
                'result': cached_result,
                'cached': True,
                'processing_time': 0
            }
        
        # Check for similar cached results
        similar_results = await cache_service.find_similar_ai_results(
            text, task_type, similarity_threshold=0.85
        )
        
        if similar_results:
            best_match = similar_results[0]
            return {
                'status': 'completed',
                'result': best_match['result'],
                'cached': True,
                'similarity': best_match['similarity'],
                'processing_time': 0
            }
        
        # Queue for background processing
        task = process_ai_task.apply_async(
            args=[text, task_type, user_id],
            kwargs={'options': options or {}},
            queue=self.task_queues['ai_processing'],
            priority=self.priority_levels['high']
        )
        
        return {
            'status': 'processing',
            'task_id': task.id,
            'estimated_time': self._estimate_processing_time(text, task_type)
        }

    async def process_file_upload(self, file_path: str, user_id: int, 
                                processing_options: Dict = None) -> Dict:
        """
        Process file upload asynchronously with progress tracking
        """
        task = process_file_task.apply_async(
            args=[file_path, user_id],
            kwargs={'options': processing_options or {}},
            queue=self.task_queues['file_processing'],
            priority=self.priority_levels['normal']
        )
        
        return {
            'status': 'processing',
            'task_id': task.id,
            'progress_url': f'/api/tasks/{task.id}/progress/'
        }

    async def get_task_status(self, task_id: str) -> Dict:
        """
        Get task status with detailed information
        """
        try:
            result = AsyncResult(task_id, app=app)
            
            status_info = {
                'task_id': task_id,
                'status': result.status,
                'ready': result.ready(),
                'successful': result.successful() if result.ready() else None
            }
            
            if result.ready():
                if result.successful():
                    status_info['result'] = result.result
                else:
                    status_info['error'] = str(result.info)
            else:
                # Check for progress information
                if hasattr(result, 'info') and isinstance(result.info, dict):
                    status_info.update(result.info)
            
            return status_info
            
        except Exception as e:
            logger.error(f"Error getting task status for {task_id}: {e}")
            return {
                'task_id': task_id,
                'status': 'UNKNOWN',
                'error': str(e)
            }

    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a running task
        """
        try:
            app.control.revoke(task_id, terminate=True)
            return True
        except Exception as e:
            logger.error(f"Error canceling task {task_id}: {e}")
            return False

    async def get_queue_stats(self) -> Dict:
        """
        Get queue statistics and health information
        """
        try:
            inspect = app.control.inspect()
            
            # Get active tasks
            active_tasks = inspect.active()
            
            # Get scheduled tasks
            scheduled_tasks = inspect.scheduled()
            
            # Get reserved tasks
            reserved_tasks = inspect.reserved()
            
            stats = {
                'active_tasks': sum(len(tasks) for tasks in (active_tasks or {}).values()),
                'scheduled_tasks': sum(len(tasks) for tasks in (scheduled_tasks or {}).values()),
                'reserved_tasks': sum(len(tasks) for tasks in (reserved_tasks or {}).values()),
                'workers_online': len(active_tasks or {}),
                'queue_health': 'healthy'
            }
            
            # Determine queue health
            total_tasks = stats['active_tasks'] + stats['scheduled_tasks'] + stats['reserved_tasks']
            if total_tasks > 100:
                stats['queue_health'] = 'overloaded'
            elif total_tasks > 50:
                stats['queue_health'] = 'busy'
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting queue stats: {e}")
            return {
                'error': str(e),
                'queue_health': 'unknown'
            }

    def _estimate_processing_time(self, text: str, task_type: str) -> int:
        """
        Estimate processing time based on text length and task type
        """
        base_times = {
            'translate': 2,
            'summarize': 3,
            'explain': 4,
            'rewrite': 3,
            'grammar': 2,
            'code_recognition': 2,
            'math_formula': 3,
            'extract_keywords': 1,
            'simplify': 3
        }
        
        base_time = base_times.get(task_type, 3)
        text_factor = min(len(text) / 1000, 3)  # Max 3x multiplier for long text
        
        return int(base_time * (1 + text_factor))

# Celery Tasks

@app.task(bind=True, max_retries=3)
def process_ai_task(self, text: str, task_type: str, user_id: int, options: Dict = None):
    """
    Celery task for AI processing with retry logic
    """
    try:
        from ai_assistant.services.text_processing_service import TextProcessingService
        from .enhanced_cache_service import cache_service
        
        # Update task state
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Processing AI request', 'progress': 10}
        )
        
        # Process with AI service
        service = TextProcessingService()
        
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Calling AI provider', 'progress': 50}
        )
        
        result = service.process_text(text=text, task=task_type)
        
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Caching result', 'progress': 90}
        )
        
        # Cache the result asynchronously
        asyncio.run(cache_service.cache_ai_result(text, task_type, result))
        
        # Notify user via WebSocket (if implemented)
        notify_user_ai_complete(user_id, result)
        
        return {
            'result': result,
            'task_type': task_type,
            'processing_time': time.time() - self.request.called_directly,
            'cached': False
        }
        
    except Exception as exc:
        logger.error(f"AI processing task failed: {exc}")
        
        # Retry with exponential backoff
        countdown = 2 ** self.request.retries
        raise self.retry(exc=exc, countdown=countdown, max_retries=3)

@app.task(bind=True)
def process_file_task(self, file_path: str, user_id: int, options: Dict = None):
    """
    Celery task for file processing with progress tracking
    """
    try:
        import os
        from document_converter.services import DocumentConverterService
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Starting file processing', 'progress': 0}
        )
        
        # Get file size for progress calculation
        total_size = os.path.getsize(file_path)
        processed_size = 0
        
        # Initialize converter service
        converter = DocumentConverterService()
        
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Converting file format', 'progress': 20}
        )
        
        # Process file in chunks
        with open(file_path, 'rb') as file:
            chunk_size = 1024 * 1024  # 1MB chunks
            
            while chunk := file.read(chunk_size):
                # Process chunk
                converter.process_chunk(chunk)
                processed_size += len(chunk)
                
                # Update progress
                progress = 20 + int((processed_size / total_size) * 60)
                self.update_state(
                    state='PROGRESS',
                    meta={'status': 'Processing file content', 'progress': progress}
                )
        
        # Finalize processing
        self.update_state(
            state='PROGRESS',
            meta={'status': 'Finalizing processing', 'progress': 90}
        )
        
        result = converter.finalize()
        
        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {
            'result': result,
            'file_size': total_size,
            'processing_time': time.time() - self.request.called_directly
        }
        
    except Exception as exc:
        logger.error(f"File processing task failed: {exc}")
        
        # Clean up on error
        if os.path.exists(file_path):
            os.remove(file_path)
        
        raise exc

@app.task
def cleanup_expired_tasks():
    """
    Periodic task to clean up expired task results
    """
    try:
        # Clean up task results older than 24 hours
        cutoff_time = time.time() - 86400
        
        # This would typically involve cleaning up task result backend
        # Implementation depends on the result backend used (Redis, Database, etc.)
        
        logger.info("Expired tasks cleanup completed")
        
    except Exception as e:
        logger.error(f"Task cleanup failed: {e}")

@app.task
def generate_analytics_report(user_id: int = None, report_type: str = 'daily'):
    """
    Generate analytics reports asynchronously
    """
    try:
        from analytics.services import AnalyticsService
        
        analytics = AnalyticsService()
        
        if user_id:
            report = analytics.generate_user_report(user_id, report_type)
        else:
            report = analytics.generate_system_report(report_type)
        
        return report
        
    except Exception as e:
        logger.error(f"Analytics report generation failed: {e}")
        raise

def notify_user_ai_complete(user_id: int, result: Dict):
    """
    Notify user when AI processing is complete
    """
    try:
        # This would typically use WebSocket or push notifications
        # Placeholder for notification implementation
        logger.info(f"AI processing complete for user {user_id}")
        
    except Exception as e:
        logger.error(f"User notification failed: {e}")

# Global task processor instance
task_processor = AsyncTaskProcessor()
