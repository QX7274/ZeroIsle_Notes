import logging
from urllib.parse import quote_plus
from django.utils import timezone
from datetime import timedelta
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from .models import UserProfile, UserActivity

logger = logging.getLogger(__name__)

class UserService:
    """用户服务类，用于处理用户数据的同步和访问"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化用户服务"""
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
            mongo_uri = (
                f"mongodb://{encoded_user}:{encoded_password}"
                f"@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
            )
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        return MongoClient(mongo_uri)

    def sync_users(self, incremental=True, last_sync_time=None):
        """同步用户数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取用户数据
            users_collection = self.db["users"]
            users = list(users_collection.find(query))

            # 处理用户数据
            processed_count = 0
            for user_data in users:
                try:
                    # 检查用户是否已存在
                    user_id = str(user_data.get("_id"))
                    try:
                        user = UserProfile.objects.get(id=user_id)
                        # 更新现有用户
                        self._update_user_from_data(user, user_data)
                    except UserProfile.DoesNotExist:
                        # 创建新用户
                        self._create_user_from_data(user_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理用户数据时出错: {str(e)}")

            return {
                "total_users": len(users),
                "processed_users": processed_count
            }

        except Exception as e:
            logger.error(f"同步用户数据时出错: {str(e)}")
            raise

    def _create_user_from_data(self, user_data):
        """从数据创建用户"""
        user = UserProfile(
            id=str(user_data.get("_id")),
            username=user_data.get("username", ""),
            email=user_data.get("email", ""),
            phone=user_data.get("phone", ""),
            nickname=user_data.get("nickname", ""),
            avatar=user_data.get("avatar", ""),
            bio=user_data.get("bio", ""),
            is_active=user_data.get("is_active", True),
            is_staff=user_data.get("is_staff", False),
            status=user_data.get("status", "active"),
            preferences=user_data.get("preferences", {}),
            wechat_id=user_data.get("wechat_id", ""),
            qq_id=user_data.get("qq_id", ""),
            date_joined=user_data.get("date_joined", timezone.now()),
            last_login=user_data.get("last_login"),
            note_count=user_data.get("note_count", 0),
            canvas_count=user_data.get("canvas_count", 0),
            login_count=user_data.get("login_count", 0)
        )
        user.save()
        return user

    def _update_user_from_data(self, user, user_data):
        """从数据更新用户"""
        user.username = user_data.get("username", user.username)
        user.email = user_data.get("email", user.email)
        user.phone = user_data.get("phone", user.phone)
        user.nickname = user_data.get("nickname", user.nickname)
        user.avatar = user_data.get("avatar", user.avatar)
        user.bio = user_data.get("bio", user.bio)
        user.is_active = user_data.get("is_active", user.is_active)
        user.is_staff = user_data.get("is_staff", user.is_staff)
        user.status = user_data.get("status", user.status)
        user.preferences = user_data.get("preferences", user.preferences)
        user.wechat_id = user_data.get("wechat_id", user.wechat_id)
        user.qq_id = user_data.get("qq_id", user.qq_id)
        user.date_joined = user_data.get("date_joined", user.date_joined)
        user.last_login = user_data.get("last_login", user.last_login)
        user.note_count = user_data.get("note_count", user.note_count)
        user.canvas_count = user_data.get("canvas_count", user.canvas_count)
        user.login_count = user_data.get("login_count", user.login_count)
        user.save()
        return user

    def get_user_stats(self):
        """获取用户统计信息"""
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        try:
            # 从主应用数据库获取统计信息
            users_collection = self.db["users"]

            total_users = users_collection.count_documents({})
            active_users = users_collection.count_documents({"is_active": True, "status": "active"})
            inactive_users = users_collection.count_documents({"$or": [{"is_active": False}, {"status": "inactive"}]})
            banned_users = users_collection.count_documents({"status": "banned"})

            new_users_today = users_collection.count_documents({"date_joined": {"$gte": today}})
            new_users_yesterday = users_collection.count_documents({"date_joined": {"$gte": yesterday, "$lt": today}})
            new_users_this_week = users_collection.count_documents({"date_joined": {"$gte": week_ago}})
            new_users_this_month = users_collection.count_documents({"date_joined": {"$gte": month_ago}})

            login_users_today = users_collection.count_documents({"last_login": {"$gte": today}})
            login_users_yesterday = users_collection.count_documents({"last_login": {"$gte": yesterday, "$lt": today}})
            login_users_this_week = users_collection.count_documents({"last_login": {"$gte": week_ago}})

            # 获取用户增长趋势（最近30天）
            growth_trend = self.get_user_growth_trend(30)

            # 获取用户活跃度趋势（最近30天）
            activity_trend = self.get_user_activity_trend(30)

            # 获取用户留存率
            retention_rate = self.get_user_retention_rate()

            # 获取用户分布统计
            user_distribution = self.get_user_distribution()

            # 获取最近注册的用户
            recent_users = list(users_collection.find({}).sort("date_joined", -1).limit(5))
            for user in recent_users:
                user['id'] = str(user.pop('_id'))

            # 获取最活跃的用户
            most_active_users = list(users_collection.find({}).sort("login_count", -1).limit(5))
            for user in most_active_users:
                user['id'] = str(user.pop('_id'))

            return {
                "total_users": total_users,
                "active_users": active_users,
                "inactive_users": inactive_users,
                "banned_users": banned_users,
                "new_users_today": new_users_today,
                "new_users_yesterday": new_users_yesterday,
                "new_users_this_week": new_users_this_week,
                "new_users_this_month": new_users_this_month,
                "login_users_today": login_users_today,
                "login_users_yesterday": login_users_yesterday,
                "login_users_this_week": login_users_this_week,
                "growth_trend": growth_trend,
                "activity_trend": activity_trend,
                "retention_rate": retention_rate,
                "user_distribution": user_distribution,
                "recent_users": recent_users,
                "most_active_users": most_active_users
            }

        except Exception as e:
            logger.error(f"获取用户统计信息时出错: {str(e)}")
            # 如果无法从主应用获取，则使用本地数据
            return self._get_local_user_stats()

    def _get_local_user_stats(self):
        """从本地数据获取用户统计信息"""
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        total_users = UserProfile.objects.count()
        active_users = UserProfile.objects.filter(is_active=True, status="active").count()
        inactive_users = UserProfile.objects.filter(is_active=False).count() + UserProfile.objects.filter(status="inactive").count()
        banned_users = UserProfile.objects.filter(status="banned").count()

        new_users_today = UserProfile.objects.filter(date_joined__gte=today).count()
        new_users_yesterday = UserProfile.objects.filter(date_joined__gte=yesterday, date_joined__lt=today).count()
        new_users_this_week = UserProfile.objects.filter(date_joined__gte=week_ago).count()
        new_users_this_month = UserProfile.objects.filter(date_joined__gte=month_ago).count()

        login_users_today = UserProfile.objects.filter(last_login__gte=today).count()
        login_users_yesterday = UserProfile.objects.filter(last_login__gte=yesterday, last_login__lt=today).count()
        login_users_this_week = UserProfile.objects.filter(last_login__gte=week_ago).count()

        # 获取用户增长趋势（最近30天）
        growth_trend = self._get_local_user_growth_trend(30)

        # 获取用户活跃度趋势（最近30天）
        activity_trend = self._get_local_user_activity_trend(30)

        # 获取用户留存率
        retention_rate = self._get_local_user_retention_rate()

        # 获取用户分布统计
        user_distribution = self._get_local_user_distribution()

        # 获取最近注册的用户
        recent_users = list(UserProfile.objects.all().order_by('-date_joined')[:5].values('id', 'username', 'email', 'date_joined'))

        # 获取最活跃的用户
        most_active_users = list(UserProfile.objects.all().order_by('-login_count')[:5].values('id', 'username', 'email', 'login_count'))

        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": inactive_users,
            "banned_users": banned_users,
            "new_users_today": new_users_today,
            "new_users_yesterday": new_users_yesterday,
            "new_users_this_week": new_users_this_week,
            "new_users_this_month": new_users_this_month,
            "login_users_today": login_users_today,
            "login_users_yesterday": login_users_yesterday,
            "login_users_this_week": login_users_this_week,
            "growth_trend": growth_trend,
            "activity_trend": activity_trend,
            "retention_rate": retention_rate,
            "user_distribution": user_distribution,
            "recent_users": recent_users,
            "most_active_users": most_active_users
        }

    def update_user_in_main_app(self, user_id, user_data):
        """在主应用中更新用户数据"""
        try:
            users_collection = self.db["users"]
            result = users_collection.update_one(
                {"_id": user_id},
                {"$set": user_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新用户数据时出错: {str(e)}")
            return False

    def delete_user_in_main_app(self, user_id):
        """在主应用中删除用户"""
        try:
            users_collection = self.db["users"]
            result = users_collection.delete_one({"_id": user_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"在主应用中删除用户时出错: {str(e)}")
            return False

    def get_user_growth_trend(self, days=30):
        """获取用户增长趋势"""
        try:
            end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=days)

            # 准备日期范围
            date_range = []
            current_date = start_date
            while current_date <= end_date:
                date_range.append(current_date)
                current_date += timedelta(days=1)

            # 从主应用获取数据
            users_collection = self.db["users"]
            growth_data = []

            for date in date_range:
                next_date = date + timedelta(days=1)
                count = users_collection.count_documents({
                    "date_joined": {"$gte": date, "$lt": next_date}
                })
                growth_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count
                })

            return growth_data
        except Exception as e:
            logger.error(f"获取用户增长趋势时出错: {str(e)}")
            return self._get_local_user_growth_trend(days)

    def _get_local_user_growth_trend(self, days=30):
        """从本地数据获取用户增长趋势"""
        end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=days)

        # 准备日期范围
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # 从本地数据库获取数据
        growth_data = []
        for date in date_range:
            next_date = date + timedelta(days=1)
            count = UserProfile.objects.filter(date_joined__gte=date, date_joined__lt=next_date).count()
            growth_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })

        return growth_data

    def get_user_activity_trend(self, days=30):
        """获取用户活跃度趋势"""
        try:
            end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timedelta(days=days)

            # 准备日期范围
            date_range = []
            current_date = start_date
            while current_date <= end_date:
                date_range.append(current_date)
                current_date += timedelta(days=1)

            # 从主应用获取数据
            users_collection = self.db["users"]
            activity_data = []

            for date in date_range:
                next_date = date + timedelta(days=1)
                count = users_collection.count_documents({
                    "last_login": {"$gte": date, "$lt": next_date}
                })
                activity_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count
                })

            return activity_data
        except Exception as e:
            logger.error(f"获取用户活跃度趋势时出错: {str(e)}")
            return self._get_local_user_activity_trend(days)

    def _get_local_user_activity_trend(self, days=30):
        """从本地数据获取用户活跃度趋势"""
        end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=days)

        # 准备日期范围
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # 从本地数据库获取数据
        activity_data = []
        for date in date_range:
            next_date = date + timedelta(days=1)
            count = UserProfile.objects.filter(last_login__gte=date, last_login__lt=next_date).count()
            activity_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })

        return activity_data

    def get_user_retention_rate(self):
        """获取用户留存率"""
        try:
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

            # 计算不同时间段的留存率
            retention_data = []

            # 1天留存
            day1 = today - timedelta(days=1)
            new_users_day1 = self.db["users"].count_documents({"date_joined": {"$gte": day1, "$lt": today}})
            retained_users_day1 = self.db["users"].count_documents({
                "date_joined": {"$gte": day1, "$lt": today},
                "last_login": {"$gte": today}
            })
            day1_rate = round(retained_users_day1 / new_users_day1 * 100, 2) if new_users_day1 > 0 else 0

            # 7天留存
            day7 = today - timedelta(days=7)
            new_users_day7 = self.db["users"].count_documents({"date_joined": {"$gte": day7, "$lt": day7 + timedelta(days=1)}})
            retained_users_day7 = self.db["users"].count_documents({
                "date_joined": {"$gte": day7, "$lt": day7 + timedelta(days=1)},
                "last_login": {"$gte": today - timedelta(days=1)}
            })
            day7_rate = round(retained_users_day7 / new_users_day7 * 100, 2) if new_users_day7 > 0 else 0

            # 30天留存
            day30 = today - timedelta(days=30)
            new_users_day30 = self.db["users"].count_documents({"date_joined": {"$gte": day30, "$lt": day30 + timedelta(days=1)}})
            retained_users_day30 = self.db["users"].count_documents({
                "date_joined": {"$gte": day30, "$lt": day30 + timedelta(days=1)},
                "last_login": {"$gte": today - timedelta(days=7)}
            })
            day30_rate = round(retained_users_day30 / new_users_day30 * 100, 2) if new_users_day30 > 0 else 0

            retention_data = [
                {"period": "次日留存", "rate": day1_rate, "new_users": new_users_day1, "retained_users": retained_users_day1},
                {"period": "7日留存", "rate": day7_rate, "new_users": new_users_day7, "retained_users": retained_users_day7},
                {"period": "30日留存", "rate": day30_rate, "new_users": new_users_day30, "retained_users": retained_users_day30}
            ]

            return retention_data
        except Exception as e:
            logger.error(f"获取用户留存率时出错: {str(e)}")
            return self._get_local_user_retention_rate()

    def _get_local_user_retention_rate(self):
        """从本地数据获取用户留存率"""
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # 计算不同时间段的留存率
        retention_data = []

        # 1天留存
        day1 = today - timedelta(days=1)
        new_users_day1 = UserProfile.objects.filter(date_joined__gte=day1, date_joined__lt=today).count()
        retained_users_day1 = UserProfile.objects.filter(
            date_joined__gte=day1,
            date_joined__lt=today,
            last_login__gte=today
        ).count()
        day1_rate = round(retained_users_day1 / new_users_day1 * 100, 2) if new_users_day1 > 0 else 0

        # 7天留存
        day7 = today - timedelta(days=7)
        new_users_day7 = UserProfile.objects.filter(
            date_joined__gte=day7,
            date_joined__lt=day7 + timedelta(days=1)
        ).count()
        retained_users_day7 = UserProfile.objects.filter(
            date_joined__gte=day7,
            date_joined__lt=day7 + timedelta(days=1),
            last_login__gte=today - timedelta(days=1)
        ).count()
        day7_rate = round(retained_users_day7 / new_users_day7 * 100, 2) if new_users_day7 > 0 else 0

        # 30天留存
        day30 = today - timedelta(days=30)
        new_users_day30 = UserProfile.objects.filter(
            date_joined__gte=day30,
            date_joined__lt=day30 + timedelta(days=1)
        ).count()
        retained_users_day30 = UserProfile.objects.filter(
            date_joined__gte=day30,
            date_joined__lt=day30 + timedelta(days=1),
            last_login__gte=today - timedelta(days=7)
        ).count()
        day30_rate = round(retained_users_day30 / new_users_day30 * 100, 2) if new_users_day30 > 0 else 0

        retention_data = [
            {"period": "次日留存", "rate": day1_rate, "new_users": new_users_day1, "retained_users": retained_users_day1},
            {"period": "7日留存", "rate": day7_rate, "new_users": new_users_day7, "retained_users": retained_users_day7},
            {"period": "30日留存", "rate": day30_rate, "new_users": new_users_day30, "retained_users": retained_users_day30}
        ]

        return retention_data

    def get_user_distribution(self):
        """获取用户分布统计"""
        try:
            users_collection = self.db["users"]

            # 用户状态分布
            status_distribution = [
                {"name": "活跃用户", "value": users_collection.count_documents({"status": "active"})},
                {"name": "禁用用户", "value": users_collection.count_documents({"status": "inactive"})},
                {"name": "封禁用户", "value": users_collection.count_documents({"status": "banned"})}
            ]

            # 用户注册时间分布
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            month_ago = today - timedelta(days=30)
            three_months_ago = today - timedelta(days=90)
            six_months_ago = today - timedelta(days=180)
            year_ago = today - timedelta(days=365)

            registration_distribution = [
                {"name": "30天内", "value": users_collection.count_documents({"date_joined": {"$gte": month_ago}})},
                {"name": "1-3个月", "value": users_collection.count_documents({"date_joined": {"$gte": three_months_ago, "$lt": month_ago}})},
                {"name": "3-6个月", "value": users_collection.count_documents({"date_joined": {"$gte": six_months_ago, "$lt": three_months_ago}})},
                {"name": "6-12个月", "value": users_collection.count_documents({"date_joined": {"$gte": year_ago, "$lt": six_months_ago}})},
                {"name": "1年以上", "value": users_collection.count_documents({"date_joined": {"$lt": year_ago}})}
            ]

            # 用户活跃度分布
            now = timezone.now()
            day_ago = now - timedelta(days=1)
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)

            activity_distribution = [
                {"name": "今日活跃", "value": users_collection.count_documents({"last_login": {"$gte": today}})},
                {"name": "1天内活跃", "value": users_collection.count_documents({"last_login": {"$gte": day_ago, "$lt": today}})},
                {"name": "7天内活跃", "value": users_collection.count_documents({"last_login": {"$gte": week_ago, "$lt": day_ago}})},
                {"name": "30天内活跃", "value": users_collection.count_documents({"last_login": {"$gte": month_ago, "$lt": week_ago}})},
                {"name": "30天以上未活跃", "value": users_collection.count_documents({"last_login": {"$lt": month_ago}})}
            ]

            return {
                "status_distribution": status_distribution,
                "registration_distribution": registration_distribution,
                "activity_distribution": activity_distribution
            }
        except Exception as e:
            logger.error(f"获取用户分布统计时出错: {str(e)}")
            return self._get_local_user_distribution()

    def _get_local_user_distribution(self):
        """从本地数据获取用户分布统计"""
        # 用户状态分布
        status_distribution = [
            {"name": "活跃用户", "value": UserProfile.objects.filter(status="active").count()},
            {"name": "禁用用户", "value": UserProfile.objects.filter(status="inactive").count()},
            {"name": "封禁用户", "value": UserProfile.objects.filter(status="banned").count()}
        ]

        # 用户注册时间分布
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        month_ago = today - timedelta(days=30)
        three_months_ago = today - timedelta(days=90)
        six_months_ago = today - timedelta(days=180)
        year_ago = today - timedelta(days=365)

        registration_distribution = [
            {"name": "30天内", "value": UserProfile.objects.filter(date_joined__gte=month_ago).count()},
            {"name": "1-3个月", "value": UserProfile.objects.filter(date_joined__gte=three_months_ago, date_joined__lt=month_ago).count()},
            {"name": "3-6个月", "value": UserProfile.objects.filter(date_joined__gte=six_months_ago, date_joined__lt=three_months_ago).count()},
            {"name": "6-12个月", "value": UserProfile.objects.filter(date_joined__gte=year_ago, date_joined__lt=six_months_ago).count()},
            {"name": "1年以上", "value": UserProfile.objects.filter(date_joined__lt=year_ago).count()}
        ]

        # 用户活跃度分布
        now = timezone.now()
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        activity_distribution = [
            {"name": "今日活跃", "value": UserProfile.objects.filter(last_login__gte=today).count()},
            {"name": "1天内活跃", "value": UserProfile.objects.filter(last_login__gte=day_ago, last_login__lt=today).count()},
            {"name": "7天内活跃", "value": UserProfile.objects.filter(last_login__gte=week_ago, last_login__lt=day_ago).count()},
            {"name": "30天内活跃", "value": UserProfile.objects.filter(last_login__gte=month_ago, last_login__lt=week_ago).count()},
            {"name": "30天以上未活跃", "value": UserProfile.objects.filter(last_login__lt=month_ago).count()}
        ]

        return {
            "status_distribution": status_distribution,
            "registration_distribution": registration_distribution,
            "activity_distribution": activity_distribution
        }

# 懒加载用户服务，避免在模块导入阶段触发外部连接
_user_service_instance = None


def get_user_service():
    global _user_service_instance
    if _user_service_instance is None:
        _user_service_instance = UserService()
    return _user_service_instance


class _LazyUserService:
    def __getattr__(self, item):
        return getattr(get_user_service(), item)


user_service = _LazyUserService()
