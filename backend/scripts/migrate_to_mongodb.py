"""
数据迁移脚本
将Django ORM数据迁移到MongoDB
"""

import os
import sys
import django
import logging
import uuid
from datetime import datetime
from django.utils import timezone

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.development')
django.setup()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('migration.log')
    ]
)
logger = logging.getLogger(__name__)

def migrate_users():
    """迁移用户数据"""
    try:
        from django.contrib.auth import get_user_model
        from users.mongodb_models import User as MongoUser
        
        DjangoUser = get_user_model()
        
        # 获取所有Django用户
        django_users = DjangoUser.objects.all()
        logger.info(f"找到 {len(django_users)} 个用户需要迁移")
        
        # 迁移每个用户
        for django_user in django_users:
            # 检查是否已存在
            existing_user = MongoUser.objects(username=django_user.username).first()
            if existing_user:
                logger.info(f"用户 {django_user.username} 已存在，跳过")
                continue
            
            # 创建MongoDB用户
            mongo_user = MongoUser(
                id=uuid.UUID(str(django_user.id)) if isinstance(django_user.id, uuid.UUID) else uuid.uuid4(),
                username=django_user.username,
                email=django_user.email,
                password=django_user.password,
                first_name=django_user.first_name,
                last_name=django_user.last_name,
                is_active=django_user.is_active,
                is_staff=django_user.is_staff,
                is_superuser=django_user.is_superuser,
                date_joined=django_user.date_joined,
                last_login=django_user.last_login
            )
            
            # 保存用户
            mongo_user.save()
            logger.info(f"用户 {django_user.username} 迁移成功")
        
        logger.info("用户迁移完成")
        return True
    except Exception as e:
        logger.error(f"用户迁移失败: {str(e)}")
        return False

def migrate_notes():
    """迁移笔记数据"""
    try:
        from notes.models import Note as DjangoNote
        from notes.mongodb_models import Note as MongoNote
        from users.mongodb_models import User as MongoUser
        
        # 获取所有Django笔记
        django_notes = DjangoNote.objects.all()
        logger.info(f"找到 {len(django_notes)} 个笔记需要迁移")
        
        # 迁移每个笔记
        for django_note in django_notes:
            # 检查是否已存在
            existing_note = MongoNote.objects(id=uuid.UUID(str(django_note.id))).first()
            if existing_note:
                logger.info(f"笔记 {django_note.title} 已存在，跳过")
                continue
            
            # 获取MongoDB用户
            mongo_user = MongoUser.objects(username=django_note.user.username).first()
            if not mongo_user:
                logger.warning(f"笔记 {django_note.title} 的用户 {django_note.user.username} 不存在，跳过")
                continue
            
            # 创建MongoDB笔记
            mongo_note = MongoNote(
                id=uuid.UUID(str(django_note.id)),
                user=mongo_user,
                title=django_note.title,
                content=django_note.content,
                is_favorite=django_note.is_favorite if hasattr(django_note, 'is_favorite') else False,
                is_public=django_note.is_public if hasattr(django_note, 'is_public') else False,
                is_deleted=django_note.is_deleted if hasattr(django_note, 'is_deleted') else False,
                created_at=django_note.created_at,
                updated_at=django_note.updated_at
            )
            
            # 保存笔记
            mongo_note.save()
            logger.info(f"笔记 {django_note.title} 迁移成功")
        
        logger.info("笔记迁移完成")
        return True
    except Exception as e:
        logger.error(f"笔记迁移失败: {str(e)}")
        return False

def migrate_reminders():
    """迁移提醒数据"""
    try:
        from reminder.models import Reminder as DjangoReminder
        from reminder.mongodb_models import Reminder as MongoReminder
        from users.mongodb_models import User as MongoUser
        from notes.mongodb_models import Note as MongoNote
        
        # 获取所有Django提醒
        django_reminders = DjangoReminder.objects.all()
        logger.info(f"找到 {len(django_reminders)} 个提醒需要迁移")
        
        # 迁移每个提醒
        for django_reminder in django_reminders:
            # 检查是否已存在
            existing_reminder = MongoReminder.objects(id=uuid.UUID(str(django_reminder.id))).first()
            if existing_reminder:
                logger.info(f"提醒 {django_reminder.title} 已存在，跳过")
                continue
            
            # 获取MongoDB用户
            mongo_user = MongoUser.objects(username=django_reminder.user.username).first()
            if not mongo_user:
                logger.warning(f"提醒 {django_reminder.title} 的用户 {django_reminder.user.username} 不存在，跳过")
                continue
            
            # 获取MongoDB笔记（如果有）
            mongo_note = None
            if django_reminder.note:
                mongo_note = MongoNote.objects(id=uuid.UUID(str(django_reminder.note.id))).first()
                if not mongo_note:
                    logger.warning(f"提醒 {django_reminder.title} 的笔记 {django_reminder.note.id} 不存在")
            
            # 创建MongoDB提醒
            mongo_reminder = MongoReminder(
                id=uuid.UUID(str(django_reminder.id)),
                user=mongo_user,
                title=django_reminder.title,
                description=django_reminder.content if hasattr(django_reminder, 'content') else '',
                due_date=django_reminder.reminder_time if hasattr(django_reminder, 'reminder_time') else timezone.now(),
                priority='medium',
                frequency='once',
                is_completed=django_reminder.status == 'completed' if hasattr(django_reminder, 'status') else False,
                is_enabled=True,
                note=mongo_note,
                created_at=django_reminder.created_at,
                updated_at=django_reminder.updated_at
            )
            
            # 保存提醒
            mongo_reminder.save()
            logger.info(f"提醒 {django_reminder.title} 迁移成功")
        
        logger.info("提醒迁移完成")
        return True
    except Exception as e:
        logger.error(f"提醒迁移失败: {str(e)}")
        return False

