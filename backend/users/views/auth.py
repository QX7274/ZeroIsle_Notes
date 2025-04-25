"""
认证相关视图
"""

from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
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

class UserRegistrationView(APIView):
    """
    用户注册视图
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
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

class UserLoginView(APIView):
    """
    用户登录视图
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
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

class VerificationCodeView(APIView):
    """
    验证码视图
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = VerificationCodeSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data.get('email')
            phone = serializer.validated_data.get('phone')
            purpose = serializer.validated_data.get('purpose')
            
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
            
            return Response({'detail': '验证码已发送'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
