"""
MongoDB用户认证序列化器
"""

from rest_framework import serializers
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from users.mongodb_models import User, VerificationCode
from users.models.login_attempt import LoginAttempt
from users.services.password_validator import validate_password as validate_password_strength
import random
import string
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class MongoUserRegistrationSerializer(serializers.Serializer):
    """
    MongoDB用户注册序列化器
    """
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    verification_code = serializers.CharField(write_only=True, required=False)

    def validate(self, data):
        """验证密码是否匹配和验证码"""
        if data['password'] != data.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': '两次输入的密码不匹配'})

        # 验证密码强度
        password = data.get('password')
        username = data.get('username')
        is_valid, errors = validate_password_strength(password, username)
        if not is_valid:
            raise serializers.ValidationError({'password': errors})

        # 验证用户名是否已存在
        if User.objects(username=username).first():
            raise serializers.ValidationError({'username': '用户名已存在'})

        # 验证邮箱是否已存在
        email = data.get('email')
        if email and User.objects(email=email).first():
            raise serializers.ValidationError({'email': '邮箱已注册'})

        # 验证手机号是否已存在
        phone = data.get('phone')
        if phone and User.objects(phone=phone).first():
            raise serializers.ValidationError({'phone': '手机号已注册'})

        # 不再强制要求邮箱或手机号
        # 用户可以在注册后在个人中心绑定这些信息

        # 验证验证码
        if 'verification_code' in data and data.get('verification_code'):
            verification_code = data.pop('verification_code')
            email = data.get('email')
            phone = data.get('phone')

            # 在开发环境中，跳过验证码验证
            from django.conf import settings
            if not settings.DEBUG:
                # 验证验证码
                verification = None
                if email:
                    verification = VerificationCode.objects(
                        email=email,
                        purpose='register',
                        is_used=False,
                        expires_at__gt=timezone.now()
                    ).first()
                elif phone:
                    verification = VerificationCode.objects(
                        phone=phone,
                        purpose='register',
                        is_used=False,
                        expires_at__gt=timezone.now()
                    ).first()

                if not verification or verification.code != verification_code:
                    raise serializers.ValidationError({'verification_code': '验证码无效或已过期'})

        return data

    def create(self, validated_data):
        """创建用户"""
        # 提取必要字段
        username = validated_data.get('username')
        email = validated_data.get('email')
        phone = validated_data.get('phone')
        password = validated_data.get('password')

        # 创建用户
        user_data = {
            'username': username,
            'password': make_password(password),  # 使用Django的密码哈希
            'is_active': True,
            'date_joined': timezone.now()
        }

        # 只有当邮箱不为空且不是空字符串时才添加
        if email and email.strip():
            user_data['email'] = email

        # 只有当手机号不为空且不是空字符串时才添加
        if phone and phone.strip():
            user_data['phone'] = phone

        user = User(**user_data)
        user.save()

        return user

