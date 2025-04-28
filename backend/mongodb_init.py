"""
MongoDB数据库初始化脚本
用于创建MongoDB数据库、集合和索引
"""

import os
import sys
import django
from django.conf import settings
from pymongo import MongoClient, ASCENDING, DESCENDING
import logging

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def init_mongodb():
    """初始化MongoDB数据库"""
    try:
        # 从环境变量获取MongoDB连接信息
        mongo_host = os.environ.get('MONGO_HOST', 'localhost')
        mongo_port = int(os.environ.get('MONGO_PORT', 27017))
        mongo_user = os.environ.get('MONGO_USER', '')
        mongo_password = os.environ.get('MONGO_PASSWORD', '')
        mongo_db = os.environ.get('MONGO_DB', 'zeroislenotes')

        # 构建连接URI
        if mongo_user and mongo_password:
            mongo_uri = f"mongodb://{mongo_user}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{mongo_host}:{mongo_port}/{mongo_db}"

        # 连接MongoDB
        client = MongoClient(mongo_uri)
        db = client[mongo_db]

        logger.info(f"连接到MongoDB: {mongo_host}:{mongo_port}/{mongo_db}")

        # 创建集合和索引
        create_collections_and_indexes(db)

        logger.info("MongoDB初始化完成")

    except Exception as e:
        logger.error(f"MongoDB初始化失败: {str(e)}")
        raise

