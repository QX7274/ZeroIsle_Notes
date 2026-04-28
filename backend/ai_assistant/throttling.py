from rest_framework.throttling import UserRateThrottle

class UserMinuteRateThrottle(UserRateThrottle):
    """每分钟用户请求速率限制"""
    scope = 'user_minute'

class UserDayRateThrottle(UserRateThrottle):
    """每天用户请求速率限制"""
    scope = 'user_day'

