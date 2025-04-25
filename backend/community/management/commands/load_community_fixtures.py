"""
加载社区初始数据命令
"""

import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings

class Command(BaseCommand):
    help = '加载社区初始数据'
    
    def handle(self, *args, **options):
        fixtures_dir = os.path.join(settings.BASE_DIR, 'community', 'fixtures')
        
        # 加载分类
        self.stdout.write(self.style.NOTICE('正在加载分类...'))
        call_command('loaddata', os.path.join(fixtures_dir, 'categories.json'))
        
        # 加载标签
        self.stdout.write(self.style.NOTICE('正在加载标签...'))
        call_command('loaddata', os.path.join(fixtures_dir, 'tags.json'))
        
        self.stdout.write(self.style.SUCCESS('社区初始数据加载完成！'))
