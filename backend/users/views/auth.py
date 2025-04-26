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
from common.utils import get_client_ip
from users.models import VerificationCode, UserDevice
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

User = get_user_model()

class UserRegistrationView(viewsets.ViewSet):
    """
    用户注册视图
    """
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        """
        标准注册方法
        """
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

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

    def create(self, request):
        """
        标准登录方法
        """
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']

            # 更新最后登录信息
            user.last_login = timezone.now()
            user.last_login_ip = get_client_ip(request)
            user.save(update_fields=['last_login', 'last_login_ip'])

            # 记录设备信息
            self._record_device(request, user)

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
    def login_with_password(self, request):
        """
        用户名/手机号+密码登录
        """
        username = request.data.get('username')
        phone = request.data.get('phone')
        password = request.data.get('password')

        if not password:
            return Response({'error': '密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        if not username and not phone:
            return Response({'error': '用户名或手机号不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 尝试查找用户
        try:
            if username:
                user = User.objects.get(username=username)
            else:
                user = User.objects.get(phone=phone)

            # 验证密码
            if not user.check_password(password):
                return Response({'error': '密码错误'}, status=status.HTTP_400_BAD_REQUEST)

        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_400_BAD_REQUEST)

        # 更新最后登录信息
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login', 'last_login_ip'])

        # 记录设备信息
        self._record_device(request, user)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    @action(detail=False, methods=['post'])
    def login_with_email(self, request):
        """
        邮箱+密码登录
        """
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': '邮箱和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 尝试查找用户
        try:
            user = User.objects.get(email=email)

            # 验证密码
            if not user.check_password(password):
                return Response({'error': '密码错误'}, status=status.HTTP_400_BAD_REQUEST)

        except User.DoesNotExist:
            return Response({'error': '用户不存在'}, status=status.HTTP_400_BAD_REQUEST)

        # 更新最后登录信息
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login', 'last_login_ip'])

        # 记录设备信息
        self._record_device(request, user)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    @action(detail=False, methods=['post'])
    def login_with_code(self, request):
        """
        手机号+验证码登录
        """
        phone = request.data.get('phone')
        code = request.data.get('code')

        if not phone or not code:
            return Response({'error': '手机号和验证码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证验证码
        try:
            verification = VerificationCode.objects.get(
                phone=phone,
                purpose='login',
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

        # 尝试查找用户
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            # 如果用户不存在，创建新用户（自动注册）
            username = f"user_{phone[-4:]}"

            # 确保用户名唯一
            base_username = username
            count = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{count}"
                count += 1

            # 创建随机密码
            import random
            import string
            password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))

            user = User.objects.create_user(username=username, phone=phone, password=password)

        # 更新最后登录信息
        user.last_login = timezone.now()
        user.last_login_ip = get_client_ip(request)
        user.save(update_fields=['last_login', 'last_login_ip'])

        # 记录设备信息
        self._record_device(request, user)

        # 生成令牌
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

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
