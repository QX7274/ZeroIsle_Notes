"""
MongoDB用户认证视图
"""

from rest_framework import status, permissions, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth import get_user_model
from common.utils import get_client_ip
from users.mongodb_models import User, VerificationCode, UserProfile, UserSettings
from users.serializers.mongo_auth import (
    MongoUserRegistrationSerializer,
    MongoUserLoginSerializer,
    MongoUserSerializer,
    MongoVerificationCodeSerializer
)
from pymongo.errors import DuplicateKeyError
from mongoengine.errors import NotUniqueError
import logging
from datetime import timedelta
import uuid


DjangoUser = get_user_model()


def _get_or_create_django_user_for_mongo(mongo_user):
    """为Mongo用户生成/复用对应的Django User，供SimpleJWT签发令牌。"""
    # 优先尝试按username查找，避免重复创建
    django_user = DjangoUser.objects.filter(username=mongo_user.username).first()
    if django_user:
        # 回填映射字段
        if getattr(django_user, 'mongo_id', None) != mongo_user.id:
            django_user.mongo_id = mongo_user.id
            django_user.save(update_fields=['mongo_id'])
        return django_user

    # 新建Django用户（不可用登录密码，仅承载认证映射）
    django_user = DjangoUser(
        username=mongo_user.username,
        email=getattr(mongo_user, 'email', None) or None,
        phone=getattr(mongo_user, 'phone', None) or None,
        is_active=bool(getattr(mongo_user, 'is_active', True)),
        mongo_id=mongo_user.id,
    )
    django_user.set_unusable_password()
    django_user.save()
    return django_user

logger = logging.getLogger(__name__)

