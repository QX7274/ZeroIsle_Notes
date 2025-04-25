"""
加载语音识别初始数据命令
"""

import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings

class Command(BaseCommand):
    help = '加载语音识别初始数据'
    
    def handle(self, *args, **options):
        fixtures_dir = os.path.join(settings.BASE_DIR, 'voice_recognition', 'fixtures')
        
        # 加载语言
        self.stdout.write(self.style.NOTICE('正在加载语言...'))
        call_command('loaddata', os.path.join(fixtures_dir, 'languages.json'))
        
        self.stdout.write(self.style.SUCCESS('语音识别初始数据加载完成！'))
