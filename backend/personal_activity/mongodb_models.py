"""
Personal Activity Tracking MongoDB Models
个人活动记录MongoDB模型
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def _maybe_object_id(raw_value):
    """兼容旧数据：仅当值本身是合法 ObjectId 时才转换。"""
    if isinstance(raw_value, ObjectId):
        return raw_value
    if raw_value in (None, ''):
        return None
    try:
        return ObjectId(str(raw_value))
    except (InvalidId, TypeError, ValueError):
        return None


def _user_id_candidates(user_id: str):
    """
    统一个人活动模块的 user_id 口径。

    新数据使用字符串化后的 Mongo 用户 UUID；
    旧数据若曾写入 ObjectId，则查询时一并兼容。
    """
    candidates = [str(user_id)]
    legacy_object_id = _maybe_object_id(user_id)
    if legacy_object_id is not None:
        candidates.append(legacy_object_id)
    return candidates


def _user_id_query(user_id: str):
    candidates = _user_id_candidates(user_id)
    if len(candidates) == 1:
        return candidates[0]
    return {"$in": candidates}


def build_personal_activity_user_id_query(user_id: str):
    """供视图层直接查询 Mongo 集合时复用统一 user_id 口径。"""
    return _user_id_query(user_id)


def _serialize_user_id(raw_user_id):
    return str(raw_user_id) if raw_user_id is not None else None

class PersonalActivityModels:
    """个人活动记录模型管理类"""
    
    def __init__(self):
        """初始化MongoDB连接"""
        try:
            # 使用现有的MongoDB连接配置
            from mongodb_service import get_mongodb_connection
            self.db = get_mongodb_connection()
            
            # 创建集合索引
            self._create_indexes()
            
        except Exception as e:
            logger.error(f"MongoDB连接失败: {e}")
            self.db = None
    
    def _create_indexes(self):
        """创建数据库索引以优化查询性能"""
        try:
            # 活动记录集合索引
            activities = self.db.personal_activities
            activities.create_index([("user_id", 1), ("created_at", -1)])
            activities.create_index([("user_id", 1), ("category.id", 1)])
            activities.create_index([("user_id", 1), ("status", 1)])
            activities.create_index([("user_id", 1), ("start_time", 1), ("end_time", 1)])
            activities.create_index([("user_id", 1), ("tags", 1)])
            
            # 分类集合索引
            categories = self.db.personal_activity_categories
            categories.create_index([("user_id", 1), ("parent_id", 1)])
            categories.create_index([("user_id", 1), ("is_active", 1)])
            categories.create_index([("user_id", 1), ("order", 1)])
            
            # 目标集合索引
            goals = self.db.personal_activity_goals
            goals.create_index([("user_id", 1), ("status", 1)])
            goals.create_index([("user_id", 1), ("end_date", 1)])
            goals.create_index([("user_id", 1), ("type", 1)])
            
            # 分析报告集合索引
            reports = self.db.personal_activity_reports
            reports.create_index([("user_id", 1), ("report_type", 1), ("period_start", -1)])
            reports.create_index([("user_id", 1), ("generated_at", -1)])
            reports.create_index([("expires_at", 1)], expireAfterSeconds=0)  # TTL索引
            
            logger.info("MongoDB索引创建成功")
            
        except Exception as e:
            logger.error(f"创建索引失败: {e}")

class ActivityRecord:
    """活动记录模型"""
    
    def __init__(self, models_instance: PersonalActivityModels):
        self.models = models_instance
        self.collection = models_instance.db.personal_activities if models_instance.db is not None else None
    
    def create(self, user_id: str, data: Dict[str, Any]) -> Optional[str]:
        """创建新的活动记录"""
        if self.collection is None:
            return None
            
        try:
            # 构建活动记录文档
            activity_doc = {
                "user_id": str(user_id),
                "title": data.get("title", ""),
                "description": data.get("description", ""),
                "category": data.get("category", {}),
                "status": data.get("status", "planned"),
                "priority": data.get("priority", 3),
                "progress": data.get("progress", 0),
                
                # 时间相关
                "start_time": data.get("start_time"),
                "end_time": data.get("end_time"),
                "estimated_duration": data.get("estimated_duration"),
                "actual_duration": data.get("actual_duration"),
                "deadline": data.get("deadline"),
                
                # 位置和环境
                "location": data.get("location", {}),
                
                # 情绪和评价
                "mood": data.get("mood"),
                "energy_level": data.get("energy_level"),
                "satisfaction": data.get("satisfaction"),
                "difficulty": data.get("difficulty"),
                
                # 日记内容 (新增朋友圈功能)
                "content": data.get("content", ""),  # 富文本内容
                "images": data.get("images", []),    # 图片URL列表
                "content_type": data.get("content_type", "activity"),  # activity, diary, thought
                "is_public": data.get("is_public", False),  # 是否公开可见
                "weather": data.get("weather", {}),  # 天气信息
                "location_name": data.get("location_name", ""),  # 位置名称

                # 关联数据
                "tags": data.get("tags", []),
                "attachments": data.get("attachments", []),
                "subtasks": data.get("subtasks", []),
                "dependencies": [ObjectId(dep) for dep in data.get("dependencies", [])],
                
                # 重复设置
                "recurrence": data.get("recurrence", {}),
                
                # 提醒设置
                "reminders": data.get("reminders", []),
                
                # 元数据
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "deleted_at": None,
                "sync_status": "synced",
                "version": 1
            }
            
            result = self.collection.insert_one(activity_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"创建活动记录失败: {e}")
            return None
    
    def get_by_id(self, user_id: str, activity_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取活动记录"""
        if self.collection is None:
            return None
            
        try:
            activity = self.collection.find_one({
                "_id": ObjectId(activity_id),
                "user_id": _user_id_query(user_id),
                "deleted_at": None
            })
            
            if activity:
                activity["_id"] = str(activity["_id"])
                activity["user_id"] = _serialize_user_id(activity["user_id"])
                # 转换依赖关系ID
                activity["dependencies"] = [str(dep) for dep in activity.get("dependencies", [])]
                
            return activity
            
        except Exception as e:
            logger.error(f"获取活动记录失败: {e}")
            return None
    
    def get_user_activities(self, user_id: str, filters: Dict[str, Any] = None, 
                          page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """获取用户的活动记录列表"""
        if self.collection is None:
            return {"activities": [], "total": 0, "page": page, "page_size": page_size}
            
        try:
            # 构建查询条件
            query = {
                "user_id": _user_id_query(user_id),
                "deleted_at": None
            }
            
            # 应用过滤条件
            if filters:
                if filters.get("status"):
                    query["status"] = filters["status"]
                if filters.get("category_id"):
                    query["category.id"] = filters["category_id"]
                if filters.get("tags"):
                    query["tags"] = {"$in": filters["tags"]}
                if filters.get("start_date") and filters.get("end_date"):
                    query["start_time"] = {
                        "$gte": filters["start_date"],
                        "$lte": filters["end_date"]
                    }
            
            # 计算总数
            total = self.collection.count_documents(query)
            
            # 分页查询
            skip = (page - 1) * page_size
            cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
            
            activities = []
            for activity in cursor:
                activity["_id"] = str(activity["_id"])
                activity["user_id"] = _serialize_user_id(activity["user_id"])
                activity["dependencies"] = [str(dep) for dep in activity.get("dependencies", [])]
                activities.append(activity)
            
            return {
                "activities": activities,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size
            }
            
        except Exception as e:
            logger.error(f"获取活动列表失败: {e}")
            return {"activities": [], "total": 0, "page": page, "page_size": page_size}
    
    def update(self, user_id: str, activity_id: str, data: Dict[str, Any]) -> bool:
        """更新活动记录"""
        if self.collection is None:
            return False
            
        try:
            # 准备更新数据
            update_data = {
                "updated_at": datetime.now(timezone.utc),
                "version": {"$inc": 1}
            }
            
            # 添加需要更新的字段
            for key, value in data.items():
                if key not in ["_id", "user_id", "created_at", "version"]:
                    if key == "dependencies" and isinstance(value, list):
                        update_data[key] = [ObjectId(dep) for dep in value]
                    else:
                        update_data[key] = value
            
            result = self.collection.update_one(
                {
                    "_id": ObjectId(activity_id),
                    "user_id": _user_id_query(user_id),
                    "deleted_at": None
                },
                {"$set": update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"更新活动记录失败: {e}")
            return False
    
    def delete(self, user_id: str, activity_id: str) -> bool:
        """软删除活动记录"""
        if self.collection is None:
            return False
            
        try:
            result = self.collection.update_one(
                {
                    "_id": ObjectId(activity_id),
                    "user_id": _user_id_query(user_id),
                    "deleted_at": None
                },
                {
                    "$set": {
                        "deleted_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"删除活动记录失败: {e}")
            return False
    
    def update_status(self, user_id: str, activity_id: str, status: str) -> bool:
        """更新活动状态"""
        return self.update(user_id, activity_id, {"status": status})
    
    def update_progress(self, user_id: str, activity_id: str, progress: int) -> bool:
        """更新活动进度"""
        return self.update(user_id, activity_id, {"progress": progress})

class ActivityCategory:
    """活动分类模型"""

    def __init__(self, models_instance: PersonalActivityModels):
        self.models = models_instance
        self.collection = models_instance.db.personal_activity_categories if models_instance.db is not None else None

    def create(self, user_id: str, data: Dict[str, Any]) -> Optional[str]:
        """创建新的分类"""
        if self.collection is None:
            return None
        try:
            category_doc = {
                "user_id": str(user_id),
                "name": data["name"],
                "description": data.get("description", ""),
                "color": data.get("color", "#FFFFFF"),
                "icon": data.get("icon", "label"),
                "parent_id": ObjectId(data["parent_id"]) if data.get("parent_id") else None,
                "order": data.get("order", 0),
                "is_system": False,
                "is_active": True,
                "activity_count": 0,
                "total_time": 0,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            result = self.collection.insert_one(category_doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"创建分类失败: {e}")
            return None

    def get_by_id(self, user_id: str, category_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取分类"""
        if self.collection is None:
            return None
        try:
            category = self.collection.find_one({"_id": ObjectId(category_id), "user_id": _user_id_query(user_id)})
            if category:
                category["_id"] = str(category["_id"])
                category["user_id"] = _serialize_user_id(category["user_id"])
                if category.get("parent_id"):
                    category["parent_id"] = str(category["parent_id"])
            return category
        except Exception as e:
            logger.error(f"获取分类失败: {e}")
            return None

    def get_user_categories(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的所有分类"""
        if self.collection is None:
            return []
        try:
            cursor = self.collection.find({"user_id": _user_id_query(user_id), "is_active": True}).sort("order", 1)
            categories = []
            for category in cursor:
                category["_id"] = str(category["_id"])
                category["user_id"] = _serialize_user_id(category["user_id"])
                if category.get("parent_id"):
                    category["parent_id"] = str(category["parent_id"])
                categories.append(category)
            return categories
        except Exception as e:
            logger.error(f"获取分类列表失败: {e}")
            return []

    def update(self, user_id: str, category_id: str, data: Dict[str, Any]) -> bool:
        """更新分类"""
        if self.collection is None:
            return False
        try:
            update_data = {"updated_at": datetime.now(timezone.utc)}
            for key, value in data.items():
                if key not in ["_id", "user_id", "is_system", "created_at"]:
                    if key == "parent_id" and value:
                        update_data[key] = ObjectId(value)
                    else:
                        update_data[key] = value

            result = self.collection.update_one(
                {"_id": ObjectId(category_id), "user_id": _user_id_query(user_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"更新分类失败: {e}")
            return False

    def delete(self, user_id: str, category_id: str) -> bool:
        """删除分类 (软删除或硬删除取决于业务逻辑)"""
        if self.collection is None:
            return False
        try:
            # 检查是否为系统分类
            category = self.get_by_id(user_id, category_id)
            if category and category.get('is_system'):
                logger.warning(f"不能删除系统分类: {category_id}")
                return False

            # 软删除：将is_active设为False
            result = self.collection.update_one(
                {"_id": ObjectId(category_id), "user_id": _user_id_query(user_id)},
                {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"删除分类失败: {e}")
            return False

    def create_default_categories(self, user_id: str) -> bool:
        """为新用户创建默认分类"""
        if self.collection is None:
            return False

        default_categories = [
            {"name": "工作", "color": "#FF6B6B", "icon": "work", "order": 1},
            {"name": "学习", "color": "#4ECDC4", "icon": "school", "order": 2},
            {"name": "运动", "color": "#45B7D1", "icon": "fitness_center", "order": 3},
            {"name": "娱乐", "color": "#96CEB4", "icon": "sports_esports", "order": 4},
            {"name": "社交", "color": "#FFEAA7", "icon": "people", "order": 5},
            {"name": "生活", "color": "#DDA0DD", "icon": "home", "order": 6},
            {"name": "健康", "color": "#98D8C8", "icon": "favorite", "order": 7},
            {"name": "其他", "color": "#F7DC6F", "icon": "more_horiz", "order": 8}
        ]

        try:
            # 检查是否已存在默认分类
            if self.collection.count_documents({"user_id": _user_id_query(user_id), "is_system": True}) > 0:
                return True

            for category_data in default_categories:
                category_doc = {
                    "user_id": str(user_id),
                    "name": category_data["name"],
                    "description": f"默认{category_data['name']}分类",
                    "color": category_data["color"],
                    "icon": category_data["icon"],
                    "parent_id": None,
                    "order": category_data["order"],
                    "is_system": True,
                    "is_active": True,
                    "activity_count": 0,
                    "total_time": 0,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                self.collection.insert_one(category_doc)

            return True

        except Exception as e:
            logger.error(f"创建默认分类失败: {e}")
            return False

class ActivityGoal:
    """活动目标模型"""

    def __init__(self, models_instance: PersonalActivityModels):
        self.models = models_instance
        self.collection = models_instance.db.personal_activity_goals if models_instance.db is not None else None

    def create(self, user_id: str, data: Dict[str, Any]) -> Optional[str]:
        """创建新目标"""
        if self.collection is None:
            return None
        try:
            goal_doc = {
                "user_id": str(user_id),
                "title": data["title"],
                "description": data.get("description", ""),
                "type": data["type"],
                "target_value": data.get("target_value"),
                "current_value": data.get("current_value", 0),
                "unit": data.get("unit", ""),
                "start_date": data["start_date"],
                "end_date": data["end_date"],
                "related_categories": [ObjectId(cat_id) for cat_id in data.get("related_categories", [])],
                "related_activities": [ObjectId(act_id) for act_id in data.get("related_activities", [])],
                "milestones": data.get("milestones", []),
                "status": data.get("status", "active"),
                "completion_rate": 0,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            result = self.collection.insert_one(goal_doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"创建目标失败: {e}")
            return None

    def get_by_id(self, user_id: str, goal_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取目标"""
        if self.collection is None:
            return None
        try:
            goal = self.collection.find_one({"_id": ObjectId(goal_id), "user_id": _user_id_query(user_id)})
            if goal:
                goal["_id"] = str(goal["_id"])
                goal["user_id"] = _serialize_user_id(goal["user_id"])
                goal["related_categories"] = [str(cat_id) for cat_id in goal.get("related_categories", [])]
                goal["related_activities"] = [str(act_id) for act_id in goal.get("related_activities", [])]
            return goal
        except Exception as e:
            logger.error(f"获取目标失败: {e}")
            return None

    def get_user_goals(self, user_id: str, status: str = None) -> List[Dict[str, Any]]:
        """获取用户的目标列表"""
        if self.collection is None:
            return []
        try:
            query = {"user_id": _user_id_query(user_id)}
            if status:
                query["status"] = status

            cursor = self.collection.find(query).sort("created_at", -1)
            goals = []
            for goal in cursor:
                goal["_id"] = str(goal["_id"])
                goal["user_id"] = _serialize_user_id(goal["user_id"])
                goal["related_categories"] = [str(cat_id) for cat_id in goal.get("related_categories", [])]
                goal["related_activities"] = [str(act_id) for act_id in goal.get("related_activities", [])]
                goals.append(goal)
            return goals
        except Exception as e:
            logger.error(f"获取目标列表失败: {e}")
            return []

    def update(self, user_id: str, goal_id: str, data: Dict[str, Any]) -> bool:
        """更新目标"""
        if self.collection is None:
            return False
        try:
            existing_goal = self.get_by_id(user_id, goal_id)
            if not existing_goal:
                return False

            update_data = {"updated_at": datetime.now(timezone.utc)}
            for key, value in data.items():
                if key not in ["_id", "user_id", "created_at"]:
                    if key in ["related_categories", "related_activities"] and isinstance(value, list):
                        update_data[key] = [ObjectId(item_id) for item_id in value]
                    else:
                        update_data[key] = value

            next_target_value = update_data.get("target_value", existing_goal.get("target_value"))
            next_current_value = update_data.get("current_value", existing_goal.get("current_value", 0))
            next_status = update_data.get("status", existing_goal.get("status", "active"))

            if next_target_value is not None:
                try:
                    target_value_number = float(next_target_value)
                except (TypeError, ValueError):
                    target_value_number = 0

                try:
                    current_value_number = float(next_current_value or 0)
                except (TypeError, ValueError):
                    current_value_number = 0

                completion_rate = min(100, (current_value_number / target_value_number) * 100) if target_value_number > 0 else 0
                update_data["completion_rate"] = completion_rate

                if "status" not in update_data:
                    update_data["status"] = "completed" if completion_rate >= 100 else next_status
            elif "status" in update_data and update_data["status"] == "completed":
                update_data["completion_rate"] = 100
            elif "status" in update_data and update_data["status"] in ["paused", "cancelled"]:
                update_data["completion_rate"] = existing_goal.get("completion_rate", 0)

            result = self.collection.update_one(
                {"_id": ObjectId(goal_id), "user_id": _user_id_query(user_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"更新目标失败: {e}")
            return False

    def delete(self, user_id: str, goal_id: str) -> bool:
        """删除目标"""
        if self.collection is None:
            return False
        try:
            result = self.collection.delete_one(
                {"_id": ObjectId(goal_id), "user_id": _user_id_query(user_id)}
            )
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"删除目标失败: {e}")
            return False

    def update_progress(self, user_id: str, goal_id: str, current_value: float) -> bool:
        """更新目标进度"""
        if self.collection is None:
            return False
        try:
            goal = self.get_by_id(user_id, goal_id)
            if not goal:
                return False

            target_value = goal.get("target_value", 1)
            completion_rate = min(100, (current_value / target_value) * 100) if target_value > 0 else 0

            # 如果完成率达到100%，自动设置状态为完成
            status = "completed" if completion_rate >= 100 else goal.get("status", "active")

            result = self.collection.update_one(
                {"_id": ObjectId(goal_id), "user_id": _user_id_query(user_id)},
                {"$set": {
                    "current_value": current_value,
                    "completion_rate": completion_rate,
                    "status": status,
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"更新目标进度失败: {e}")
            return False

_personal_activity_models = None
_activity_record = None
_activity_category = None
_activity_goal = None


def _get_models_bundle():
    global _personal_activity_models, _activity_record, _activity_category, _activity_goal

    if _personal_activity_models is None:
        _personal_activity_models = PersonalActivityModels()
        _activity_record = ActivityRecord(_personal_activity_models)
        _activity_category = ActivityCategory(_personal_activity_models)
        _activity_goal = ActivityGoal(_personal_activity_models)

    return _personal_activity_models, _activity_record, _activity_category, _activity_goal


def get_personal_activity_models():
    return _get_models_bundle()[0]


def get_activity_record():
    return _get_models_bundle()[1]


def get_activity_category():
    return _get_models_bundle()[2]


def get_activity_goal():
    return _get_models_bundle()[3]