class MongoUserLoginSerializer(serializers.Serializer):
    """
    MongoDB用户登录序列化器
    支持邮箱、用户名或手机号登录
    """
    # 统一的标识符字段，可以是用户名、邮箱或手机号
    identifier = serializers.CharField(required=False)
    # 兼容旧版API
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    # 密码或验证码
    password = serializers.CharField(style={'input_type': 'password'}, required=False)
    verification_code = serializers.CharField(required=False)

    def validate(self, data):
        """验证登录凭据"""
        # 记录请求数据
        logger.info(f"登录请求数据: {data}")

        # 处理统一标识符
        identifier = data.get('identifier')
        if identifier:
            # 判断标识符类型
            if '@' in identifier:
                data['email'] = identifier
            elif identifier.isdigit() and len(identifier) >= 11:
                data['phone'] = identifier
            else:
                data['username'] = identifier

        # 至少提供一种登录方式
        if not any(key in data for key in ['username', 'email', 'phone']):
            logger.error("登录失败: 未提供用户名、邮箱或手机号")
            raise serializers.ValidationError('请提供用户名、邮箱或手机号')

        # 获取登录标识符用于锁定检查
        login_identifier = data.get('username') or data.get('email') or data.get('phone')
        
        # 检查账户是否被锁定
        lockout_info = LoginAttempt.get_lockout_info(username=login_identifier)
        if lockout_info.get('locked'):
            logger.warning(f"登录被拒绝: 账户已锁定, 标识符: {login_identifier}")
            raise serializers.ValidationError({
                'non_field_errors': [lockout_info['message']],
                'locked_until_seconds': lockout_info['remaining_seconds'],
                'failed_attempts': lockout_info['failed_attempts']
            })

        # 使用验证码登录
        if 'verification_code' in data and data.get('verification_code'):
            verification_code = data['verification_code']
            email = data.get('email')
            phone = data.get('phone')

            if not phone:
                logger.error("验证码登录失败: 未提供手机号")
                raise serializers.ValidationError('使用验证码登录时必须提供手机号')

            # 在开发环境中，跳过验证码验证
            from django.conf import settings
            if not settings.DEBUG:
                # 验证验证码
                verification = VerificationCode.objects(
                    phone=phone,
                    purpose='login',
                    is_used=False,
                    expires_at__gt=timezone.now()
                ).first()

                if not verification or verification.code != verification_code:
                    logger.error(f"验证码登录失败: 验证码无效或已过期, 手机号: {phone}")
                    raise serializers.ValidationError({'verification_code': '验证码无效或已过期'})

                # 标记验证码为已使用
                verification.is_used = True
                verification.save()
            else:
                # 开发环境中，获取最新的验证码
                verification = VerificationCode.objects(
                    phone=phone,
                    purpose='login'
                ).order_by('-created_at').first()

                if verification:
                    # 标记验证码为已使用
                    verification.is_used = True
                    verification.save()

            # 查找用户
            user = None
            if phone:
                user = User.objects(phone=phone).first()
            elif email:
                user = User.objects(email=email).first()

            if not user:
                logger.error(f"验证码登录失败: 用户不存在, 手机号: {phone}, 邮箱: {email}")
                raise serializers.ValidationError('用户不存在')

            if not user.is_active:
                logger.error(f"验证码登录失败: 账号已禁用, 用户: {user.username}")
                raise serializers.ValidationError('该账号已被禁用')

            logger.info(f"验证码登录成功: 用户 {user.username}")
            data['user'] = user
            return data

        # 使用密码登录
        if 'password' not in data or not data.get('password'):
            logger.error("登录失败: 未提供密码或验证码")
            raise serializers.ValidationError('请提供密码或验证码')

        # 尝试不同的登录方式
        username = data.get('username')
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')

        logger.info(f"密码登录尝试: 用户名: {username}, 邮箱: {email}, 手机号: {phone}")

        # 查找用户
        user = None
        if username:
            user = User.objects(username=username).first()
            logger.info(f"通过用户名查找用户: {username}, 结果: {'找到' if user else '未找到'}")
        elif email:
            user = User.objects(email=email).first()
            logger.info(f"通过邮箱查找用户: {email}, 结果: {'找到' if user else '未找到'}")
        elif phone:
            user = User.objects(phone=phone).first()
            logger.info(f"通过手机号查找用户: {phone}, 结果: {'找到' if user else '未找到'}")

        if not user:
            logger.error(f"密码登录失败: 用户不存在, 用户名: {username}, 邮箱: {email}, 手机号: {phone}")
            raise serializers.ValidationError('用户不存在')

        # 验证密码
        password_valid = check_password(password, user.password)
        logger.info(f"密码验证结果: {'通过' if password_valid else '失败'}")

        if not password_valid:
            logger.error(f"密码登录失败: 密码错误, 用户: {user.username}")
            raise serializers.ValidationError('密码错误')

        if not user.is_active:
            logger.error(f"密码登录失败: 账号已禁用, 用户: {user.username}")
            raise serializers.ValidationError('该账号已被禁用')

        logger.info(f"密码登录成功: 用户 {user.username}")
        data['user'] = user
        return data

