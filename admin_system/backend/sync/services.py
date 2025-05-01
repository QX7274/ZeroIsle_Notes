import uuid
import logging
import time
from datetime import datetime, timedelta
from django.utils import timezone
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from .models import SyncRecord, SyncConfig, SyncStatistics

logger = logging.getLogger(__name__)

class SyncService:
    """数据同步服务"""
    
    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化同步服务"""
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
    
    def start_sync(self, sync_type, sync_options=None, initiated_by="system"):
        """开始同步操作"""
        sync_id = f"sync_{uuid.uuid4().hex}"
        sync_options = sync_options or {}
        
        # 创建同步记录
        sync_record = SyncRecord(
            sync_id=sync_id,
            sync_type=sync_type,
            status="in_progress",
            start_time=timezone.now(),
            sync_options=sync_options,
            initiated_by=initiated_by
        )
        sync_record.save()
        
        logger.info(f"开始同步: {sync_id}, 类型: {sync_type}, 选项: {sync_options}")
        
        return sync_record
    
    def complete_sync(self, sync_id, status="completed", result_summary=None, error_message=None):
        """完成同步操作"""
        try:
            sync_record = SyncRecord.objects.get(sync_id=sync_id)
            end_time = timezone.now()
            
            # 计算持续时间
            duration = int((end_time - sync_record.start_time).total_seconds())
            
            # 更新同步记录
            sync_record.status = status
            sync_record.end_time = end_time
            sync_record.duration = duration
            sync_record.result_summary = result_summary or {}
            sync_record.error_message = error_message
            sync_record.save()
            
            # 更新同步统计
            self._update_sync_statistics(sync_record)
            
            logger.info(f"同步完成: {sync_id}, 状态: {status}, 持续时间: {duration}秒")
            
            return sync_record
        except SyncRecord.DoesNotExist:
            logger.error(f"同步记录不存在: {sync_id}")
            return None
        except Exception as e:
            logger.error(f"完成同步时出错: {str(e)}")
            return None
    
    def _update_sync_statistics(self, sync_record):
        """更新同步统计数据"""
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 获取或创建今天的统计记录
        try:
            stats = SyncStatistics.objects.get(date=today)
        except SyncStatistics.DoesNotExist:
            stats = SyncStatistics(date=today)
        
        # 更新统计数据
        stats.total_syncs += 1
        
        if sync_record.status == "completed":
            stats.successful_syncs += 1
        elif sync_record.status == "failed":
            stats.failed_syncs += 1
        
        # 更新平均同步时间
        if sync_record.duration:
            if stats.sync_duration_avg == 0:
                stats.sync_duration_avg = sync_record.duration
            else:
                stats.sync_duration_avg = (stats.sync_duration_avg * (stats.total_syncs - 1) + sync_record.duration) // stats.total_syncs
        
        # 更新同步类型统计
        sync_types = stats.sync_types or {}
        sync_types[sync_record.sync_type] = sync_types.get(sync_record.sync_type, 0) + 1
        stats.sync_types = sync_types
        
        # 保存统计数据
        stats.save()
    
    def sync_users(self, options=None):
        """同步用户数据"""
        options = options or {}
        sync_record = self.start_sync("users", options)
        
        try:
            # 获取上次同步时间
            last_sync_time = self._get_last_sync_time("users")
            
            # 查询条件
            query = {}
            if last_sync_time and options.get("incremental", True):
                query["updated_at"] = {"$gt": last_sync_time}
            
            # 从主应用获取用户数据
            users_collection = self.db["users"]
            users = list(users_collection.find(query))
            
            # 处理用户数据
            processed_count = 0
            for user in users:
                # 这里可以添加用户数据处理逻辑
                processed_count += 1
            
            # 更新最后同步时间
            self._update_last_sync_time("users")
            
            # 完成同步
            result_summary = {
                "total_users": len(users),
                "processed_users": processed_count
            }
            
            return self.complete_sync(sync_record.sync_id, "completed", result_summary)
        
        except Exception as e:
            logger.error(f"同步用户数据时出错: {str(e)}")
            return self.complete_sync(sync_record.sync_id, "failed", error_message=str(e))
    
    def sync_notes(self, options=None):
        """同步笔记数据"""
        options = options or {}
        sync_record = self.start_sync("notes", options)
        
        try:
            # 获取上次同步时间
            last_sync_time = self._get_last_sync_time("notes")
            
            # 查询条件
            query = {}
            if last_sync_time and options.get("incremental", True):
                query["updated_at"] = {"$gt": last_sync_time}
            
            # 从主应用获取笔记数据
            notes_collection = self.db["notes"]
            notes = list(notes_collection.find(query))
            
            # 处理笔记数据
            processed_count = 0
            for note in notes:
                # 这里可以添加笔记数据处理逻辑
                processed_count += 1
            
            # 更新最后同步时间
            self._update_last_sync_time("notes")
            
            # 完成同步
            result_summary = {
                "total_notes": len(notes),
                "processed_notes": processed_count
            }
            
            return self.complete_sync(sync_record.sync_id, "completed", result_summary)
        
        except Exception as e:
            logger.error(f"同步笔记数据时出错: {str(e)}")
            return self.complete_sync(sync_record.sync_id, "failed", error_message=str(e))
    
    def sync_categories(self, options=None):
        """同步分类数据"""
        options = options or {}
        sync_record = self.start_sync("categories", options)
        
        try:
            # 获取上次同步时间
            last_sync_time = self._get_last_sync_time("categories")
            
            # 查询条件
            query = {}
            if last_sync_time and options.get("incremental", True):
                query["updated_at"] = {"$gt": last_sync_time}
            
            # 从主应用获取分类数据
            categories_collection = self.db["categories"]
            categories = list(categories_collection.find(query))
            
            # 处理分类数据
            processed_count = 0
            for category in categories:
                # 这里可以添加分类数据处理逻辑
                processed_count += 1
            
            # 更新最后同步时间
            self._update_last_sync_time("categories")
            
            # 完成同步
            result_summary = {
                "total_categories": len(categories),
                "processed_categories": processed_count
            }
            
            return self.complete_sync(sync_record.sync_id, "completed", result_summary)
        
        except Exception as e:
            logger.error(f"同步分类数据时出错: {str(e)}")
            return self.complete_sync(sync_record.sync_id, "failed", error_message=str(e))
    
    def sync_tags(self, options=None):
        """同步标签数据"""
        options = options or {}
        sync_record = self.start_sync("tags", options)
        
        try:
            # 获取上次同步时间
            last_sync_time = self._get_last_sync_time("tags")
            
            # 查询条件
            query = {}
            if last_sync_time and options.get("incremental", True):
                query["updated_at"] = {"$gt": last_sync_time}
            
            # 从主应用获取标签数据
            tags_collection = self.db["tags"]
            tags = list(tags_collection.find(query))
            
            # 处理标签数据
            processed_count = 0
            for tag in tags:
                # 这里可以添加标签数据处理逻辑
                processed_count += 1
            
            # 更新最后同步时间
            self._update_last_sync_time("tags")
            
            # 完成同步
            result_summary = {
                "total_tags": len(tags),
                "processed_tags": processed_count
            }
            
            return self.complete_sync(sync_record.sync_id, "completed", result_summary)
        
        except Exception as e:
            logger.error(f"同步标签数据时出错: {str(e)}")
            return self.complete_sync(sync_record.sync_id, "failed", error_message=str(e))
    
    def sync_all(self, options=None):
        """同步所有数据"""
        options = options or {}
        sync_record = self.start_sync("full", options)
        
        try:
            # 同步用户
            users_result = self.sync_users(options)
            
            # 同步笔记
            notes_result = self.sync_notes(options)
            
            # 同步分类
            categories_result = self.sync_categories(options)
            
            # 同步标签
            tags_result = self.sync_tags(options)
            
            # 汇总结果
            result_summary = {
                "users": users_result.result_summary if users_result else {},
                "notes": notes_result.result_summary if notes_result else {},
                "categories": categories_result.result_summary if categories_result else {},
                "tags": tags_result.result_summary if tags_result else {}
            }
            
            # 检查是否有失败
            has_failed = (
                (users_result and users_result.status == "failed") or
                (notes_result and notes_result.status == "failed") or
                (categories_result and categories_result.status == "failed") or
                (tags_result and tags_result.status == "failed")
            )
            
            status = "failed" if has_failed else "completed"
            error_message = None
            
            if has_failed:
                error_messages = []
                if users_result and users_result.status == "failed":
                    error_messages.append(f"用户同步失败: {users_result.error_message}")
                if notes_result and notes_result.status == "failed":
                    error_messages.append(f"笔记同步失败: {notes_result.error_message}")
                if categories_result and categories_result.status == "failed":
                    error_messages.append(f"分类同步失败: {categories_result.error_message}")
                if tags_result and tags_result.status == "failed":
                    error_messages.append(f"标签同步失败: {tags_result.error_message}")
                
                error_message = "; ".join(error_messages)
            
            return self.complete_sync(sync_record.sync_id, status, result_summary, error_message)
        
        except Exception as e:
            logger.error(f"同步所有数据时出错: {str(e)}")
            return self.complete_sync(sync_record.sync_id, "failed", error_message=str(e))
    
    def _get_last_sync_time(self, sync_type):
        """获取上次同步时间"""
        try:
            config = SyncConfig.objects.get(key=f"last_sync_time_{sync_type}")
            return datetime.fromisoformat(config.value)
        except (SyncConfig.DoesNotExist, ValueError):
            return None
    
    def _update_last_sync_time(self, sync_type):
        """更新上次同步时间"""
        now = timezone.now().isoformat()
        
        try:
            config = SyncConfig.objects.get(key=f"last_sync_time_{sync_type}")
            config.value = now
            config.updated_at = timezone.now()
            config.save()
        except SyncConfig.DoesNotExist:
            config = SyncConfig(
                key=f"last_sync_time_{sync_type}",
                value=now,
                description=f"{sync_type}数据的最后同步时间"
            )
            config.save()
    
    def get_sync_status(self):
        """获取同步状态"""
        # 获取最近的同步记录
        latest_syncs = {}
        for sync_type in ["full", "users", "notes", "categories", "tags"]:
            try:
                latest = SyncRecord.objects.filter(sync_type=sync_type).order_by('-start_time').first()
                if latest:
                    latest_syncs[sync_type] = {
                        "sync_id": latest.sync_id,
                        "status": latest.status,
                        "start_time": latest.start_time,
                        "end_time": latest.end_time,
                        "duration": latest.duration
                    }
            except Exception:
                pass
        
        # 获取最后同步时间
        last_sync_times = {}
        for sync_type in ["users", "notes", "categories", "tags"]:
            last_time = self._get_last_sync_time(sync_type)
            if last_time:
                last_sync_times[sync_type] = last_time.isoformat()
        
        # 获取同步统计
        try:
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            stats = SyncStatistics.objects.get(date=today)
            sync_stats = {
                "total_syncs": stats.total_syncs,
                "successful_syncs": stats.successful_syncs,
                "failed_syncs": stats.failed_syncs,
                "sync_duration_avg": stats.sync_duration_avg
            }
        except SyncStatistics.DoesNotExist:
            sync_stats = {
                "total_syncs": 0,
                "successful_syncs": 0,
                "failed_syncs": 0,
                "sync_duration_avg": 0
            }
        
        # 获取数据统计
        data_stats = self.get_data_stats()
        
        return {
            "latest_syncs": latest_syncs,
            "last_sync_times": last_sync_times,
            "sync_stats": sync_stats,
            "data_stats": data_stats
        }
    
    def get_data_stats(self):
        """获取数据统计"""
        try:
            # 获取各集合的文档数量
            users_count = self.db["users"].count_documents({})
            notes_count = self.db["notes"].count_documents({})
            categories_count = self.db["categories"].count_documents({}) if "categories" in self.db.list_collection_names() else 0
            tags_count = self.db["tags"].count_documents({}) if "tags" in self.db.list_collection_names() else 0
            
            # 获取今日新增数据
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_users = self.db["users"].count_documents({"created_at": {"$gte": today}})
            today_notes = self.db["notes"].count_documents({"created_at": {"$gte": today}})
            
            return {
                "users": {
                    "total": users_count,
                    "today_new": today_users
                },
                "notes": {
                    "total": notes_count,
                    "today_new": today_notes
                },
                "categories": {
                    "total": categories_count
                },
                "tags": {
                    "total": tags_count
                }
            }
        except Exception as e:
            logger.error(f"获取数据统计时出错: {str(e)}")
            return {}

# 创建同步服务单例
sync_service = SyncService()
