import os
from celery import Celery
from django.conf import settings
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('backend')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Define queues for task routing
app.conf.task_queues = {
    'default': {
        'exchange': 'default',
        'routing_key': 'default',
    },
    'heavy_tasks': {
        'exchange': 'heavy_tasks',
        'routing_key': 'heavy_tasks',
    },
}
app.conf.task_default_queue = 'default'

# Route document converter tasks to the heavy_tasks queue
app.conf.task_routes = {
    'document_converter.tasks.*': {'queue': 'heavy_tasks'},
    'document_converter.periodic_tasks.*': {'queue': 'heavy_tasks'},
}

app.autodiscover_tasks()

# Define periodic tasks
app.conf.beat_schedule = {
    'schedule-periodic-reports': {
        'task': 'admin_system.backend.analytics.tasks.schedule_periodic_reports',
        'schedule': crontab(minute='*/15'),  # Check every 15 minutes
        'options': {'queue': 'default'}
    },
    'cleanup-docconv-caches-hourly': {
        'task': 'document_converter.cleanup_stale_caches',
        'schedule': crontab(minute='0'),  # every hour
        'options': {'queue': 'default'} # Run cleanup on default queue
    },
}