class MongoVerificationCodeSerializer(serializers.Serializer):
    """
    MongoDB验证码序列化器
    """
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    purpose = serializers.ChoiceField(
        choices=['login', 'register', 'reset_password', 'bind'],
        default='login'
    )

    def validate(self, data):
        """验证邮箱或手机号"""
        if not data.get('email') and not data.get('phone'):
            raise serializers.ValidationError('请提供邮箱或手机号')
        return data

    def create(self, validated_data):
        """创建验证码"""
        email = validated_data.get('email')
        phone = validated_data.get('phone')
        purpose = validated_data.get('purpose')

        # 生成6位随机验证码
        code = ''.join(random.choices(string.digits, k=6))

        # 设置过期时间（15分钟后）
        expires_at = timezone.now() + timedelta(minutes=15)

        # 查找用户
        user = None
        if email:
            user = User.objects(email=email).first()
        elif phone:
            user = User.objects(phone=phone).first()

        # 创建验证码
        verification_code = VerificationCode(
            code=code,
            purpose=purpose,
            expires_at=expires_at
        )

        # 设置用户信息
        if user:
            verification_code.user = user
        else:
            # 如果用户不存在，直接保存邮箱或手机号
            if email:
                verification_code.email = email
            elif phone:
                verification_code.phone = phone

        verification_code.save()
        return verification_code

class MongoUserSerializer(serializers.Serializer):
    """
    MongoDB用户序列化器
    """
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    phone = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    nickname = serializers.CharField(read_only=True)
    avatar = serializers.URLField(read_only=True)
    wechat_avatar = serializers.URLField(read_only=True)
    qq_avatar = serializers.URLField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    date_joined = serializers.DateTimeField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True)

    def to_representation(self, instance):
        """将MongoDB文档转换为字典"""
        return {
            'id': str(instance.id),
            'username': instance.username,
            'email': instance.email or '',
            'phone': instance.phone or '',
            'first_name': instance.first_name or '',
            'last_name': instance.last_name or '',
            'nickname': instance.nickname or '',
            'avatar': instance.avatar or '',
            'wechat_avatar': instance.wechat_avatar or '',
            'qq_avatar': instance.qq_avatar or '',
            'is_active': instance.is_active,
            'date_joined': instance.date_joined,
            'last_login': instance.last_login
        }


class MongoUserDetailSerializer(MongoUserSerializer):
    """
    MongoDB 用户详情序列化器
    """
    profile = serializers.SerializerMethodField()
    settings = serializers.SerializerMethodField()

    def get_profile(self, obj):
        from users.mongodb_models import UserProfile
        profile = UserProfile.objects(user=obj).first()
        if profile:
            return {
                'nickname': profile.nickname,
                'gender': profile.gender,
                'birthday': profile.birthday.isoformat() if profile.birthday else None,
                'location': profile.location,
                'website': profile.website,
            }
        return None

    def get_settings(self, obj):
        from users.mongodb_models import UserSettings
        settings = UserSettings.objects(user=obj).first()
        if settings:
            return {
                'theme': settings.theme,
                'language': settings.language,
                'notification_preferences': settings.notification_preferences,
            }
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['bio'] = instance.bio or ''
        data['is_verified'] = instance.is_verified
        data['profile'] = self.get_profile(instance)
        data['settings'] = self.get_settings(instance)
        return data

class MongoUserUpdateSerializer(serializers.Serializer):
    """
    MongoDB 用户更新序列化器
    """
    first_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    nickname = serializers.CharField(max_length=50, required=False, allow_blank=True)
    avatar = serializers.URLField(required=False, allow_blank=True)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def update(self, instance, validated_data):
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.nickname = validated_data.get('nickname', instance.nickname)
        instance.avatar = validated_data.get('avatar', instance.avatar)
        instance.bio = validated_data.get('bio', instance.bio)
        instance.save()
        return instance
