import os
import json
import shutil
import zipfile
import tempfile
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from .models import SystemSetting, Announcement, SystemBackup

logger = logging.getLogger(__name__)

class SettingService:
    """设置服务类，用于处理系统设置的同步和访问"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化设置服务"""
        from django.conf import settings

        # 使用传入的参数或从设置中获取
        self.mongo_host = mongo_host or settings.MONGO_HOST
        self.mongo_port = mongo_port or settings.MONGO_PORT
        self.mongo_db = mongo_db or settings.MONGO_DB
        self.mongo_user = mongo_user or settings.MONGO_USER
        self.mongo_password = mongo_password or settings.MONGO_PASSWORD

        # 连接到MongoDB
        self.client = self._get_mongo_client()
        self.db = self.client[self.mongo_db]

    def _get_mongo_client(self):
        """获取MongoDB客户端连接"""
        if self.mongo_user and self.mongo_password:
            mongo_uri = f"mongodb://{self.mongo_user}:{self.mongo_password}@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        return MongoClient(mongo_uri)

    def sync_settings(self, incremental=True, last_sync_time=None):
        """同步系统设置"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取系统设置数据
            settings_collection = self.db["system_settings"]
            settings = list(settings_collection.find(query))

            # 处理系统设置数据
            processed_count = 0
            for setting_data in settings:
                try:
                    # 检查设置是否已存在
                    key = setting_data.get("key")
                    try:
                        setting = SystemSetting.objects.get(key=key)
                        # 更新现有设置
                        setting.value = setting_data.get("value", setting.value)
                        setting.description = setting_data.get("description", setting.description)
                        setting.updated_at = timezone.now()
                        setting.save()
                    except SystemSetting.DoesNotExist:
                        # 创建新设置
                        SystemSetting(
                            key=key,
                            value=setting_data.get("value", ""),
                            description=setting_data.get("description", f"{key}的配置值"),
                            created_at=setting_data.get("created_at", timezone.now()),
                            updated_at=timezone.now()
                        ).save()

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理系统设置数据时出错: {str(e)}")

            return {
                "total_settings": len(settings),
                "processed_settings": processed_count
            }

        except Exception as e:
            logger.error(f"同步系统设置数据时出错: {str(e)}")
            raise

    def sync_announcements(self, incremental=True, last_sync_time=None):
        """同步系统公告"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取系统公告数据
            announcements_collection = self.db["announcements"]
            announcements = list(announcements_collection.find(query))

            # 处理系统公告数据
            processed_count = 0
            for announcement_data in announcements:
                try:
                    # 检查公告是否已存在
                    announcement_id = str(announcement_data.get("_id"))
                    try:
                        announcement = Announcement.objects.get(id=announcement_id)
                        # 更新现有公告
                        announcement.title = announcement_data.get("title", announcement.title)
                        announcement.content = announcement_data.get("content", announcement.content)
                        announcement.status = announcement_data.get("status", announcement.status)
                        announcement.start_time = announcement_data.get("start_time", announcement.start_time)
                        announcement.end_time = announcement_data.get("end_time", announcement.end_time)
                        announcement.created_by = announcement_data.get("created_by", announcement.created_by)
                        announcement.updated_at = timezone.now()
                        announcement.save()
                    except Announcement.DoesNotExist:
                        # 创建新公告
                        Announcement(
                            id=announcement_id,
                            title=announcement_data.get("title", ""),
                            content=announcement_data.get("content", ""),
                            status=announcement_data.get("status", "draft"),
                            start_time=announcement_data.get("start_time", timezone.now()),
                            end_time=announcement_data.get("end_time", timezone.now() + timezone.timedelta(days=7)),
                            created_by=announcement_data.get("created_by", "system"),
                            created_at=announcement_data.get("created_at", timezone.now()),
                            updated_at=timezone.now()
                        ).save()

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理系统公告数据时出错: {str(e)}")

            return {
                "total_announcements": len(announcements),
                "processed_announcements": processed_count
            }

        except Exception as e:
            logger.error(f"同步系统公告数据时出错: {str(e)}")
            raise

    def update_setting_in_main_app(self, key, value, description=None):
        """在主应用中更新系统设置"""
        try:
            settings_collection = self.db["system_settings"]

            # 检查设置是否已存在
            setting = settings_collection.find_one({"key": key})

            if setting:
                # 更新现有设置
                result = settings_collection.update_one(
                    {"key": key},
                    {"$set": {
                        "value": value,
                        "description": description or setting.get("description", f"{key}的配置值"),
                        "updated_at": timezone.now()
                    }}
                )
                return result.modified_count > 0
            else:
                # 创建新设置
                result = settings_collection.insert_one({
                    "key": key,
                    "value": value,
                    "description": description or f"{key}的配置值",
                    "created_at": timezone.now(),
                    "updated_at": timezone.now()
                })
                return result.inserted_id is not None
        except Exception as e:
            logger.error(f"在主应用中更新系统设置时出错: {str(e)}")
            return False

    def update_announcement_in_main_app(self, announcement_id, announcement_data):
        """在主应用中更新系统公告"""
        try:
            announcements_collection = self.db["announcements"]

            # 更新公告
            result = announcements_collection.update_one(
                {"_id": announcement_id},
                {"$set": {
                    **announcement_data,
                    "updated_at": timezone.now()
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新系统公告时出错: {str(e)}")
            return False

    def get_all_users_from_main_app(self):
        """从主应用获取所有用户"""
        try:
            users_collection = self.db["users"]
            users = list(users_collection.find({}, {
                "_id": 1,
                "username": 1,
                "email": 1
            }))

            # 将ObjectId转换为字符串
            for user in users:
                if '_id' in user:
                    user['id'] = str(user.pop('_id'))

            return users
        except Exception as e:
            logger.error(f"从主应用获取所有用户时出错: {str(e)}")
            return []

    def get_users_by_groups_from_main_app(self, groups):
        """从主应用获取指定用户组的用户"""
        try:
            users_collection = self.db["users"]
            users = list(users_collection.find({"groups": {"$in": groups}}, {
                "_id": 1,
                "username": 1,
                "email": 1,
                "groups": 1
            }))

            # 将ObjectId转换为字符串
            for user in users:
                if '_id' in user:
                    user['id'] = str(user.pop('_id'))

            return users
        except Exception as e:
            logger.error(f"从主应用获取指定用户组的用户时出错: {str(e)}")
            return []

    def send_email_notification_to_main_app(self, users, notification_data):
        """向主应用发送邮件通知"""
        try:
            notifications_collection = self.db["notifications"]

            success_count = 0
            failed_count = 0

            for user in users:
                try:
                    # 创建通知记录
                    notification = {
                        "user_id": user.get('id'),
                        "type": "email",
                        "title": notification_data.get('title'),
                        "content": notification_data.get('content'),
                        "data": notification_data,
                        "status": "pending",
                        "created_at": timezone.now(),
                        "scheduled_at": timezone.now() + timedelta(hours=notification_data.get('notification_settings', {}).get('delay', 0))
                    }

                    result = notifications_collection.insert_one(notification)
                    if result.inserted_id:
                        success_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    logger.error(f"为用户 {user.get('username')} 创建邮件通知时出错: {str(e)}")
                    failed_count += 1

            return {
                'success': success_count,
                'failed': failed_count,
                'message': f'成功创建 {success_count} 条邮件通知，失败 {failed_count} 条'
            }
        except Exception as e:
            logger.error(f"向主应用发送邮件通知时出错: {str(e)}")
            raise

    def send_app_notification_to_main_app(self, users, notification_data):
        """向主应用发送应用内通知"""
        try:
            notifications_collection = self.db["notifications"]

            success_count = 0
            failed_count = 0

            for user in users:
                try:
                    # 创建通知记录
                    notification = {
                        "user_id": user.get('id'),
                        "type": "app",
                        "title": notification_data.get('title'),
                        "content": notification_data.get('content'),
                        "data": notification_data,
                        "status": "pending",
                        "created_at": timezone.now(),
                        "scheduled_at": timezone.now() + timedelta(hours=notification_data.get('notification_settings', {}).get('delay', 0))
                    }

                    result = notifications_collection.insert_one(notification)
                    if result.inserted_id:
                        success_count += 1
                    else:
                        failed_count += 1
                except Exception as e:
                    logger.error(f"为用户 {user.get('username')} 创建应用内通知时出错: {str(e)}")
                    failed_count += 1

            return {
                'success': success_count,
                'failed': failed_count,
                'message': f'成功创建 {success_count} 条应用内通知，失败 {failed_count} 条'
            }
        except Exception as e:
            logger.error(f"向主应用发送应用内通知时出错: {str(e)}")
            raise

    def delete_announcement_in_main_app(self, announcement_id):
        """在主应用中删除系统公告"""
        try:
            announcements_collection = self.db["announcements"]
            result = announcements_collection.delete_one({"_id": announcement_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"在主应用中删除系统公告时出错: {str(e)}")
            return False

# 创建设置服务单例
setting_service = SettingService()


class BackupService:
    """备份服务类，用于处理系统备份和恢复"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化备份服务"""
        from django.conf import settings

        # 使用传入的参数或从设置中获取
        self.mongo_host = mongo_host or settings.MONGO_HOST
        self.mongo_port = mongo_port or settings.MONGO_PORT
        self.mongo_db = mongo_db or settings.MONGO_DB
        self.mongo_user = mongo_user or settings.MONGO_USER
        self.mongo_password = mongo_password or settings.MONGO_PASSWORD

        # 备份目录
        self.backup_dir = os.path.join(settings.BASE_DIR, 'backups')
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)

        # 连接到MongoDB
        self.client = self._get_mongo_client()
        self.db = self.client[self.mongo_db]

    def _get_mongo_client(self):
        """获取MongoDB客户端连接"""
        if self.mongo_user and self.mongo_password:
            mongo_uri = f"mongodb://{self.mongo_user}:{self.mongo_password}@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        return MongoClient(mongo_uri)

    def create_backup(self, backup_obj):
        """创建备份"""
        try:
            # 更新备份状态
            backup_obj.status = 'running'
            backup_obj.save()

            # 根据备份类型执行不同的备份操作
            if backup_obj.backup_type == 'full':
                result = self._create_full_backup(backup_obj)
            elif backup_obj.backup_type == 'data':
                result = self._create_data_backup(backup_obj)
            elif backup_obj.backup_type == 'settings':
                result = self._create_settings_backup(backup_obj)
            elif backup_obj.backup_type == 'user':
                result = self._create_user_backup(backup_obj)
            elif backup_obj.backup_type == 'content':
                result = self._create_content_backup(backup_obj)
            else:
                raise ValueError(f"不支持的备份类型: {backup_obj.backup_type}")

            # 更新备份状态和文件信息
            backup_obj.status = 'completed'
            backup_obj.file_path = result['file_path']
            backup_obj.file_size = result['file_size']
            backup_obj.save()

            return {
                'status': 'success',
                'message': '备份创建成功',
                'backup_id': str(backup_obj.id)
            }

        except Exception as e:
            logger.error(f"创建备份失败: {str(e)}")

            # 更新备份状态
            backup_obj.status = 'failed'
            backup_obj.save()

            return {
                'status': 'error',
                'message': f"创建备份失败: {str(e)}"
            }

    def _create_full_backup(self, backup_obj):
        """创建完整备份"""
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        try:
            # 备份所有集合
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 获取所有集合
            collections = self.db.list_collection_names()

            # 备份每个集合
            for collection_name in collections:
                collection = self.db[collection_name]
                documents = list(collection.find({}))

                # 将ObjectId转换为字符串
                for doc in documents:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])

                # 保存到JSON文件
                collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                with open(collection_file, 'w', encoding='utf-8') as f:
                    json.dump(documents, f, ensure_ascii=False, indent=2)

            # 创建备份元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': backup_obj.created_at.isoformat(),
                'database': self.mongo_db,
                'collections': collections
            }

            # 保存元数据
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"full_backup_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据
                zipf.write(metadata_file, os.path.basename(metadata_file))

                # 添加集合数据
                for collection_name in collections:
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    zipf.write(collection_file, f"collections/{collection_name}.json")

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            return {
                'file_path': zip_path,
                'file_size': file_size
            }

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)

    def _create_data_backup(self, backup_obj):
        """创建数据备份"""
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        try:
            # 备份数据集合
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 数据相关的集合
            data_collections = [
                'notes', 'comments', 'attachments', 'categories', 'tags'
            ]

            # 备份每个集合
            for collection_name in data_collections:
                if collection_name in self.db.list_collection_names():
                    collection = self.db[collection_name]
                    documents = list(collection.find({}))

                    # 将ObjectId转换为字符串
                    for doc in documents:
                        if '_id' in doc:
                            doc['_id'] = str(doc['_id'])

                    # 保存到JSON文件
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    with open(collection_file, 'w', encoding='utf-8') as f:
                        json.dump(documents, f, ensure_ascii=False, indent=2)

            # 创建备份元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': backup_obj.created_at.isoformat(),
                'database': self.mongo_db,
                'collections': data_collections
            }

            # 保存元数据
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"data_backup_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据
                zipf.write(metadata_file, os.path.basename(metadata_file))

                # 添加集合数据
                for collection_name in data_collections:
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    if os.path.exists(collection_file):
                        zipf.write(collection_file, f"collections/{collection_name}.json")

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            return {
                'file_path': zip_path,
                'file_size': file_size
            }

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)

    def _create_settings_backup(self, backup_obj):
        """创建设置备份"""
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        try:
            # 备份设置集合
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 设置相关的集合
            settings_collections = [
                'system_settings', 'announcements'
            ]

            # 备份每个集合
            for collection_name in settings_collections:
                if collection_name in self.db.list_collection_names():
                    collection = self.db[collection_name]
                    documents = list(collection.find({}))

                    # 将ObjectId转换为字符串
                    for doc in documents:
                        if '_id' in doc:
                            doc['_id'] = str(doc['_id'])

                    # 保存到JSON文件
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    with open(collection_file, 'w', encoding='utf-8') as f:
                        json.dump(documents, f, ensure_ascii=False, indent=2)

            # 创建备份元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': backup_obj.created_at.isoformat(),
                'database': self.mongo_db,
                'collections': settings_collections
            }

            # 保存元数据
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"settings_backup_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据
                zipf.write(metadata_file, os.path.basename(metadata_file))

                # 添加集合数据
                for collection_name in settings_collections:
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    if os.path.exists(collection_file):
                        zipf.write(collection_file, f"collections/{collection_name}.json")

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            return {
                'file_path': zip_path,
                'file_size': file_size
            }

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)

    def _create_user_backup(self, backup_obj):
        """创建用户备份"""
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        try:
            # 备份用户集合
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 用户相关的集合
            user_collections = [
                'users', 'user_profiles', 'user_settings'
            ]

            # 备份每个集合
            for collection_name in user_collections:
                if collection_name in self.db.list_collection_names():
                    collection = self.db[collection_name]
                    documents = list(collection.find({}))

                    # 将ObjectId转换为字符串
                    for doc in documents:
                        if '_id' in doc:
                            doc['_id'] = str(doc['_id'])

                    # 保存到JSON文件
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    with open(collection_file, 'w', encoding='utf-8') as f:
                        json.dump(documents, f, ensure_ascii=False, indent=2)

            # 创建备份元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': backup_obj.created_at.isoformat(),
                'database': self.mongo_db,
                'collections': user_collections
            }

            # 保存元数据
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"user_backup_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据
                zipf.write(metadata_file, os.path.basename(metadata_file))

                # 添加集合数据
                for collection_name in user_collections:
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    if os.path.exists(collection_file):
                        zipf.write(collection_file, f"collections/{collection_name}.json")

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            return {
                'file_path': zip_path,
                'file_size': file_size
            }

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)

    def _create_content_backup(self, backup_obj):
        """创建内容备份"""
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        try:
            # 备份内容集合
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 内容相关的集合
            content_collections = [
                'notes', 'comments', 'attachments', 'categories', 'tags'
            ]

            # 备份每个集合
            for collection_name in content_collections:
                if collection_name in self.db.list_collection_names():
                    collection = self.db[collection_name]
                    documents = list(collection.find({}))

                    # 将ObjectId转换为字符串
                    for doc in documents:
                        if '_id' in doc:
                            doc['_id'] = str(doc['_id'])

                    # 保存到JSON文件
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    with open(collection_file, 'w', encoding='utf-8') as f:
                        json.dump(documents, f, ensure_ascii=False, indent=2)

            # 创建备份元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': backup_obj.created_at.isoformat(),
                'database': self.mongo_db,
                'collections': content_collections
            }

            # 保存元数据
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建ZIP文件
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            zip_filename = f"content_backup_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据
                zipf.write(metadata_file, os.path.basename(metadata_file))

                # 添加集合数据
                for collection_name in content_collections:
                    collection_file = os.path.join(collections_dir, f"{collection_name}.json")
                    if os.path.exists(collection_file):
                        zipf.write(collection_file, f"collections/{collection_name}.json")

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            return {
                'file_path': zip_path,
                'file_size': file_size
            }

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)

    def restore_backup(self, backup_obj):
        """恢复备份"""
        try:
            # 检查备份状态
            if backup_obj.status != 'completed':
                raise ValueError(f"备份状态不正确: {backup_obj.status}")

            # 检查备份文件是否存在
            if not backup_obj.file_path or not os.path.exists(backup_obj.file_path):
                raise ValueError("备份文件不存在")

            # 创建临时目录
            temp_dir = tempfile.mkdtemp()

            try:
                # 解压备份文件
                with zipfile.ZipFile(backup_obj.file_path, 'r') as zipf:
                    zipf.extractall(temp_dir)

                # 读取元数据
                metadata_file = os.path.join(temp_dir, 'metadata.json')
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)

                # 获取集合列表
                collections = metadata.get('collections', [])

                # 恢复每个集合
                for collection_name in collections:
                    collection_file = os.path.join(temp_dir, 'collections', f"{collection_name}.json")

                    if os.path.exists(collection_file):
                        with open(collection_file, 'r', encoding='utf-8') as f:
                            documents = json.load(f)

                        # 清空集合
                        self.db[collection_name].delete_many({})

                        # 插入文档
                        if documents:
                            self.db[collection_name].insert_many(documents)

                return {
                    'status': 'success',
                    'message': '备份恢复成功',
                    'collections': collections
                }

            finally:
                # 清理临时目录
                shutil.rmtree(temp_dir)

        except Exception as e:
            logger.error(f"恢复备份失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"恢复备份失败: {str(e)}"
            }

    def download_backup(self, backup_obj):
        """下载备份"""
        try:
            # 检查备份状态
            if backup_obj.status != 'completed':
                raise ValueError(f"备份状态不正确: {backup_obj.status}")

            # 检查备份文件是否存在
            if not backup_obj.file_path or not os.path.exists(backup_obj.file_path):
                raise ValueError("备份文件不存在")

            return {
                'status': 'success',
                'file_path': backup_obj.file_path,
                'file_name': os.path.basename(backup_obj.file_path)
            }

        except Exception as e:
            logger.error(f"下载备份失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"下载备份失败: {str(e)}"
            }

    def delete_backup(self, backup_obj):
        """删除备份"""
        try:
            # 删除备份文件
            if backup_obj.file_path and os.path.exists(backup_obj.file_path):
                os.remove(backup_obj.file_path)

            # 删除备份记录
            backup_obj.delete()

            return {
                'status': 'success',
                'message': '备份删除成功'
            }

        except Exception as e:
            logger.error(f"删除备份失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"删除备份失败: {str(e)}"
            }

    def get_backup_info(self, backup_obj):
        """获取备份信息"""
        try:
            # 检查备份文件是否存在
            if not backup_obj.file_path or not os.path.exists(backup_obj.file_path):
                return {
                    'status': 'error',
                    'message': "备份文件不存在"
                }

            # 创建临时目录
            temp_dir = tempfile.mkdtemp()

            try:
                # 解压元数据文件
                with zipfile.ZipFile(backup_obj.file_path, 'r') as zipf:
                    zipf.extract('metadata.json', temp_dir)

                # 读取元数据
                metadata_file = os.path.join(temp_dir, 'metadata.json')
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)

                return {
                    'status': 'success',
                    'metadata': metadata
                }

            finally:
                # 清理临时目录
                shutil.rmtree(temp_dir)

        except Exception as e:
            logger.error(f"获取备份信息失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"获取备份信息失败: {str(e)}"
            }

    def import_backup(self, backup_file, name, description, created_by):
        """导入备份"""
        try:
            # 创建临时目录
            temp_dir = tempfile.mkdtemp()

            try:
                # 保存上传的文件
                file_path = os.path.join(temp_dir, backup_file.name)
                with open(file_path, 'wb+') as destination:
                    for chunk in backup_file.chunks():
                        destination.write(chunk)

                # 验证备份文件
                try:
                    with zipfile.ZipFile(file_path, 'r') as zipf:
                        # 检查是否包含元数据文件
                        if 'metadata.json' not in zipf.namelist():
                            raise ValueError("无效的备份文件：缺少元数据文件")

                        # 解压元数据文件
                        zipf.extract('metadata.json', temp_dir)

                        # 读取元数据
                        metadata_file = os.path.join(temp_dir, 'metadata.json')
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)

                        # 检查元数据
                        if 'backup_type' not in metadata:
                            raise ValueError("无效的备份文件：元数据缺少备份类型")

                        if 'collections' not in metadata:
                            raise ValueError("无效的备份文件：元数据缺少集合信息")
                except zipfile.BadZipFile:
                    raise ValueError("无效的备份文件：不是有效的ZIP文件")

                # 创建备份目标路径
                timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
                backup_filename = f"imported_backup_{timestamp}.zip"
                backup_path = os.path.join(self.backup_dir, backup_filename)

                # 复制备份文件到备份目录
                shutil.copy2(file_path, backup_path)

                # 获取文件大小
                file_size = os.path.getsize(backup_path)

                # 创建备份记录
                from .models import SystemBackup
                backup = SystemBackup(
                    name=name,
                    description=description,
                    backup_type=metadata.get('backup_type', 'full'),
                    status='completed',
                    file_path=backup_path,
                    file_size=file_size,
                    created_by=created_by,
                    completed_at=timezone.now()
                )
                backup.save()

                return {
                    'status': 'success',
                    'message': '备份导入成功',
                    'backup_id': str(backup.id)
                }

            finally:
                # 清理临时目录
                shutil.rmtree(temp_dir)

        except Exception as e:
            logger.error(f"导入备份失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"导入备份失败: {str(e)}"
            }

# 创建备份服务单例
backup_service = BackupService()
