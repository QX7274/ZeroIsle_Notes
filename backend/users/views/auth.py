"""
认证相关视图
"""

from rest_framework import status, permissions, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.contrib.auth.hashers import make_password, check_password
from common.utils import get_client_ip
from users.models import VerificationCode, UserDevice, LoginAttempt
from users.serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    UserDetailSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    VerificationCodeSerializer
)
from users.services import (
    EmailService,
    SmsService,
    NotificationService
)
import logging
from datetime import timedelta
import hashlib
import hmac
import base64
import json

logger = logging.getLogger(__name__)
User = get_user_model()

class UserRegistrationView(viewsets.ViewSet):
    """
    用户注册视图
    """
    permission_classes = [permissions.AllowAny]

    def _hash_password(self, password):
        """使用PBKDF2算法加密密码"""
        salt = settings.SECRET_KEY[:16].encode()
        iterations = 100000
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations)
        return base64.b64encode(key).decode()

    @transaction.atomic
    def create(self, request):
        """
        标准注册方法
        """
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            # 加密密码
            password = serializer.validated_data.pop('password')
            hashed_password = self._hash_password(password)

            # 创建用户
            user = User.objects.create(
                **serializer.validated_data,
                password=hashed_password
            )

            # 生成令牌
            refresh = RefreshToken.for_user(user)

            # 记录设备信息
            self._record_device(request, user)

            # 发送欢迎邮件
            if user.email:
                EmailService.send_welcome_email(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)

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

        if User.objects.filter(username=username).exists():
            return Response({'error': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        # 记录设备信息
        self._record_device(request, user)

        return Response({
            'user': UserSerializer(user).data,
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

        if User.objects.filter(email=email).exists():
            return Response({'error': '邮箱已注册'}, status=status.HTTP_400_BAD_REQUEST)

        # 如果没有提供用户名，使用邮箱前缀作为用户名
        if not username:
            username = email.split('@')[0]

            # 确保用户名唯一
            base_username = username
            count = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{count}"
                count += 1

        user = User.objects.create_user(username=username, email=email, password=password)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        # 记录设备信息
        self._record_device(request, user)

        # 发送欢迎邮件
        EmailService.send_welcome_email(user)

        return Response({
            'user': UserSerializer(user).data,
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

        # 验证验证码
        try:
            verification = VerificationCode.objects.get(
                phone=phone,
                purpose='register',
                is_used=False,
                expires_at__gt=timezone.now()
            )

            if verification.code != code:
                return Response({'error': '验证码错误'}, status=status.HTTP_400_BAD_REQUEST)

            # 标记验证码为已使用
            verification.is_used = True
            verification.save()

        except VerificationCode.DoesNotExist:
            return Response({'error': '验证码无效或已过期'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(phone=phone).exists():
            return Response({'error': '手机号已注册'}, status=status.HTTP_400_BAD_REQUEST)

        # 如果没有提供用户名，使用手机号作为用户名
        if not username:
            username = f"user_{phone[-4:]}"

            # 确保用户名唯一
            base_username = username
            count = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{count}"
                count += 1

        user = User.objects.create_user(username=username, phone=phone, password=password)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        # 记录设备信息
        self._record_device(request, user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    def _record_device(self, request, user):
        """记录用户设备信息"""
        device_data = request.data.get('device', {})
        if device_data:
            UserDevice.objects.create(
                user=user,
                device_id=device_data.get('device_id', ''),
                device_type=device_data.get('device_type', ''),
                device_name=device_data.get('device_name', ''),
                device_model=device_data.get('device_model', ''),
                os_version=device_data.get('os_version', ''),
                app_version=device_data.get('app_version', ''),
                push_token=device_data.get('push_token', ''),
                last_login_at=timezone.now(),
                last_login_ip=get_client_ip(request)
            )



class UserLoginView(viewsets.ViewSet):
    """
    用户登录视图
    """
    permission_classes = [permissions.AllowAny]

    def _verify_password(self, password, hashed_password):
        """验证密码"""
        salt = settings.SECRET_KEY[:16].encode()
        iterations = 100000
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations)
        return base64.b64encode(key).decode() == hashed_password

    def _check_login_attempts(self, ip_address):
        """检查登录尝试次数"""
        attempts = LoginAttempt.objects.filter(
            ip_address=ip_address,
            timestamp__gte=timezone.now() - timedelta(minutes=15)
        ).count()

        if attempts >= 5:
            return False
        return True

    def _record_login_attempt(self, ip_address, success):
        """记录登录尝试"""
        LoginAttempt.objects.create(
            ip_address=ip_address,
            success=success,
            timestamp=timezone.now()
        )

    @transaction.atomic
    def create(self, request):
        """
        标准登录方法
        """
        ip_address = get_client_ip(request)

        # 检查登录尝试次数
        if not self._check_login_attempts(ip_address):
            return Response(
                {'error': '登录尝试次数过多，请15分钟后再试'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']

            # 验证密码
            if not self._verify_password(request.data['password'], user.password):
                self._record_login_attempt(ip_address, False)
                return Response(
                    {'error': '密码错误'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # 更新最后登录信息
            user.last_login = timezone.now()
            user.last_login_ip = ip_address
            user.save(update_fields=['last_login', 'last_login_ip'])

            # 记录设备信息
            self._record_device(request, user)

            # 记录成功登录
            self._record_login_attempt(ip_address, True)

            # 生成令牌
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)

    @action(detail=False, methods=['post'])
    def login_with_third_party(self, request):
        """
        第三方登录
        """
        provider = request.data.get('provider')
        token = request.data.get('token')

        if not provider or not token:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 验证第三方token
            user_info = self._verify_third_party_token(provider, token)

            # 查找或创建用户
            user, created = User.objects.get_or_create(
                **self._get_user_lookup(provider, user_info),
                defaults=self._get_user_defaults(provider, user_info)
            )

            # 生成令牌
            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'is_new_user': created
            })

        except Exception as e:
            logger.error(f"第三方登录失败: {str(e)}")
            return Response(
                {'error': '第三方登录失败'},
                status=status.HTTP_401_UNAUTHORIZED
            )

    def _verify_third_party_token(self, provider, token):
        """验证第三方token"""
        if provider == 'wechat':
            return self._verify_wechat_token(token)
        elif provider == 'qq':
            return self._verify_qq_token(token)
        else:
            raise ValueError(f"不支持的第三方登录提供商: {provider}")

    def _verify_wechat_token(self, token):
        """验证微信token"""
        # 实现微信token验证逻辑
        pass

    def _verify_qq_token(self, token):
        """验证QQtoken"""
        # 实现QQtoken验证逻辑
        pass

    def _get_user_lookup(self, provider, user_info):
        """获取用户查询条件"""
        if provider == 'wechat':
            return {'wechat_openid': user_info['openid']}
        elif provider == 'qq':
            return {'qq_openid': user_info['openid']}
        return {}

    def _get_user_defaults(self, provider, user_info):
        """获取用户默认值"""
        defaults = {
            'username': f"{provider}_{user_info['openid'][:8]}",
            'nickname': user_info.get('nickname', ''),
            'avatar': user_info.get('avatar', ''),
        }
        return defaults

    def _record_device(self, request, user):
        """记录用户设备信息"""
        device_data = request.data.get('device', {})
        if device_data and 'device_id' in device_data:
            device, created = UserDevice.objects.get_or_create(
                user=user,
                device_id=device_data.get('device_id'),
                defaults={
                    'device_type': device_data.get('device_type', ''),
                    'device_name': device_data.get('device_name', ''),
                    'device_model': device_data.get('device_model', ''),
                    'os_version': device_data.get('os_version', ''),
                    'app_version': device_data.get('app_version', ''),
                    'push_token': device_data.get('push_token', ''),
                    'is_active': True
                }
            )

            if not created:
                # 更新设备信息
                device.device_type = device_data.get('device_type', device.device_type)
                device.device_name = device_data.get('device_name', device.device_name)
                device.device_model = device_data.get('device_model', device.device_model)
                device.os_version = device_data.get('os_version', device.os_version)
                device.app_version = device_data.get('app_version', device.app_version)
                device.push_token = device_data.get('push_token', device.push_token)
                device.is_active = True

            device.last_login_at = timezone.now()
            device.last_login_ip = get_client_ip(request)
            device.save()

class UserLogoutView(APIView):
    """
    用户登出视图
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # 获取设备ID
        device_id = request.data.get('device_id')

        if device_id:
            # 标记设备为非活跃
            try:
                device = UserDevice.objects.get(user=request.user, device_id=device_id)
                device.is_active = False
                device.save(update_fields=['is_active'])
            except UserDevice.DoesNotExist:
                pass

        # 将刷新令牌加入黑名单
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass

        return Response(status=status.HTTP_204_NO_CONTENT)

class UserProfileView(APIView):
    """
    用户资料视图
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        from users.serializers import UserUpdateSerializer
        serializer = UserUpdateSerializer(request.user, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(UserDetailSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        from users.serializers import UserUpdateSerializer
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(UserDetailSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordChangeView(APIView):
    """
    密码修改视图
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()

            # 发送密码修改通知
            NotificationService.send_password_changed_notification(request.user)

            return Response({'detail': '密码修改成功'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetView(APIView):
    """
    密码重置视图
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()

            # 发送密码重置通知
            user = serializer.validated_data['user']
            NotificationService.send_password_reset_notification(user)

            return Response({'detail': '密码重置成功'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerificationCodeView(viewsets.ViewSet):
    """
    验证码视图
    """
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        """
        发送验证码
        """
        serializer = VerificationCodeSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get('email')
            phone = serializer.validated_data.get('phone')
            purpose = serializer.validated_data.get('purpose', 'login')
            type = request.data.get('type', 'login')  # 兼容前端传入的type参数

            # 如果前端传入了type参数，优先使用type
            if type in ['login', 'register', 'reset_password']:
                purpose = type

            # 生成验证码
            verification_code = VerificationCode.generate_code(
                email=email,
                phone=phone,
                purpose=purpose
            )

            # 发送验证码
            if email:
                EmailService.send_verification_code(email, verification_code.code, purpose)
            elif phone:
                SmsService.send_verification_code(phone, verification_code.code, purpose)

                # 开发环境下，直接返回验证码
                if settings.DEBUG:
                    return Response({
                        'detail': '验证码已发送',
                        'code': verification_code.code  # 仅在开发环境下返回
                    })

            return Response({'detail': '验证码已发送'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)
