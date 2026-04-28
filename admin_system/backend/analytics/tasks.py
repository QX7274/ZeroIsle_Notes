from celery import shared_task
from celery.schedules import crontab
from django.utils import timezone
from datetime import timedelta
from .models import AnalyticsReport
from .services import analytics_service
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_report_task(report_id):
    """异步生成分析报表的Celery任务"""
    try:
        report = AnalyticsReport.objects.get(id=report_id)
        report.status = 'PENDING'
        report.save()

        # 生成报表数据
        result_data = analytics_service.generate_report(report.report_type, report.parameters)

        if 'error' in result_data:
            report.status = 'FAILURE'
            report.error_message = result_data['error']
        else:
            report.result_data = result_data
            report.status = 'SUCCESS'

        report.save()
        logger.info(f"报表生成成功: {report_id}")

    except AnalyticsReport.DoesNotExist:
        logger.error(f"报表不存在: {report_id}")
    except Exception as e:
        logger.error(f"报表生成失败: {report_id}, 错误: {str(e)}")
        try:
            report = AnalyticsReport.objects.get(id=report_id)
            report.status = 'FAILURE'
            report.error_message = str(e)
            report.save()
        except AnalyticsReport.DoesNotExist:
            pass

@shared_task
def schedule_periodic_reports():
    """定期检查并触发需要生成的报表"""
    now = timezone.now()
    reports_to_run = AnalyticsReport.objects.filter(
        is_scheduled=True,
        next_run_at__lte=now
    )

    for report in reports_to_run:
        logger.info(f"触发调度报表: {report.id}")
        generate_report_task.delay(str(report.id))

        # 计算下次运行时间
        if report.schedule_frequency == 'daily':
            report.next_run_at = now + timedelta(days=1)
        elif report.schedule_frequency == 'weekly':
            report.next_run_at = now + timedelta(weeks=1)
        elif report.schedule_frequency == 'monthly':
            # 简单的月度计算，可以根据需要改进
            report.next_run_at = now + timedelta(days=30)

        report.save()

