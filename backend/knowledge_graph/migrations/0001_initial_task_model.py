# Generated migration for KGTask model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='KGTask',
            fields=[
                ('task_id', models.CharField(default=uuid.uuid4, help_text='任务唯一标识符', max_length=36, primary_key=True, serialize=False, unique=True)),
                ('task_type', models.CharField(choices=[('build', '构建'), ('import', '导入'), ('export', '导出'), ('analyze', '分析')], help_text='任务类型', max_length=20)),
                ('status', models.CharField(choices=[('pending', '待处理'), ('running', '运行中'), ('success', '成功'), ('failed', '失败'), ('partial', '部分成功')], default='pending', help_text='任务状态', max_length=20)),
                ('progress', models.IntegerField(default=0, help_text='进度百分比 (0-100)')),
                ('stats', models.JSONField(default=dict, help_text='任务统计信息 {nodes_added, edges_added, skipped, conflicts}')),
                ('errors', models.JSONField(default=list, help_text='任务错误列表 [{line, msg}]')),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='更新时间')),
                ('completed_at', models.DateTimeField(blank=True, help_text='完成时间', null=True)),
                ('user', models.ForeignKey(help_text='执行任务的用户', on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '知识图谱任务',
                'verbose_name_plural': '知识图谱任务',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='kgtask',
            index=models.Index(fields=['user', 'created_at'], name='knowledge_g_user_id_created_at_idx'),
        ),
        migrations.AddIndex(
            model_name='kgtask',
            index=models.Index(fields=['status'], name='knowledge_g_status_idx'),
        ),
        migrations.AddIndex(
            model_name='kgtask',
            index=models.Index(fields=['task_type'], name='knowledge_g_task_type_idx'),
        ),
    ]

