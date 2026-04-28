"""
用户设置服务
"""

from ..mongodb_models import User, UserSettings

class UserSettingsService:
    """
    处理用户设置的业务逻辑。
    """

    @staticmethod
    def get_user_settings(user: User) -> UserSettings:
        """获取或创建用户的设置对象"""
        settings, created = UserSettings.objects.get_or_create(user=user)
        return settings

    @staticmethod
    def get_notification_preferences(user: User) -> dict:
        """获取用户的通知偏好设置"""
        settings = UserSettingsService.get_user_settings(user)
        # 返回一个副本以防意外修改
        return settings.notification_preferences.copy()

    @staticmethod
    def update_notification_preferences(user: User, preferences_data: dict) -> UserSettings:
        """
        更新用户的通知偏好设置。
        """
        settings = UserSettingsService.get_user_settings(user)
        
        # 只更新传入的键，不替换整个字典
        if not isinstance(preferences_data, dict):
            raise ValueError("Preferences data must be a dictionary.")

        for category, channels in preferences_data.items():
            if category in settings.notification_preferences and isinstance(channels, dict):
                for channel, value in channels.items():
                    if channel in settings.notification_preferences[category] and isinstance(value, bool):
                        settings.notification_preferences[category][channel] = value
        
        settings.save()
        return settings