class MongoUserRegistrationView(viewsets.ViewSet):
    """
    MongoDB用户注册视图
    """
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        """
        标准注册方法
        """
        serializer = MongoUserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 创建用户
                user = serializer.save()

                # 生成令牌（基于Django User签发）
                django_user = _get_or_create_django_user_for_mongo(user)
                refresh = RefreshToken.for_user(django_user)

                # 记录设备信息
                self._record_device(request, user)

                # 发送欢迎邮件
                if user.email:
                    # 这里应该调用邮件服务
                    pass

                return Response({
                    'user': MongoUserSerializer(user).data,
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"用户注册失败: {str(e)}")
                return Response({'error': f'注册失败: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)

    @action(detail=False, methods=['post'])
    def register_with_username(self, request):
        """
        用户名注册
        """
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({'error': '用户名和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if User.objects(username=username).first():
                return Response({'error': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)

            # 创建用户
            user = User(
                username=username,
                password=make_password(password),
                is_active=True,
                date_joined=timezone.now()
            )
            user.save()
        except (DuplicateKeyError, NotUniqueError):
            # 并发/脏数据下唯一索引冲突，统一语义化返回
            return Response({'error': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)

        # 生成令牌（基于Django User签发）
        django_user = _get_or_create_django_user_for_mongo(user)
        refresh = RefreshToken.for_user(django_user)

        # 记录设备信息
        self._record_device(request, user)

        return Response({
            'user': MongoUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def register_with_email(self, request):
        """
        邮箱注册
        """
        email = request.data.get('email')
        password = request.data.get('password')
        username = request.data.get('username')

        if not email or not password:
            return Response({'error': '邮箱和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects(email=email).first():
            return Response({'error': '邮箱已注册'}, status=status.HTTP_400_BAD_REQUEST)

        # 如果没有提供用户名，使用邮箱前缀作为用户名
        if not username:
            username = email.split('@')[0]

            # 确保用户名唯一
            base_username = username
            count = 1
            while User.objects(username=username).first():
                username = f"{base_username}{count}"
                count += 1

        # 创建用户
        user = User(
            username=username,
            email=email,
            password=make_password(password),
            is_active=True,
            date_joined=timezone.now()
        )
        user.save()

        # 生成令牌（基于Django User签发）
        django_user = _get_or_create_django_user_for_mongo(user)
        refresh = RefreshToken.for_user(django_user)

        # 记录设备信息
        self._record_device(request, user)

        # 发送欢迎邮件
        # 这里应该调用邮件服务

        return Response({
            'user': MongoUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def register_with_phone(self, request):
        """
        手机号注册
        """
        phone = request.data.get('phone')
        code = request.data.get('code')
        password = request.data.get('password')
        username = request.data.get('username')

        if not phone or not code or not password:
            return Response({'error': '手机号、验证码和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 在开发环境中，跳过验证码验证
        if not settings.DEBUG:
            # 验证验证码
            verification = VerificationCode.objects(
                phone=phone,
                purpose='register',
                is_used=False,
                expires_at__gt=timezone.now()
            ).first()

            if not verification or verification.code != code:
                return Response({'error': '验证码无效或已过期'}, status=status.HTTP_400_BAD_REQUEST)

            # 标记验证码为已使用
            verification.is_used = True
            verification.save()
        else:
            # 开发环境中，获取最新的验证码
            verification = VerificationCode.objects(
                phone=phone,
                purpose='register'
            ).order_by('-created_at').first()

            if verification:
                # 标记验证码为已使用
                verification.is_used = True
                verification.save()

        if User.objects(phone=phone).first():
            return Response({'error': '手机号已注册'}, status=status.HTTP_400_BAD_REQUEST)

        # 如果没有提供用户名，使用手机号作为用户名
        if not username:
            username = f"user_{phone[-4:]}"

            # 确保用户名唯一
            base_username = username
            count = 1
            while User.objects(username=username).first():
                username = f"{base_username}{count}"
                count += 1

        # 创建用户
        user = User(
            username=username,
            phone=phone,
            password=make_password(password),
            is_active=True,
            date_joined=timezone.now()
        )
        user.save()

        # 生成令牌（基于Django User签发）
        django_user = _get_or_create_django_user_for_mongo(user)
        refresh = RefreshToken.for_user(django_user)

        # 记录设备信息
        self._record_device(request, user)

        return Response({
            'user': MongoUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    def _record_device(self, request, user):
        """记录用户设备信息"""
        # 在实际应用中，应该将设备信息保存到数据库
        # 这里简化处理
        pass


class MongoUserLoginView(viewsets.ViewSet):
    """
    MongoDB用户登录视图
    """
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        """
        标准登录方法
        """
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        login_identifier = None

        try:
            logger.info(f"收到登录请求: {request.data}")
            logger.info(f"客户端IP: {ip_address}")

            # 获取登录标识符用于记录
            login_identifier = (
                request.data.get('identifier') or
                request.data.get('username') or
                request.data.get('email') or
                request.data.get('phone')
            )

            serializer = MongoUserLoginSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.validated_data['user']
                logger.info(f"用户验证成功: {user.username}")

                # 更新最后登录信息
                user.last_login = timezone.now()
                user.last_login_ip = ip_address
                user.save()
                logger.info(f"更新用户登录信息成功: {user.username}")

                # 记录登录成功
                from users.models.login_attempt import LoginAttempt
                LoginAttempt.record_attempt(
                    ip_address=ip_address,
                    success=True,
                    username=user.username,
                    user_id=str(user.id),
                    user_agent=user_agent
                )

                # 记录设备信息
                self._record_device(request, user)

                # 生成令牌（基于Django User签发）
                django_user = _get_or_create_django_user_for_mongo(user)
                refresh = RefreshToken.for_user(django_user)
                logger.info(f"生成令牌成功: {user.username}")

                # 准备响应数据
                response_data = {
                    'user': MongoUserSerializer(user).data,
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
                logger.info(f"登录成功，返回响应: {user.username}")

                return Response(response_data)
            else:
                logger.error(f"登录验证失败: {serializer.errors}")

                # 记录登录失败
                from users.models.login_attempt import LoginAttempt
                LoginAttempt.record_attempt(
                    ip_address=ip_address,
                    success=False,
                    username=login_identifier,
                    user_agent=user_agent,
                    failure_reason=str(serializer.errors)
                )

                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"登录过程中发生异常: {str(e)}")

            # 记录登录异常
            try:
                from users.models.login_attempt import LoginAttempt
                LoginAttempt.record_attempt(
                    ip_address=ip_address,
                    success=False,
                    username=login_identifier,
                    user_agent=user_agent,
                    failure_reason=str(e)
                )
            except Exception:
                pass

            return Response({'error': f'登录失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """
        兼容旧版API
        """
        logger.info("通过post方法调用登录")
        return self.create(request)

    @action(detail=False, methods=['post'])
    def wechat_login(self, request):
        """
        微信登录
        """
        code = request.data.get('code')
        user_info = request.data.get('user_info', {})

        if not code:
            return Response({'error': '微信授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 提取微信头像URL
        avatar_url = user_info.get('avatarUrl') or user_info.get('headimgurl')
        nickname = user_info.get('nickname') or user_info.get('nickName', '')

        # 检查是否已有关联用户
        user = User.objects(wechat_openid=code).first()

        if not user:
            # 创建新用户
            username = f"wx_user_{uuid.uuid4().hex[:8]}"
            user = User(
                username=username,
                wechat_openid=code,
                wechat_avatar=avatar_url,  # 保存微信头像URL
                nickname=nickname,  # 保存微信昵称
                is_active=True,
                date_joined=timezone.now()
            )
            user.save()

            # 创建用户资料
            UserProfile.objects.create(
                user=user,
                nickname=nickname
            )

            # 创建用户设置
            UserSettings.objects.create(
                user=user
            )
        else:
            # 更新头像和昵称
            if avatar_url:
                user.wechat_avatar = avatar_url
            if nickname:
                user.nickname = nickname

                # 更新用户资料中的昵称
                profile = UserProfile.objects(user=user).first()
                if profile and not profile.nickname:
                    profile.nickname = nickname
                    profile.save()

            user.save()

        # 更新最后登录信息
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save()

        # 生成令牌（基于Django User签发）
        django_user = _get_or_create_django_user_for_mongo(user)
        refresh = RefreshToken.for_user(django_user)

        return Response({
            'user': MongoUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    @action(detail=False, methods=['post'])
    def qq_login(self, request):
        """
        QQ登录
        """
        code = request.data.get('code')
        user_info = request.data.get('user_info', {})

        if not code:
            return Response({'error': 'QQ授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 提取QQ头像URL
        avatar_url = user_info.get('figureurl_qq_2') or user_info.get('figureurl_qq_1') or user_info.get('figureurl_2')
        nickname = user_info.get('nickname', '')

        # 检查是否已有关联用户
        user = User.objects(qq_openid=code).first()

        if not user:
            # 创建新用户
            username = f"qq_user_{uuid.uuid4().hex[:8]}"
            user = User(
                username=username,
                qq_openid=code,
                qq_avatar=avatar_url,  # 保存QQ头像URL
                nickname=nickname,  # 保存QQ昵称
                is_active=True,
                date_joined=timezone.now()
            )
            user.save()

            # 创建用户资料
            UserProfile.objects.create(
                user=user,
                nickname=nickname
            )

            # 创建用户设置
            UserSettings.objects.create(
                user=user
            )
        else:
            # 更新头像和昵称
            if avatar_url:
                user.qq_avatar = avatar_url
            if nickname:
                user.nickname = nickname

                # 更新用户资料中的昵称
                profile = UserProfile.objects(user=user).first()
                if profile and not profile.nickname:
                    profile.nickname = nickname
                    profile.save()

            user.save()

        # 更新最后登录信息
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save()

        # 生成令牌（基于Django User签发）
        django_user = _get_or_create_django_user_for_mongo(user)
        refresh = RefreshToken.for_user(django_user)

        return Response({
            'user': MongoUserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    def _record_device(self, request, user):
        """记录用户设备信息"""
        # 在实际应用中，应该将设备信息保存到数据库
        # 这里简化处理
        pass


class MongoVerificationCodeView(viewsets.ViewSet):
    """
    MongoDB验证码视图
    """
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        """
        发送验证码
        """
        serializer = MongoVerificationCodeSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 创建验证码
                verification_code = serializer.save()

                # 在开发环境下，直接返回验证码
                if settings.DEBUG:
                    return Response({
                        'detail': '验证码已发送',
                        'code': verification_code.code  # 仅在开发环境下返回
                    })

                return Response({'detail': '验证码已发送'})
            except Exception as e:
                logger.error(f"发送验证码失败: {str(e)}")
                return Response({'error': f'发送验证码失败: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)
