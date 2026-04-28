"""
AuthService 占位实现
提供第三方登录的最小实现以满足导入与基本调用需求。
在生产环境中应替换为真实的第三方认证逻辑。
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class AuthService:
    @staticmethod
    def third_party_login(provider: str, provider_user_id: str, user_data: dict, request=None):
        """
        最小实现：
        - 通过 provider_user_id 生成/获取一个本地用户（用户名规则：{provider}_{id}）
        - 发放 JWT 凭证
        返回: { user, refresh, access }
        """
        username = f"{provider}_{provider_user_id}" if provider_user_id else f"{provider}_user"
        user, created = User.objects.get_or_create(username=username)
        # 选填数据
        email = user_data.get('email') or ''
        if email and not user.email:
            user.email = email
        user.last_login = timezone.now()
        user.save()

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        return {
            'user': user,
            'refresh': str(refresh),
            'access': access,
        }