def migrate_notifications():
    """迁移通知数据"""
    try:
        # 尝试从不同模块导入通知模型
        notification_models = []
        
        # 从笔记模块导入
        try:
            from notes.models import Notification as NoteNotification
            notification_models.append(('note', NoteNotification))
        except ImportError:
            logger.info("笔记通知模型不存在，跳过")
        
        # 从社区模块导入
        try:
            from community.models import Notification as CommunityNotification
            notification_models.append(('community', CommunityNotification))
        except ImportError:
            logger.info("社区通知模型不存在，跳过")
        
        # 导入MongoDB通知模型
        from notification.mongodb_models import Notification as MongoNotification
        from users.mongodb_models import User as MongoUser
        
        # 迁移每种通知
        for source, DjangoNotification in notification_models:
            # 获取所有Django通知
            django_notifications = DjangoNotification.objects.all()
            logger.info(f"找到 {len(django_notifications)} 个{source}通知需要迁移")
            
            # 迁移每个通知
            for django_notification in django_notifications:
                # 生成新的UUID
                notification_id = uuid.uuid4()
                
                # 获取接收者
                recipient_field = 'user' if hasattr(django_notification, 'user') else 'recipient'
                recipient_username = getattr(getattr(django_notification, recipient_field), 'username', None)
                if not recipient_username:
                    logger.warning(f"通知 {notification_id} 的接收者不存在，跳过")
                    continue
                
                mongo_recipient = MongoUser.objects(username=recipient_username).first()
                if not mongo_recipient:
                    logger.warning(f"通知 {notification_id} 的接收者 {recipient_username} 不存在，跳过")
                    continue
                
                # 获取发送者（如果有）
                mongo_sender = None
                if hasattr(django_notification, 'sender') and django_notification.sender:
                    sender_username = django_notification.sender.username
                    mongo_sender = MongoUser.objects(username=sender_username).first()
                
                # 获取通知类型
                notification_type = 'system'
                if hasattr(django_notification, 'notification_type'):
                    notification_type = django_notification.notification_type
                elif hasattr(django_notification, 'type'):
                    notification_type = django_notification.type
                
                # 获取标题和内容
                title = getattr(django_notification, 'title', f"{source.capitalize()} Notification")
                message = ''
                if hasattr(django_notification, 'content'):
                    message = django_notification.content
                elif hasattr(django_notification, 'message'):
                    message = django_notification.message
                
                # 创建MongoDB通知
                mongo_notification = MongoNotification(
                    id=notification_id,
                    recipient=mongo_recipient,
                    sender=mongo_sender,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    is_read=getattr(django_notification, 'is_read', False),
                    created_at=getattr(django_notification, 'created_at', timezone.now())
                )
                
                # 保存通知
                mongo_notification.save()
                logger.info(f"{source}通知 {notification_id} 迁移成功")
            
            logger.info(f"{source}通知迁移完成")
        
        return True
    except Exception as e:
        logger.error(f"通知迁移失败: {str(e)}")
        return False

def migrate_all():
    """迁移所有数据"""
    logger.info("开始数据迁移...")
    
    # 迁移用户
    logger.info("开始迁移用户...")
    if migrate_users():
        logger.info("用户迁移成功")
    else:
        logger.error("用户迁移失败")
    
    # 迁移笔记
    logger.info("开始迁移笔记...")
    if migrate_notes():
        logger.info("笔记迁移成功")
    else:
        logger.error("笔记迁移失败")
    
    # 迁移提醒
    logger.info("开始迁移提醒...")
    if migrate_reminders():
        logger.info("提醒迁移成功")
    else:
        logger.error("提醒迁移失败")
    
    # 迁移通知
    logger.info("开始迁移通知...")
    if migrate_notifications():
        logger.info("通知迁移成功")
    else:
        logger.error("通知迁移失败")
    
    logger.info("数据迁移完成")

if __name__ == "__main__":
    migrate_all()
