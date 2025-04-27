from rest_framework import serializers
from users.models import ThirdPartyAccount

class ThirdPartyAccountSerializer(serializers.ModelSerializer):
    """第三方账户关联序列化器
    用于处理微信、QQ等第三方登录的账户关联信息
    """
    class Meta:
        model = ThirdPartyAccount
        fields = ['id', 'platform', 'openid', 'unionid', 'access_token', 'expires_at', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'access_token': {'write_only': True},
            'expires_at': {'write_only': True}
        }