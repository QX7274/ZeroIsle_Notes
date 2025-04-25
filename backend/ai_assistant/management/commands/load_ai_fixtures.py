"""
加载AI助手初始数据命令
"""

import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings

class Command(BaseCommand):
    help = '加载AI助手初始数据'
    
    def handle(self, *args, **options):
        fixtures_dir = os.path.join(settings.BASE_DIR, 'ai_assistant', 'fixtures')
        
        # 加载模型配置
        self.stdout.write(self.style.NOTICE('正在加载模型配置...'))
        call_command('loaddata', os.path.join(fixtures_dir, 'model_configs.json'))
        
        # 加载提示词模板
        self.stdout.write(self.style.NOTICE('正在加载提示词模板...'))
        call_command('loaddata', os.path.join(fixtures_dir, 'prompt_templates.json'))
        
        self.stdout.write(self.style.SUCCESS('AI助手初始数据加载完成！'))
