"""
清理Django ORM数据和冗余文件
"""

import os
import sys
import shutil
import logging
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('cleanup.log')
    ]
)
logger = logging.getLogger(__name__)

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

def delete_migrations():
    """删除迁移文件"""
    logger.info("开始删除迁移文件...")
    
    # 需要保留的迁移文件目录
    keep_migrations = [
        os.path.join(BASE_DIR, 'users', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'notes', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'reminder', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'community', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'knowledge_graph', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'search', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'ai_assistant', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'voice_recognition', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'canvas', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'code', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'common', 'migrations', '__init__.py'),
        os.path.join(BASE_DIR, 'notification', 'migrations', '__init__.py'),
    ]
    
    # 创建migrations目录和__init__.py文件
    for init_file in keep_migrations:
        os.makedirs(os.path.dirname(init_file), exist_ok=True)
        if not os.path.exists(init_file):
            with open(init_file, 'w') as f:
                f.write('"""迁移文件初始化"""\n')
    
    # 遍历所有应用目录
    for app_dir in os.listdir(BASE_DIR):
        app_path = os.path.join(BASE_DIR, app_dir)
        
        # 检查是否是目录且包含migrations目录
        migrations_path = os.path.join(app_path, 'migrations')
        if os.path.isdir(app_path) and os.path.isdir(migrations_path):
            # 遍历migrations目录中的所有文件
            for migration_file in os.listdir(migrations_path):
                migration_file_path = os.path.join(migrations_path, migration_file)
                
                # 如果不是__init__.py文件，则删除
                if migration_file != '__init__.py' and os.path.isfile(migration_file_path):
                    try:
                        os.remove(migration_file_path)
                        logger.info(f"已删除迁移文件: {migration_file_path}")
                    except Exception as e:
                        logger.error(f"删除迁移文件失败: {migration_file_path}, 错误: {str(e)}")
    
    logger.info("迁移文件删除完成")

def delete_django_models():
    """删除Django ORM模型文件"""
    logger.info("开始删除Django ORM模型文件...")
    
    # 需要删除的Django ORM模型文件
    django_models = [
        # 提醒模块
        os.path.join(BASE_DIR, 'reminder', 'models.py'),
        os.path.join(BASE_DIR, 'reminder', 'models', 'reminder.py'),
        os.path.join(BASE_DIR, 'reminder', 'models', 'reminder_notification.py'),
        
        # 笔记模块
        os.path.join(BASE_DIR, 'notes', 'models', 'reminder.py'),
        os.path.join(BASE_DIR, 'notes', 'models', 'notification.py'),
        
        # 社区模块
        os.path.join(BASE_DIR, 'community', 'models', 'notification.py'),
        
        # 知识图谱模块
        os.path.join(BASE_DIR, 'knowledge_graph', 'models', 'node.py'),
        os.path.join(BASE_DIR, 'knowledge_graph', 'models', 'edge.py'),
        os.path.join(BASE_DIR, 'knowledge_graph', 'models', 'graph.py'),
    ]
    
    # 删除文件
    for model_file in django_models:
        if os.path.exists(model_file):
            try:
                os.remove(model_file)
                logger.info(f"已删除Django ORM模型文件: {model_file}")
            except Exception as e:
                logger.error(f"删除Django ORM模型文件失败: {model_file}, 错误: {str(e)}")
    
    logger.info("Django ORM模型文件删除完成")

def update_init_files():
    """更新__init__.py文件，移除对Django ORM模型的导入"""
    logger.info("开始更新__init__.py文件...")
    
    # 需要更新的__init__.py文件
    init_files = [
        os.path.join(BASE_DIR, 'reminder', 'models', '__init__.py'),
        os.path.join(BASE_DIR, 'notes', 'models', '__init__.py'),
        os.path.join(BASE_DIR, 'community', 'models', '__init__.py'),
        os.path.join(BASE_DIR, 'knowledge_graph', 'models', '__init__.py'),
    ]
    
    # 更新文件
    for init_file in init_files:
        if os.path.exists(init_file):
            try:
                # 读取文件内容
                with open(init_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 创建新内容
                new_content = '"""模型初始化文件"""\n'
                
                # 写入新内容
                with open(init_file, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                logger.info(f"已更新__init__.py文件: {init_file}")
            except Exception as e:
                logger.error(f"更新__init__.py文件失败: {init_file}, 错误: {str(e)}")
    
    logger.info("__init__.py文件更新完成")

def cleanup_all():
    """执行所有清理操作"""
    logger.info("开始清理Django ORM数据和冗余文件...")
    
    # 删除迁移文件
    delete_migrations()
    
    # 删除Django ORM模型文件
    delete_django_models()
    
    # 更新__init__.py文件
    update_init_files()
    
    logger.info("清理完成")

if __name__ == "__main__":
    cleanup_all()