def create_collections_and_indexes(db):
    """创建集合和索引"""
    # 用户集合
    if 'users' not in db.list_collection_names():
        db.create_collection('users')
        logger.info("创建集合: users")

    users = db['users']
    users.create_index([('username', ASCENDING)], unique=True)
    users.create_index([('email', ASCENDING)], sparse=True)
    users.create_index([('phone', ASCENDING)], sparse=True)
    users.create_index([('wechat_openid', ASCENDING)], sparse=True)
    users.create_index([('qq_openid', ASCENDING)], sparse=True)
    users.create_index([('is_active', ASCENDING)])
    users.create_index([('date_joined', DESCENDING)])
    logger.info("创建用户集合索引")

    # 验证码集合
    if 'verification_codes' not in db.list_collection_names():
        db.create_collection('verification_codes')
        logger.info("创建集合: verification_codes")

    verification_codes = db['verification_codes']
    verification_codes.create_index([('user', ASCENDING), ('purpose', ASCENDING)])
    verification_codes.create_index([('code', ASCENDING)])
    verification_codes.create_index([('expires_at', ASCENDING)])
    verification_codes.create_index([('is_used', ASCENDING)])
    logger.info("创建验证码集合索引")

    # 用户资料集合
    if 'user_profiles' not in db.list_collection_names():
        db.create_collection('user_profiles')
        logger.info("创建集合: user_profiles")

    user_profiles = db['user_profiles']
    user_profiles.create_index([('user', ASCENDING)], unique=True)
    user_profiles.create_index([('nickname', ASCENDING)])
    user_profiles.create_index([('location', ASCENDING)])
    logger.info("创建用户资料集合索引")

    # 用户设置集合
    if 'user_settings' not in db.list_collection_names():
        db.create_collection('user_settings')
        logger.info("创建集合: user_settings")

    user_settings = db['user_settings']
    user_settings.create_index([('user', ASCENDING)], unique=True)
    logger.info("创建用户设置集合索引")

    # 分类集合
    if 'categories' not in db.list_collection_names():
        db.create_collection('categories')
        logger.info("创建集合: categories")

    categories = db['categories']
    categories.create_index([('user', ASCENDING)])
    categories.create_index([('parent', ASCENDING)])
    categories.create_index([('is_deleted', ASCENDING)])
    categories.create_index([('user', ASCENDING), ('name', ASCENDING)], unique=True)
    logger.info("创建分类集合索引")

    # 标签集合
    if 'tags' not in db.list_collection_names():
        db.create_collection('tags')
        logger.info("创建集合: tags")

    tags = db['tags']
    tags.create_index([('user', ASCENDING)])
    tags.create_index([('user', ASCENDING), ('name', ASCENDING)], unique=True)
    logger.info("创建标签集合索引")

    # 笔记集合
    if 'notes' not in db.list_collection_names():
        db.create_collection('notes')
        logger.info("创建集合: notes")

    notes = db['notes']
    notes.create_index([('user', ASCENDING)])
    notes.create_index([('category', ASCENDING)])
    notes.create_index([('is_deleted', ASCENDING)])
    notes.create_index([('is_favorite', ASCENDING)])
    notes.create_index([('is_public', ASCENDING)])
    notes.create_index([('created_at', DESCENDING)])
    notes.create_index([('updated_at', DESCENDING)])
    logger.info("创建笔记集合索引")

    # 笔记版本集合
    if 'note_versions' not in db.list_collection_names():
        db.create_collection('note_versions')
        logger.info("创建集合: note_versions")

    note_versions = db['note_versions']
    note_versions.create_index([('note', ASCENDING)])
    note_versions.create_index([('created_by', ASCENDING)])
    note_versions.create_index([('version_number', ASCENDING)])
    note_versions.create_index([('created_at', DESCENDING)])
    logger.info("创建笔记版本集合索引")

    # 笔记附件集合
    if 'note_attachments' not in db.list_collection_names():
        db.create_collection('note_attachments')
        logger.info("创建集合: note_attachments")

    note_attachments = db['note_attachments']
    note_attachments.create_index([('note', ASCENDING)])
    note_attachments.create_index([('user', ASCENDING)])
    note_attachments.create_index([('file_type', ASCENDING)])
    note_attachments.create_index([('is_deleted', ASCENDING)])
    note_attachments.create_index([('created_at', DESCENDING)])
    logger.info("创建笔记附件集合索引")

    # 笔记分享集合
    if 'note_shares' not in db.list_collection_names():
        db.create_collection('note_shares')
        logger.info("创建集合: note_shares")

    note_shares = db['note_shares']
    note_shares.create_index([('note', ASCENDING)])
    note_shares.create_index([('user', ASCENDING)])
    note_shares.create_index([('share_code', ASCENDING)])
    note_shares.create_index([('is_active', ASCENDING)])
    note_shares.create_index([('expires_at', ASCENDING)])
    note_shares.create_index([('created_at', DESCENDING)])
    logger.info("创建笔记分享集合索引")

    # 笔记提醒集合
    if 'note_reminders' not in db.list_collection_names():
        db.create_collection('note_reminders')
        logger.info("创建集合: note_reminders")

    note_reminders = db['note_reminders']
    note_reminders.create_index([('note', ASCENDING)])
    note_reminders.create_index([('user', ASCENDING)])
    note_reminders.create_index([('reminder_time', ASCENDING)])
    note_reminders.create_index([('is_completed', ASCENDING)])
    note_reminders.create_index([('is_deleted', ASCENDING)])
    note_reminders.create_index([('created_at', DESCENDING)])
    logger.info("创建笔记提醒集合索引")

    # 提醒集合
    if 'reminders' not in db.list_collection_names():
        db.create_collection('reminders')
        logger.info("创建集合: reminders")

    reminders = db['reminders']
    reminders.create_index([('user', ASCENDING)])
    reminders.create_index([('due_date', ASCENDING)])
    reminders.create_index([('is_completed', ASCENDING)])
    reminders.create_index([('is_enabled', ASCENDING)])
    reminders.create_index([('priority', ASCENDING)])
    reminders.create_index([('created_at', DESCENDING)])
    logger.info("创建提醒集合索引")

    # 提醒通知集合
    if 'reminder_notifications' not in db.list_collection_names():
        db.create_collection('reminder_notifications')
        logger.info("创建集合: reminder_notifications")

    reminder_notifications = db['reminder_notifications']
    reminder_notifications.create_index([('reminder', ASCENDING)])
    reminder_notifications.create_index([('scheduled_time', ASCENDING)])
    reminder_notifications.create_index([('status', ASCENDING)])
    reminder_notifications.create_index([('created_at', DESCENDING)])
    logger.info("创建提醒通知集合索引")

    # 通知集合
    if 'notifications' not in db.list_collection_names():
        db.create_collection('notifications')
        logger.info("创建集合: notifications")

    notifications = db['notifications']
    notifications.create_index([('recipient', ASCENDING)])
    notifications.create_index([('notification_type', ASCENDING)])
    notifications.create_index([('is_read', ASCENDING)])
    notifications.create_index([('created_at', DESCENDING)])
    logger.info("创建通知集合索引")

    # 社区帖子集合
    if 'community_posts' not in db.list_collection_names():
        db.create_collection('community_posts')
        logger.info("创建集合: community_posts")

    community_posts = db['community_posts']
    community_posts.create_index([('user', ASCENDING)])
    community_posts.create_index([('status', ASCENDING)])
    community_posts.create_index([('category', ASCENDING)])
    community_posts.create_index([('is_deleted', ASCENDING)])
    community_posts.create_index([('is_public', ASCENDING)])
    community_posts.create_index([('is_pinned', ASCENDING)])
    community_posts.create_index([('is_featured', ASCENDING)])
    community_posts.create_index([('published_at', DESCENDING)])
    community_posts.create_index([('created_at', DESCENDING)])
    logger.info("创建社区帖子集合索引")

    # 社区评论集合
    if 'community_comments' not in db.list_collection_names():
        db.create_collection('community_comments')
        logger.info("创建集合: community_comments")

    community_comments = db['community_comments']
    community_comments.create_index([('post', ASCENDING)])
    community_comments.create_index([('user', ASCENDING)])
    community_comments.create_index([('parent', ASCENDING)])
    community_comments.create_index([('status', ASCENDING)])
    community_comments.create_index([('created_at', DESCENDING)])
    logger.info("创建社区评论集合索引")

    # 社区分类集合
    if 'community_categories' not in db.list_collection_names():
        db.create_collection('community_categories')
        logger.info("创建集合: community_categories")

    community_categories = db['community_categories']
    community_categories.create_index([('slug', ASCENDING)], unique=True)
    community_categories.create_index([('is_active', ASCENDING)])
    logger.info("创建社区分类集合索引")

    # 社区标签集合
    if 'community_tags' not in db.list_collection_names():
        db.create_collection('community_tags')
        logger.info("创建集合: community_tags")

    community_tags = db['community_tags']
    community_tags.create_index([('slug', ASCENDING)], unique=True)
    community_tags.create_index([('is_active', ASCENDING)])
    logger.info("创建社区标签集合索引")

    # 知识图谱节点集合
    if 'knowledge_nodes' not in db.list_collection_names():
        db.create_collection('knowledge_nodes')
        logger.info("创建集合: knowledge_nodes")

    knowledge_nodes = db['knowledge_nodes']
    knowledge_nodes.create_index([('user', ASCENDING)])
    knowledge_nodes.create_index([('type', ASCENDING)])
    knowledge_nodes.create_index([('is_public', ASCENDING)])
    knowledge_nodes.create_index([('created_at', DESCENDING)])
    logger.info("创建知识图谱节点集合索引")

    # 知识图谱边集合
    if 'knowledge_edges' not in db.list_collection_names():
        db.create_collection('knowledge_edges')
        logger.info("创建集合: knowledge_edges")

    knowledge_edges = db['knowledge_edges']
    knowledge_edges.create_index([('user', ASCENDING)])
    knowledge_edges.create_index([('source', ASCENDING)])
    knowledge_edges.create_index([('target', ASCENDING)])
    knowledge_edges.create_index([('type', ASCENDING)])
    knowledge_edges.create_index([('created_at', DESCENDING)])
    logger.info("创建知识图谱边集合索引")

    # 知识图谱集合
    if 'knowledge_graphs' not in db.list_collection_names():
        db.create_collection('knowledge_graphs')
        logger.info("创建集合: knowledge_graphs")

    knowledge_graphs = db['knowledge_graphs']
    knowledge_graphs.create_index([('user', ASCENDING)])
    knowledge_graphs.create_index([('is_public', ASCENDING)])
    knowledge_graphs.create_index([('created_at', DESCENDING)])
    logger.info("创建知识图谱集合索引")

    # 搜索索引集合
    if 'search_indexes' not in db.list_collection_names():
        db.create_collection('search_indexes')
        logger.info("创建集合: search_indexes")

    search_indexes = db['search_indexes']
    search_indexes.create_index([('user', ASCENDING)])
    search_indexes.create_index([('index_type', ASCENDING)])
    search_indexes.create_index([('object_id', ASCENDING)])
    search_indexes.create_index([('created_at', DESCENDING)])
    logger.info("创建搜索索引集合索引")

    # AI助手对话集合
    if 'ai_conversations' not in db.list_collection_names():
        db.create_collection('ai_conversations')
        logger.info("创建集合: ai_conversations")

    ai_conversations = db['ai_conversations']
    ai_conversations.create_index([('user', ASCENDING)])
    ai_conversations.create_index([('is_pinned', ASCENDING)])
    ai_conversations.create_index([('is_deleted', ASCENDING)])
    ai_conversations.create_index([('created_at', DESCENDING)])
    logger.info("创建AI助手对话集合索引")

if __name__ == "__main__":
    init_mongodb()
