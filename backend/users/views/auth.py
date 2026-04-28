"""
认证相关视图
"""

import logging
from rest_framework import status, permissions, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view

logger = logging.getLogger(__name__)
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



    @transaction.atomic
    def create(self, request):
        """
        标准注册方法
        """
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 创建用户
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
            except Exception as e:
                logger.error(f"用户注册失败: {str(e)}")
                return Response({'error': f'注册失败: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)



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



    @transaction.atomic
    def create(self, request):
        """
        标准登录方法
        """
        serializer = UserLoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']

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
        try:
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
        except Exception as e:
            # 如果记录设备信息失败，记录错误但继续处理
            logger.error(f"记录设备信息失败: {str(e)}")

class UserBindingView(viewsets.ViewSet):
    """
    用户绑定视图
    用于绑定多种登录方式
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def bind_email(self, request):
        """绑定邮箱"""
        user = request.user
        email = request.data.get('email')
        password = request.data.get('password')

        # 验证密码
        if not user.check_password(password):
            return Response({'error': '密码错误'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证邮箱格式
        if not email or '@' not in email:
            return Response({'error': '邮箱格式不正确'}, status=status.HTTP_400_BAD_REQUEST)

        # 检查邮箱是否已被其他用户使用
        if User.objects.filter(email=email).exclude(id=user.id).exists():
            return Response({'error': '该邮箱已被其他用户绑定'}, status=status.HTTP_400_BAD_REQUEST)

        # 绑定邮箱
        user.email = email
        user.save(update_fields=['email'])

        return Response({'message': '邮箱绑定成功', 'user': UserSerializer(user).data})

    @action(detail=False, methods=['post'])
    def bind_phone(self, request):
        """绑定手机号"""
        user = request.user
        phone = request.data.get('phone')
        code = request.data.get('code')
        password = request.data.get('password')

        # 验证密码
        if not user.check_password(password):
            return Response({'error': '密码错误'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证手机号格式
        if not phone or len(phone) < 11:
            return Response({'error': '手机号格式不正确'}, status=status.HTTP_400_BAD_REQUEST)

        # 检查手机号是否已被其他用户使用
        if User.objects.filter(phone=phone).exclude(id=user.id).exists():
            return Response({'error': '该手机号已被其他用户绑定'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证验证码
        try:
            verification = VerificationCode.objects.get(
                phone=phone,
                purpose='bind',
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

        # 绑定手机号
        user.phone = phone
        user.save(update_fields=['phone'])

        return Response({'message': '手机号绑定成功', 'user': UserSerializer(user).data})

    @action(detail=False, methods=['post'])
    def bind_wechat(self, request):
        """绑定微信"""
        user = request.user
        code = request.data.get('code')

        if not code:
            return Response({'error': '微信授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 获取微信用户信息
            wechat_info = self._get_wechat_user_info(code)

            # 检查微信是否已被其他用户绑定
            if User.objects.filter(wechat_openid=wechat_info['openid']).exclude(id=user.id).exists():
                return Response({'error': '该微信账号已被其他用户绑定'}, status=status.HTTP_400_BAD_REQUEST)

            # 绑定微信
            user.wechat_openid = wechat_info['openid']
            user.wechat_unionid = wechat_info.get('unionid', '')
            user.save(update_fields=['wechat_openid', 'wechat_unionid'])

            return Response({'message': '微信绑定成功', 'user': UserSerializer(user).data})

        except Exception as e:
            logger.error(f"绑定微信失败: {str(e)}")
            return Response({'error': '绑定微信失败'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bind_qq(self, request):
        """绑定QQ"""
        user = request.user
        code = request.data.get('code')

        if not code:
            return Response({'error': 'QQ授权码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 获取QQ用户信息
            qq_info = self._get_qq_user_info(code)

            # 检查QQ是否已被其他用户绑定
            if User.objects.filter(qq_openid=qq_info['openid']).exclude(id=user.id).exists():
                return Response({'error': '该QQ账号已被其他用户绑定'}, status=status.HTTP_400_BAD_REQUEST)

            # 绑定QQ
            user.qq_openid = qq_info['openid']
            user.save(update_fields=['qq_openid'])

            return Response({'message': 'QQ绑定成功', 'user': UserSerializer(user).data})

        except Exception as e:
            logger.error(f"绑定QQ失败: {str(e)}")
            return Response({'error': '绑定QQ失败'}, status=status.HTTP_400_BAD_REQUEST)

    def _get_wechat_user_info(self, code):
        """获取微信用户信息"""
        # 实现微信用户信息获取逻辑
        # 在开发环境中，返回模拟数据
        if settings.DEBUG:
            return {
                'openid': f'wx_{code}',
                'unionid': f'wx_union_{code}',
                'nickname': '微信用户',
                'avatar': 'https://example.com/avatar.jpg'
            }
        # 实际实现...
        pass

    def _get_qq_user_info(self, code):
        """获取QQ用户信息"""
        # 实现QQ用户信息获取逻辑
        # 在开发环境中，返回模拟数据
        if settings.DEBUG:
            return {
                'openid': f'qq_{code}',
                'nickname': 'QQ用户',
                'avatar': 'https://example.com/avatar.jpg'
            }
        # 实际实现...
        pass


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

class UserProfileView(viewsets.ViewSet):
    """
    用户资料视图
    """
    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request):
        """获取用户资料"""
        try:
            logger.debug(f"获取用户资料, 用户ID: {request.user.id}, 类型: {type(request.user.id)}")
            serializer = UserDetailSerializer(request.user)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取用户资料失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取用户资料失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """兼容旧版API"""
        return self.retrieve(request)

    def update(self, request):
        """更新用户资料"""
        try:
            from users.serializers import UserUpdateSerializer
            logger.debug(f"更新用户资料, 用户ID: {request.user.id}, 类型: {type(request.user.id)}")

            # 获取或创建对应的MongoDB用户（优先使用中间件注入）
            try:
                from users.utils import get_mongo_user_from_django
                mongo_user = getattr(request, 'mongo_user', None) or get_mongo_user_from_django(request.user)
            except Exception:
                mongo_user = None

            if mongo_user:
                logger.debug(f"找到MongoDB用户: {getattr(mongo_user, 'username', 'unknown')}, ID: {getattr(mongo_user, 'id', None)}")
                # 同步更新MongoDB用户的相关字段
                if 'nickname' in request.data:
                    mongo_user.nickname = request.data['nickname']
                if 'bio' in request.data:
                    mongo_user.bio = request.data['bio']
                if 'avatar' in request.data:
                    mongo_user.avatar = request.data['avatar']
                mongo_user.save()

            serializer = UserUpdateSerializer(request.user, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(UserDetailSerializer(request.user).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"更新用户资料失败: {str(e)}", exc_info=True)
            return Response({'error': f'更新用户资料失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request):
        """兼容旧版API"""
        return self.update(request)

    def partial_update(self, request):
        """部分更新用户资料"""
        try:
            from users.serializers import UserUpdateSerializer
            logger.debug(f"部分更新用户资料, 用户ID: {request.user.id}, 类型: {type(request.user.id)}")

            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=request.user.username).first()
            if mongo_user:
                logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}")
                # 同步更新MongoDB用户的相关字段
                if 'nickname' in request.data:
                    mongo_user.nickname = request.data['nickname']
                if 'bio' in request.data:
                    mongo_user.bio = request.data['bio']
                if 'avatar' in request.data:
                    mongo_user.avatar = request.data['avatar']
                mongo_user.save()

            serializer = UserUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(UserDetailSerializer(request.user).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"部分更新用户资料失败: {str(e)}", exc_info=True)
            return Response({'error': f'部分更新用户资料失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        """兼容旧版API"""
        return self.partial_update(request)

    @action(detail=False, methods=['post'])
    def upload_avatar(self, request):
        """
        上传头像
        """
        try:
            if 'avatar' not in request.FILES:
                return Response({'error': '请选择要上传的头像'}, status=status.HTTP_400_BAD_REQUEST)

            avatar_file = request.FILES['avatar']

            # 验证文件类型
            valid_extensions = ['jpg', 'jpeg', 'png', 'gif']
            ext = avatar_file.name.split('.')[-1].lower()
            if ext not in valid_extensions:
                return Response({'error': '不支持的文件类型，请上传jpg、jpeg、png或gif格式的图片'},
                            status=status.HTTP_400_BAD_REQUEST)

            # 验证文件大小（限制为5MB）
            if avatar_file.size > 5 * 1024 * 1024:
                return Response({'error': '文件大小不能超过5MB'},
                            status=status.HTTP_400_BAD_REQUEST)

            # 保存头像
            user = request.user
            logger.debug(f"上传头像, 用户ID: {user.id}, 类型: {type(user.id)}")

            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=user.username).first()
            if mongo_user:
                logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}")
                # 同步更新MongoDB用户的头像
                # 注意：这里需要根据实际情况处理MongoDB中的头像存储
                # 这里假设MongoDB中的avatar字段是URL字符串
                # 实际情况可能需要上传到云存储或其他处理

            # 如果用户已有头像，先删除旧头像
            if user.avatar:
                user.avatar.delete(save=False)

            # 设置新头像
            user.avatar = avatar_file
            user.save()

            # 返回头像URL
            avatar_url = request.build_absolute_uri(user.avatar.url) if user.avatar else None

            # 如果找到了MongoDB用户，更新其头像URL
            if mongo_user:
                mongo_user.avatar = avatar_url
                mongo_user.save()

            return Response({
                'message': '头像上传成功',
                'avatar_url': avatar_url
            })

        except Exception as e:
            logger.error(f"头像上传失败: {str(e)}", exc_info=True)
            return Response({'error': f'头像上传失败: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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



            return Response({'detail': '验证码已发送'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """
        兼容旧版API
        """
        return self.create(request)
