import logging
from django.utils import timezone
from datetime import timedelta
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import pandas as pd
import numpy as np
import json

logger = logging.getLogger(__name__)

class AnalyticsService:
    """分析服务类，用于处理数据分析和报表生成"""
    
    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化分析服务"""
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
    
    def get_dashboard_data(self):
        """获取仪表盘数据"""
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
            
            # 获取用户增长趋势
            days = 30
            end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=days)
            
            # 准备日期范围
            date_range = []
            current_date = start_date
            while current_date <= end_date:
                date_range.append(current_date)
                current_date += timedelta(days=1)
            
            # 查询每天新增用户数
            user_growth_data = []
            for date in date_range:
                next_date = date + timedelta(days=1)
                count = users_collection.count_documents({
                    "created_at": {"$gte": date, "$lt": next_date}
                })
                user_growth_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count
                })
            
            # 查询每天新增笔记数
            note_growth_data = []
            for date in date_range:
                next_date = date + timedelta(days=1)
                count = notes_collection.count_documents({
                    "created_at": {"$gte": date, "$lt": next_date}
                })
                note_growth_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count
                })
            
            # 查询每天新增评论数
            comment_growth_data = []
            for date in date_range:
                next_date = date + timedelta(days=1)
                count = comments_collection.count_documents({
                    "created_at": {"$gte": date, "$lt": next_date}
                })
                comment_growth_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count
                })
            
            # 返回仪表盘数据
            return {
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
        """获取用户分析数据"""
        try:
            users_collection = self.db["users"]
            
            # 构建查询条件
            query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                query["created_at"] = date_query
            
            # 获取用户数据
            users = list(users_collection.find(query))
            
            # 用户注册时间分布
            registration_by_hour = {}
            for user in users:
                created_at = user.get("created_at")
                if created_at:
                    hour = created_at.hour
                    registration_by_hour[hour] = registration_by_hour.get(hour, 0) + 1
            
            registration_hours = []
            for hour in range(24):
                registration_hours.append({
                    "hour": hour,
                    "count": registration_by_hour.get(hour, 0)
                })
            
            # 用户状态分布
            status_distribution = {}
            for user in users:
                status = user.get("status", "unknown")
                status_distribution[status] = status_distribution.get(status, 0) + 1
            
            status_data = []
            for status, count in status_distribution.items():
                status_data.append({
                    "status": status,
                    "count": count
                })
            
            # 用户活跃度分析
            login_logs_collection = self.db["login_logs"]
            login_query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                login_query["login_time"] = date_query
            
            login_logs = list(login_logs_collection.find(login_query))
            
            # 用户登录次数分布
            login_counts = {}
            for log in login_logs:
                user_id = log.get("user_id")
                if user_id:
                    login_counts[user_id] = login_counts.get(user_id, 0) + 1
            
            login_distribution = {}
            for count in login_counts.values():
                if count <= 5:
                    category = f"{count}次"
                elif count <= 10:
                    category = "6-10次"
                elif count <= 20:
                    category = "11-20次"
                elif count <= 50:
                    category = "21-50次"
                else:
                    category = "50次以上"
                
                login_distribution[category] = login_distribution.get(category, 0) + 1
            
            login_data = []
            for category, count in login_distribution.items():
                login_data.append({
                    "category": category,
                    "count": count
                })
            
            # 返回用户分析数据
            return {
                "total_users": len(users),
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
        """获取内容分析数据"""
        try:
            notes_collection = self.db["notes"]
            
            # 构建查询条件
            query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                query["created_at"] = date_query
            
            # 获取笔记数据
            notes = list(notes_collection.find(query))
            
            # 笔记状态分布
            status_distribution = {}
            for note in notes:
                status = note.get("status", "unknown")
                status_distribution[status] = status_distribution.get(status, 0) + 1
            
            status_data = []
            for status, count in status_distribution.items():
                status_data.append({
                    "status": status,
                    "count": count
                })
            
            # 笔记长度分布
            length_distribution = {}
            for note in notes:
                content = note.get("content", "")
                length = len(content)
                
                if length <= 100:
                    category = "100字以内"
                elif length <= 500:
                    category = "101-500字"
                elif length <= 1000:
                    category = "501-1000字"
                elif length <= 5000:
                    category = "1001-5000字"
                else:
                    category = "5000字以上"
                
                length_distribution[category] = length_distribution.get(category, 0) + 1
            
            length_data = []
            for category, count in length_distribution.items():
                length_data.append({
                    "category": category,
                    "count": count
                })
            
            # 笔记创建时间分布
            creation_by_hour = {}
            for note in notes:
                created_at = note.get("created_at")
                if created_at:
                    hour = created_at.hour
                    creation_by_hour[hour] = creation_by_hour.get(hour, 0) + 1
            
            creation_hours = []
            for hour in range(24):
                creation_hours.append({
                    "hour": hour,
                    "count": creation_by_hour.get(hour, 0)
                })
            
            # 获取评论数据
            comments_collection = self.db["comments"]
            comment_query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                comment_query["created_at"] = date_query
            
            comments = list(comments_collection.find(comment_query))
            
            # 评论长度分布
            comment_length_distribution = {}
            for comment in comments:
                content = comment.get("content", "")
                length = len(content)
                
                if length <= 10:
                    category = "10字以内"
                elif length <= 50:
                    category = "11-50字"
                elif length <= 100:
                    category = "51-100字"
                elif length <= 200:
                    category = "101-200字"
                else:
                    category = "200字以上"
                
                comment_length_distribution[category] = comment_length_distribution.get(category, 0) + 1
            
            comment_length_data = []
            for category, count in comment_length_distribution.items():
                comment_length_data.append({
                    "category": category,
                    "count": count
                })
            
            # 返回内容分析数据
            return {
                "total_notes": len(notes),
                "total_comments": len(comments),
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
        """获取系统分析数据"""
        try:
            # 获取系统日志数据
            system_logs_collection = self.db["system_logs"]
            
            # 构建查询条件
            query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                query["timestamp"] = date_query
            
            # 获取系统日志
            system_logs = list(system_logs_collection.find(query))
            
            # 日志级别分布
            level_distribution = {}
            for log in system_logs:
                level = log.get("level", "unknown")
                level_distribution[level] = level_distribution.get(level, 0) + 1
            
            level_data = []
            for level, count in level_distribution.items():
                level_data.append({
                    "level": level,
                    "count": count
                })
            
            # 日志来源分布
            source_distribution = {}
            for log in system_logs:
                source = log.get("source", "unknown")
                source_distribution[source] = source_distribution.get(source, 0) + 1
            
            source_data = []
            for source, count in source_distribution.items():
                source_data.append({
                    "source": source,
                    "count": count
                })
            
            # 日志时间分布
            time_distribution = {}
            for log in system_logs:
                timestamp = log.get("timestamp")
                if timestamp:
                    hour = timestamp.hour
                    time_distribution[hour] = time_distribution.get(hour, 0) + 1
            
            time_data = []
            for hour in range(24):
                time_data.append({
                    "hour": hour,
                    "count": time_distribution.get(hour, 0)
                })
            
            # 获取管理员操作日志
            admin_logs_collection = self.db["admin_operation_logs"]
            admin_query = {}
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query["$gte"] = start_date
                if end_date:
                    date_query["$lte"] = end_date
                admin_query["operation_time"] = date_query
            
            admin_logs = list(admin_logs_collection.find(admin_query))
            
            # 操作类型分布
            action_distribution = {}
            for log in admin_logs:
                action = log.get("action", "unknown")
                action_distribution[action] = action_distribution.get(action, 0) + 1
            
            action_data = []
            for action, count in action_distribution.items():
                action_data.append({
                    "action": action,
                    "count": count
                })
            
            # 模块分布
            module_distribution = {}
            for log in admin_logs:
                module = log.get("module", "unknown")
                module_distribution[module] = module_distribution.get(module, 0) + 1
            
            module_data = []
            for module, count in module_distribution.items():
                module_data.append({
                    "module": module,
                    "count": count
                })
            
            # 返回系统分析数据
            return {
                "total_system_logs": len(system_logs),
                "total_admin_logs": len(admin_logs),
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
        """导出报表"""
        try:
            if export_format == 'csv':
                # 将报表数据转换为CSV格式
                csv_data = []
                
                # 处理不同类型的报表数据
                if isinstance(report_data, dict):
                    for key, value in report_data.items():
                        if isinstance(value, list):
                            # 处理列表数据
                            if value and isinstance(value[0], dict):
                                df = pd.DataFrame(value)
                                csv_data.append(f"# {key}")
                                csv_data.append(df.to_csv(index=False))
                        elif isinstance(value, dict):
                            # 处理嵌套字典
                            csv_data.append(f"# {key}")
                            for sub_key, sub_value in value.items():
                                if isinstance(sub_value, list):
                                    if sub_value and isinstance(sub_value[0], dict):
                                        df = pd.DataFrame(sub_value)
                                        csv_data.append(f"## {sub_key}")
                                        csv_data.append(df.to_csv(index=False))
                                else:
                                    csv_data.append(f"{sub_key},{sub_value}")
                        else:
                            # 处理简单值
                            csv_data.append(f"{key},{value}")
                
                return "\n".join(csv_data)
            
            elif export_format == 'json':
                # 将报表数据转换为JSON格式
                return json.dumps(report_data, ensure_ascii=False, indent=2)
            
            else:
                return f"不支持的导出格式: {export_format}"
        
        except Exception as e:
            logger.error(f"导出报表时出错: {str(e)}")
            return f"导出报表失败: {str(e)}"

# 创建分析服务单例
analytics_service = AnalyticsService()
