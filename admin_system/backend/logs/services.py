import logging
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone
from urllib.parse import quote_plus

from pymongo import MongoClient
from pymongo.errors import PyMongoError
from .models import AdminOperationLog, SystemLog

logger = logging.getLogger(__name__)

class LogService:
    """日志服务类，用于处理日志的同步和访问"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化日志服务"""
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
            encoded_user = quote_plus(str(self.mongo_user))
            encoded_password = quote_plus(str(self.mongo_password))
            mongo_uri = f"mongodb://{encoded_user}:{encoded_password}@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        return MongoClient(mongo_uri)

    def sync_admin_logs(self, incremental=True, last_sync_time=None):
        """同步管理员操作日志"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                try:
                    # last_sync_time 可能是 epoch 秒、字符串或 datetime
                    if isinstance(last_sync_time, str):
                        last_sync_time = int(last_sync_time)
                    if isinstance(last_sync_time, (int, float)):
                        last_dt = datetime.fromtimestamp(last_sync_time, tz=dt_timezone.utc)
                    else:
                        last_dt = last_sync_time
                    query["operation_time"] = {"$gt": last_dt}
                except Exception:
                    pass

            # 从主应用获取管理员操作日志数据
            admin_logs_collection = self.db["admin_operation_logs"]
            admin_logs = list(admin_logs_collection.find(query))

            # 处理管理员操作日志数据
            processed_count = 0
            for log_data in admin_logs:
                try:
                    # 检查日志是否已存在（按外部ID对账）
                    remote_id = str(log_data.get("_id"))
                    try:
                        log = AdminOperationLog.objects.get(external_id=remote_id)
                        # 已存在则跳过或可在此更新必要字段
                    except AdminOperationLog.DoesNotExist:
                        # 创建新日志，保存外部ID
                        AdminOperationLog(
                            external_id=remote_id,
                            admin_username=log_data.get("admin_username", ""),
                            ip_address=log_data.get("ip_address", ""),
                            module=log_data.get("module", ""),
                            action=log_data.get("action", "other"),
                            resource_id=log_data.get("resource_id", ""),
                            description=log_data.get("description", ""),
                            operation_time=log_data.get("operation_time", timezone.now())
                        ).save()

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理管理员操作日志数据时出错: {str(e)}")

            return {
                "total_logs": len(admin_logs),
                "processed_logs": processed_count
            }

        except Exception as e:
            logger.error(f"同步管理员操作日志数据时出错: {str(e)}")
            raise

    def sync_system_logs(self, incremental=True, last_sync_time=None):
        """同步系统日志"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                try:
                    if isinstance(last_sync_time, str):
                        last_sync_time = int(last_sync_time)
                    if isinstance(last_sync_time, (int, float)):
                        last_dt = datetime.fromtimestamp(last_sync_time, tz=dt_timezone.utc)
                    else:
                        last_dt = last_sync_time
                    query["timestamp"] = {"$gt": last_dt}
                except Exception:
                    pass

            # 从主应用获取系统日志数据
            system_logs_collection = self.db["system_logs"]
            system_logs = list(system_logs_collection.find(query))

            # 处理系统日志数据
            processed_count = 0
            for log_data in system_logs:
                try:
                    # 检查日志是否已存在（按外部ID对账）
                    remote_id = str(log_data.get("_id"))
                    try:
                        log = SystemLog.objects.get(external_id=remote_id)
                    except SystemLog.DoesNotExist:
                        # 创建新日志，保存外部ID
                        SystemLog(
                            external_id=remote_id,
                            level=log_data.get("level", "info"),
                            source=log_data.get("source", ""),
                            message=log_data.get("message", ""),
                            timestamp=log_data.get("timestamp", timezone.now())
                        ).save()

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理系统日志数据时出错: {str(e)}")

            return {
                "total_logs": len(system_logs),
                "processed_logs": processed_count
            }

        except Exception as e:
            logger.error(f"同步系统日志数据时出错: {str(e)}")
            raise

    def create_admin_log(self, admin_username, ip_address, module, action, resource_id=None, description=""):
        """创建管理员操作日志"""
        try:
            # 创建本地日志
            log = AdminOperationLog(
                admin_username=admin_username,
                ip_address=ip_address,
                module=module,
                action=action,
                resource_id=resource_id,
                description=description,
                operation_time=timezone.now()
            )
            log.save()

            # 同步到主应用
            try:
                admin_logs_collection = self.db["admin_operation_logs"]
                log_data = {
                    # 不指定 _id，让主库生成，回写 external_id
                    "admin_username": log.admin_username,
                    "ip_address": log.ip_address,
                    "module": log.module,
                    "action": log.action,
                    "resource_id": log.resource_id,
                    "description": log.description,
                    "operation_time": log.operation_time
                }
                res = admin_logs_collection.insert_one(log_data)
                try:
                    log.external_id = str(res.inserted_id)
                    log.save()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"同步管理员操作日志到主应用时出错: {str(e)}")

            return log
        except Exception as e:
            logger.error(f"创建管理员操作日志时出错: {str(e)}")
            raise

    def create_system_log(self, level, source, message):
        """创建系统日志"""
        try:
            # 创建本地日志
            log = SystemLog(
                level=level,
                source=source,
                message=message,
                timestamp=timezone.now()
            )
            log.save()

            # 同步到主应用
            try:
                system_logs_collection = self.db["system_logs"]
                log_data = {
                    # 不指定 _id，让主库生成，回写 external_id
                    "level": log.level,
                    "source": log.source,
                    "message": log.message,
                    "timestamp": log.timestamp
                }
                res = system_logs_collection.insert_one(log_data)
                try:
                    log.external_id = str(res.inserted_id)
                    log.save()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"同步系统日志到主应用时出错: {str(e)}")

            return log
        except Exception as e:
            logger.error(f"创建系统日志时出错: {str(e)}")
            raise

    def get_admin_logs(self, query=None, limit=10, skip=0, sort_by=None, sort_order=-1):
        """获取管理员操作日志列表"""
        try:
            admin_logs_collection = self.db["admin_operation_logs"]

            # 构建查询条件
            query = query or {}

            # 构建排序条件
            sort_options = {}
            if sort_by:
                sort_options[sort_by] = sort_order
            else:
                sort_options["operation_time"] = -1  # 默认按操作时间降序排序

            # 执行查询
            logs = list(admin_logs_collection.find(query).sort(list(sort_options.items())).skip(skip).limit(limit))

            # 获取总数
            total = admin_logs_collection.count_documents(query)

            return {
                "logs": logs,
                "total": total
            }

        except Exception as e:
            logger.error(f"获取管理员操作日志列表时出错: {str(e)}")
            return {
                "logs": [],
                "total": 0
            }

    def get_system_logs(self, query=None, limit=10, skip=0, sort_by=None, sort_order=-1):
        """获取系统日志列表"""
        try:
            system_logs_collection = self.db["system_logs"]

            # 构建查询条件
            query = query or {}

            # 构建排序条件
            sort_options = {}
            if sort_by:
                sort_options[sort_by] = sort_order
            else:
                sort_options["timestamp"] = -1  # 默认按时间戳降序排序

            # 执行查询
            logs = list(system_logs_collection.find(query).sort(list(sort_options.items())).skip(skip).limit(limit))

            # 获取总数
            total = system_logs_collection.count_documents(query)

            return {
                "logs": logs,
                "total": total
            }

        except Exception as e:
            logger.error(f"获取系统日志列表时出错: {str(e)}")
            return {
                "logs": [],
                "total": 0
            }

    def export_admin_logs(self, query=None, format="csv"):
        """导出管理员操作日志"""
        try:
            admin_logs_collection = self.db["admin_operation_logs"]

            # 构建查询条件
            query = query or {}

            # 执行查询
            logs = list(admin_logs_collection.find(query).sort([("operation_time", -1)]))

            return logs

        except Exception as e:
            logger.error(f"导出管理员操作日志时出错: {str(e)}")
            return []

    def export_system_logs(self, query=None, format="csv"):
        """导出系统日志"""
        try:
            system_logs_collection = self.db["system_logs"]

            # 构建查询条件
            query = query or {}

            # 执行查询
            logs = list(system_logs_collection.find(query).sort([("timestamp", -1)]))

            return logs

        except Exception as e:
            logger.error(f"导出系统日志时出错: {str(e)}")
            return []

# 创建日志服务单例
# 懒加载日志服务，避免模块导入阶段触发数据库连接
_log_service_instance = None


def get_log_service():
    global _log_service_instance
    if _log_service_instance is None:
        _log_service_instance = LogService()
    return _log_service_instance


class _LazyLogService:
    def __getattr__(self, item):
        return getattr(get_log_service(), item)


log_service = _LazyLogService()
