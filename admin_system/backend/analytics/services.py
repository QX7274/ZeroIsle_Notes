import logging
from django.utils import timezone
from datetime import timedelta
from urllib.parse import quote_plus
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import pandas as pd
import numpy as np
import json
import redis
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

class AnalyticsService:
    """分析服务类，用于处理数据分析和报表生成"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None, redis_host=None, redis_port=None, redis_db=None):
        """初始化分析服务"""
        from django.conf import settings

        # MongoDB 配置
        self.mongo_host = mongo_host or settings.MONGO_HOST
        self.mongo_port = mongo_port or settings.MONGO_PORT
        self.mongo_db = mongo_db or settings.MONGO_DB
        self.mongo_user = mongo_user or settings.MONGO_USER
        self.mongo_password = mongo_password or settings.MONGO_PASSWORD

        # Redis 配置（容错：settings 可能未定义 REDIS_*）
        self.redis_host = redis_host or getattr(settings, 'REDIS_HOST', '127.0.0.1')
        self.redis_port = redis_port or getattr(settings, 'REDIS_PORT', 6379)
        self.redis_db = redis_db or getattr(settings, 'REDIS_DB', 0)

        # 连接到MongoDB
        self.client = self._get_mongo_client()
        self.db = self.client[self.mongo_db]

        # 连接到Redis
        self.redis_client = redis.StrictRedis(host=self.redis_host, port=self.redis_port, db=self.redis_db, decode_responses=True)
    
    def _get_mongo_client(self):
        """获取MongoDB客户端连接（增加超时和重试配置）"""
        if self.mongo_user and self.mongo_password:
            encoded_user = quote_plus(str(self.mongo_user))
            encoded_password = quote_plus(str(self.mongo_password))
            mongo_uri = f"mongodb://{encoded_user}:{encoded_password}@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        # 增加超时和重试配置，提高稳健性
        return MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,  # 5秒内选择一个服务器
            socketTimeoutMS=5000,         # 5秒套接字超时
            connectTimeoutMS=5000,        # 5秒连接超时
            retryWrites=True              # 启用重试写入
        )
    
    def get_dashboard_data(self):
        """获取仪表盘数据（增加缓存逻辑）"""
        cache_key = "analytics:dashboard_data"
        try:
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                logger.info("从缓存中获取仪表盘数据")
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"从Redis获取缓存时出错: {e}")

        logger.info("从数据库中获取仪表盘数据")
        try:
            # 获取用户统计
            users_collection = self.db["users"]
            total_users = users_collection.count_documents({})
            active_users = users_collection.count_documents({"status": "active"})
            
            # 获取内容统计
            notes_collection = self.db["notes"]
            total_notes = notes_collection.count_documents({})
            published_notes = notes_collection.count_documents({"status": "published"})
            
            # 获取评论统计
            comments_collection = self.db["comments"]
            total_comments = comments_collection.count_documents({})
            
            # 获取附件统计
            attachments_collection = self.db["attachments"]
            total_attachments = attachments_collection.count_documents({})
            
            # 获取今日数据
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_users = users_collection.count_documents({"created_at": {"$gte": today}})
            today_notes = notes_collection.count_documents({"created_at": {"$gte": today}})
            today_comments = comments_collection.count_documents({"created_at": {"$gte": today}})
            
            # 获取增长趋势（重构为聚合查询）
            days = 30
            end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=days)

            def get_growth_trend(collection, date_field='created_at'):
                pipeline = [
                    {
                        '$match': {
                            date_field: {
                                '$gte': start_date,
                                '$lt': end_date + timedelta(days=1)
                            }
                        }
                    },
                    {
                        '$group': {
                            '_id': {
                                '$dateToString': { 'format': '%Y-%m-%d', 'date': f'${date_field}' }
                            },
                            'count': { '$sum': 1 }
                        }
                    },
                    {
                        '$sort': { '_id': 1 }
                    }
                ]
                result = list(collection.aggregate(pipeline))
                # 补全没有数据的日期
                result_dict = {item['_id']: item['count'] for item in result}
                date_range = [(start_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days + 1)]
                return [{'date': d, 'count': result_dict.get(d, 0)} for d in date_range]

            user_growth_data = get_growth_trend(users_collection)
            note_growth_data = get_growth_trend(notes_collection)
            comment_growth_data = get_growth_trend(comments_collection)
            
            # 组装仪表盘数据
            dashboard_data = {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "today_new": today_users
                },
                "notes": {
                    "total": total_notes,
                    "published": published_notes,
                    "today_new": today_notes
                },
                "comments": {
                    "total": total_comments,
                    "today_new": today_comments
                },
                "attachments": {
                    "total": total_attachments
                },
                "growth_trends": {
                    "users": user_growth_data,
                    "notes": note_growth_data,
                    "comments": comment_growth_data
                }
            }

            # 将数据存入缓存
            try:
                self.redis_client.set(cache_key, json.dumps(dashboard_data), ex=3600)  # 缓存1小时
                logger.info("仪表盘数据已存入缓存")
            except Exception as e:
                logger.error(f"向Redis存入缓存时出错: {e}")

            return dashboard_data
        
        except Exception as e:
            logger.error(f"获取仪表盘数据时出错: {str(e)}")
            return {
                "users": {"total": 0, "active": 0, "today_new": 0},
                "notes": {"total": 0, "published": 0, "today_new": 0},
                "comments": {"total": 0, "today_new": 0},
                "attachments": {"total": 0},
                "growth_trends": {
                    "users": [],
                    "notes": [],
                    "comments": []
                }
            }
    
    def get_user_analytics(self, start_date=None, end_date=None):
        """获取用户分析数据（重构为聚合查询）"""
        try:
            users_collection = self.db["users"]
            query = {}
            if start_date or end_date:
                query["created_at"] = {}
                if start_date:
                    query["created_at"]["$gte"] = start_date
                if end_date:
                    query["created_at"]["$lte"] = end_date

            # 使用聚合管道进行多维分析
            user_pipeline = [
                {'$match': query},
                {
                    '$facet': {
                        'total_users': [{'$count': 'count'}],
                        'registration_by_hour': [
                            {'$group': {'_id': {'$hour': '$created_at'}, 'count': {'$sum': 1}}},
                            {'$sort': {'_id': 1}}
                        ],
                        'status_distribution': [
                            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
                        ]
                    }
                }
            ]
            user_analytics = list(users_collection.aggregate(user_pipeline))[0]

            total_users = user_analytics['total_users'][0]['count'] if user_analytics['total_users'] else 0

            # 补全注册时间分布
            reg_by_hour_map = {item['_id']: item['count'] for item in user_analytics['registration_by_hour']}
            registration_hours = [{'hour': h, 'count': reg_by_hour_map.get(h, 0)} for h in range(24)]

            status_data = [{'status': item['_id'], 'count': item['count']} for item in user_analytics['status_distribution']]

            # 用户活跃度分析
            login_logs_collection = self.db["login_logs"]
            login_query = {}
            if start_date or end_date:
                login_query["login_time"] = {}
                if start_date:
                    login_query["login_time"]["$gte"] = start_date
                if end_date:
                    login_query["login_time"]["$lte"] = end_date

            login_pipeline = [
                {'$match': login_query},
                {'$group': {'_id': '$user_id', 'login_count': {'$sum': 1}}},
                {
                    '$bucket': {
                        'groupBy': '$login_count',
                        'boundaries': [1, 2, 3, 4, 5, 6, 11, 21, 51],
                        'default': '51+',
                        'output': {'count': {'$sum': 1}}
                    }
                }
            ]
            login_distribution = list(login_logs_collection.aggregate(login_pipeline))
            login_data = [{'category': str(item['_id']), 'count': item['count']} for item in login_distribution]

            # 返回用户分析数据
            return {
                "total_users": total_users,
                "registration_by_hour": registration_hours,
                "status_distribution": status_data,
                "login_distribution": login_data
            }
        
        except Exception as e:
            logger.error(f"获取用户分析数据时出错: {str(e)}")
            return {
                "total_users": 0,
                "registration_by_hour": [],
                "status_distribution": [],
                "login_distribution": []
            }
    
    def get_content_analytics(self, start_date=None, end_date=None):
        """获取内容分析数据（重构为聚合查询）"""
        try:
            notes_collection = self.db["notes"]
            query = {}
            if start_date or end_date:
                query["created_at"] = {}
                if start_date:
                    query["created_at"]["$gte"] = start_date
                if end_date:
                    query["created_at"]["$lte"] = end_date

            note_pipeline = [
                {'$match': query},
                {
                    '$facet': {
                        'total_notes': [{'$count': 'count'}],
                        'status_distribution': [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}],
                        'creation_by_hour': [{'$group': {'_id': {'$hour': '$created_at'}, 'count': {'$sum': 1}}}],
                        'length_distribution': [
                            {'$addFields': {'content_length': {'$strLenCP': '$content'}}},
                            {
                                '$bucket': {
                                    'groupBy': '$content_length',
                                    'boundaries': [0, 101, 501, 1001, 5001],
                                    'default': '5001+',
                                    'output': {'count': {'$sum': 1}}
                                }
                            }
                        ]
                    }
                }
            ]
            note_analytics = list(notes_collection.aggregate(note_pipeline))[0]

            total_notes = note_analytics['total_notes'][0]['count'] if note_analytics['total_notes'] else 0
            status_data = [{'status': item['_id'], 'count': item['count']} for item in note_analytics['status_distribution']]
            length_data = [{'category': str(item['_id']), 'count': item['count']} for item in note_analytics['length_distribution']]

            creation_by_hour_map = {item['_id']: item['count'] for item in note_analytics['creation_by_hour']}
            creation_hours = [{'hour': h, 'count': creation_by_hour_map.get(h, 0)} for h in range(24)]

            # 评论分析
            comments_collection = self.db["comments"]
            comment_query = {}
            if start_date or end_date:
                comment_query["created_at"] = {}
                if start_date:
                    comment_query["created_at"]["$gte"] = start_date
                if end_date:
                    comment_query["created_at"]["$lte"] = end_date

            comment_pipeline = [
                {'$match': comment_query},
                {
                    '$facet': {
                        'total_comments': [{'$count': 'count'}],
                        'comment_length_distribution': [
                            {'$addFields': {'content_length': {'$strLenCP': '$content'}}},
                            {
                                '$bucket': {
                                    'groupBy': '$content_length',
                                    'boundaries': [0, 11, 51, 101, 201],
                                    'default': '201+',
                                    'output': {'count': {'$sum': 1}}
                                }
                            }
                        ]
                    }
                }
            ]
            comment_analytics = list(comments_collection.aggregate(comment_pipeline))[0]

            total_comments = comment_analytics['total_comments'][0]['count'] if comment_analytics['total_comments'] else 0
            comment_length_data = [{'category': str(item['_id']), 'count': item['count']} for item in comment_analytics['comment_length_distribution']]

            return {
                "total_notes": total_notes,
                "total_comments": total_comments,
                "status_distribution": status_data,
                "length_distribution": length_data,
                "creation_by_hour": creation_hours,
                "comment_length_distribution": comment_length_data
            }
        
        except Exception as e:
            logger.error(f"获取内容分析数据时出错: {str(e)}")
            return {
                "total_notes": 0,
                "total_comments": 0,
                "status_distribution": [],
                "length_distribution": [],
                "creation_by_hour": [],
                "comment_length_distribution": []
            }
    
    def get_system_analytics(self, start_date=None, end_date=None):
        """获取系统分析数据（重构为聚合查询）"""
        try:
            # 系统日志分析
            system_logs_collection = self.db["system_logs"]
            query = {}
            if start_date or end_date:
                query["timestamp"] = {}
                if start_date:
                    query["timestamp"]["$gte"] = start_date
                if end_date:
                    query["timestamp"]["$lte"] = end_date

            system_log_pipeline = [
                {'$match': query},
                {
                    '$facet': {
                        'total_system_logs': [{'$count': 'count'}],
                        'level_distribution': [{'$group': {'_id': '$level', 'count': {'$sum': 1}}}],
                        'source_distribution': [{'$group': {'_id': '$source', 'count': {'$sum': 1}}}],
                        'time_distribution': [{'$group': {'_id': {'$hour': '$timestamp'}, 'count': {'$sum': 1}}}]
                    }
                }
            ]
            system_analytics = list(system_logs_collection.aggregate(system_log_pipeline))[0]

            total_system_logs = system_analytics['total_system_logs'][0]['count'] if system_analytics['total_system_logs'] else 0
            level_data = [{'level': item['_id'], 'count': item['count']} for item in system_analytics['level_distribution']]
            source_data = [{'source': item['_id'], 'count': item['count']} for item in system_analytics['source_distribution']]

            time_dist_map = {item['_id']: item['count'] for item in system_analytics['time_distribution']}
            time_data = [{'hour': h, 'count': time_dist_map.get(h, 0)} for h in range(24)]

            # 管理员操作日志分析
            admin_logs_collection = self.db["admin_operation_logs"]
            admin_query = {}
            if start_date or end_date:
                admin_query["operation_time"] = {}
                if start_date:
                    admin_query["operation_time"]["$gte"] = start_date
                if end_date:
                    admin_query["operation_time"]["$lte"] = end_date

            admin_log_pipeline = [
                {'$match': admin_query},
                {
                    '$facet': {
                        'total_admin_logs': [{'$count': 'count'}],
                        'action_distribution': [{'$group': {'_id': '$action', 'count': {'$sum': 1}}}],
                        'module_distribution': [{'$group': {'_id': '$module', 'count': {'$sum': 1}}}]
                    }
                }
            ]
            admin_analytics = list(admin_logs_collection.aggregate(admin_log_pipeline))[0]

            total_admin_logs = admin_analytics['total_admin_logs'][0]['count'] if admin_analytics['total_admin_logs'] else 0
            action_data = [{'action': item['_id'], 'count': item['count']} for item in admin_analytics['action_distribution']]
            module_data = [{'module': item['_id'], 'count': item['count']} for item in admin_analytics['module_distribution']]

            return {
                "total_system_logs": total_system_logs,
                "total_admin_logs": total_admin_logs,
                "level_distribution": level_data,
                "source_distribution": source_data,
                "time_distribution": time_data,
                "action_distribution": action_data,
                "module_distribution": module_data
            }
        
        except Exception as e:
            logger.error(f"获取系统分析数据时出错: {str(e)}")
            return {
                "total_system_logs": 0,
                "total_admin_logs": 0,
                "level_distribution": [],
                "source_distribution": [],
                "time_distribution": [],
                "action_distribution": [],
                "module_distribution": []
            }
    
    def generate_report(self, report_type, parameters=None):
        """生成报表"""
        try:
            parameters = parameters or {}
            start_date = parameters.get('start_date')
            end_date = parameters.get('end_date')
            
            if report_type == 'user':
                return self.get_user_analytics(start_date, end_date)
            elif report_type == 'content':
                return self.get_content_analytics(start_date, end_date)
            elif report_type == 'system':
                return self.get_system_analytics(start_date, end_date)
            elif report_type == 'dashboard':
                return self.get_dashboard_data()
            else:
                return {"error": f"不支持的报表类型: {report_type}"}
        
        except Exception as e:
            logger.error(f"生成报表时出错: {str(e)}")
            return {"error": f"生成报表失败: {str(e)}"}
    
    def export_report(self, report_data, export_format='csv'):
        """导出报表（增加CSV注入防护）"""
        def sanitize_csv_cell(cell_value):
            """防止CSV注入"""
            if isinstance(cell_value, str) and cell_value.startswith(('=', '+', '-', '@')):
                return f"'{cell_value}"
            return cell_value

        try:
            if export_format == 'csv':
                # 将报表数据转换为CSV格式
                csv_data = []
                if isinstance(report_data, dict):
                    for key, value in report_data.items():
                        if isinstance(value, list) and value and isinstance(value[0], dict):
                            df = pd.DataFrame(value)
                            # 翻译列名
                            df.columns = [_(col) for col in df.columns]
                            # 对整个DataFrame进行清理
                            for col in df.columns:
                                df[col] = df[col].apply(sanitize_csv_cell)
                            csv_data.append(f"# {key}")
                            csv_data.append(df.to_csv(index=False))
                        elif isinstance(value, dict):
                            csv_data.append(f"# {key}")
                            for sub_key, sub_value in value.items():
                                if isinstance(sub_value, list) and sub_value and isinstance(sub_value[0], dict):
                                    df = pd.DataFrame(sub_value)
                                    df.columns = [_(col) for col in df.columns]
                                    for col in df.columns:
                                        df[col] = df[col].apply(sanitize_csv_cell)
                                    csv_data.append(f"## {sub_key}")
                                    csv_data.append(df.to_csv(index=False))
                                else:
                                    csv_data.append(f"{sanitize_csv_cell(sub_key)},{sanitize_csv_cell(sub_value)}")
                        else:
                            csv_data.append(f"{sanitize_csv_cell(key)},{sanitize_csv_cell(value)}")

                return "\n".join(csv_data)

            elif export_format == 'json':
                # 将报表数据转换为JSON格式
                return json.dumps(report_data, ensure_ascii=False, indent=2)

            else:
                return f"不支持的导出格式: {export_format}"
        
        except Exception as e:
            logger.error(f"导出报表时出错: {str(e)}")
            return f"导出报表失败: {str(e)}"

# 懒加载分析服务，避免模块导入阶段触发数据库连接
_analytics_service_instance = None


def get_analytics_service():
    global _analytics_service_instance
    if _analytics_service_instance is None:
        _analytics_service_instance = AnalyticsService()
    return _analytics_service_instance


class _LazyAnalyticsService:
    def __getattr__(self, item):
        return getattr(get_analytics_service(), item)


analytics_service = _LazyAnalyticsService()
