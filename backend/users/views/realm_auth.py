"""
MongoDB Realm/Atlas App Services认证视图
提供与MongoDB Realm/Atlas App Services的认证功能
"""

from rest_framework import views, permissions, response, status
from rest_framework.decorators import api_view, permission_classes
from django.utils import timezone
from users.mongodb_models import User
from users.serializers import UserSerializer, UserProfileSerializer
from realm_service import realm_service
import logging
import uuid
import json
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

class RealmRegisterView(views.APIView):
    """MongoDB Realm/Atlas App Services注册视图"""
    permission_classes = [permissions.AllowAny]

    async def post(self, request):
        """注册用户"""
        try:
            # 获取请求数据
            username = request.data.get('username')
            email = request.data.get('email')
            password = request.data.get('password')

            # 验证数据
            if not username or not password:
                return response.Response(
                    {'error': '用户名和密码不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 检查用户名是否已存在
            existing_user = User.objects(username=username).first()
            if existing_user:
                return response.Response(
                    {'error': '用户名已存在'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建用户
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                username=username,
                email=email,
                password=password,  # 注意：实际应用中应该哈希密码
                is_active=True,
                date_joined=timezone.now()
            )

            # 尝试创建MongoDB Realm/Atlas App Services用户（如果配置了Realm）
            if realm_service.app_id:
                try:
                    realm_user = await realm_service.create_user(email or username, password)
                    if realm_user:
                        user.realm_id = realm_user.get('id')
                        user.realm_app_id = realm_service.app_id
                        user.realm_sync_enabled = True
                        user.realm_last_sync_time = timezone.now()
                except Exception as e:
                    # 仅记录错误，不影响用户创建
                    logger.warning(f"创建MongoDB Realm/Atlas App Services用户失败: {username}, 错误: {str(e)}")

            # 保存用户
            user.save()

            # 创建JWT令牌
            refresh = RefreshToken.for_user(user)

            # 返回用户信息和令牌
            return response.Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"注册用户失败: {str(e)}")
            return response.Response(
                {'error': f'注册失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class RealmLoginView(views.APIView):
    """MongoDB Realm/Atlas App Services登录视图"""
    permission_classes = [permissions.AllowAny]

    async def post(self, request):
        """登录用户"""
        try:
            # 获取请求数据
            username = request.data.get('username')
            password = request.data.get('password')

            # 验证数据
            if not username or not password:
                return response.Response(
                    {'error': '用户名和密码不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 查询用户
            user = User.objects(username=username).first()
            if not user:
                return response.Response(
                    {'error': '用户名或密码错误'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # 验证密码
            # 注意：实际应用中应该验证哈希密码
            if user.password != password:
                return response.Response(
                    {'error': '用户名或密码错误'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # 更新用户信息
            user.last_login = timezone.now()
            user.login_count += 1
            user.save()

            # 创建JWT令牌
            refresh = RefreshToken.for_user(user)

            # 返回用户信息和令牌
            return response.Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"登录用户失败: {str(e)}")
            return response.Response(
                {'error': f'登录失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
async def realm_sync_user(request):
    """同步用户到MongoDB Realm/Atlas App Services"""
    try:
        user = request.user

        # 如果未配置Realm，返回成功但提示不需要同步
        if not realm_service.app_id:
            return response.Response({
                'message': '仅使用MongoDB Atlas作为数据库，不需要同步到Realm/Atlas App Services',
                'status': 'success'
            }, status=status.HTTP_200_OK)

        # 检查是否已经有MongoDB Realm/Atlas App Services用户
        if user.realm_id:
            try:
                # 获取用户信息
                realm_user = await realm_service.get_user(user.realm_id)
                if realm_user:
                    # 更新同步时间
                    user.realm_last_sync_time = timezone.now()
                    user.save()

                    return response.Response({
                        'message': '用户已同步',
                        'realm_id': user.realm_id
                    }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.warning(f"获取Realm用户信息失败: {str(e)}")
                # 继续尝试创建新用户

        # 创建MongoDB Realm/Atlas App Services用户
        try:
            realm_user = await realm_service.create_user(user.email or user.username, user.password)
            if realm_user:
                # 更新用户信息
                user.realm_id = realm_user.get('id')
                user.realm_app_id = realm_service.app_id
                user.realm_sync_enabled = True
                user.realm_last_sync_time = timezone.now()
                user.save()

                return response.Response({
                    'message': '用户已创建并同步',
                    'realm_id': user.realm_id
                }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"创建Realm用户失败: {str(e)}")

        # 如果到达这里，说明同步失败但不影响用户使用
        return response.Response({
            'message': '同步到Realm/Atlas App Services失败，但不影响基本功能使用',
            'status': 'partial_success'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"同步用户到MongoDB Realm/Atlas App Services失败: {str(e)}")
        return response.Response({
            'message': '同步失败，但不影响基本功能使用',
            'error': str(e),
            'status': 'error'
        }, status=status.HTTP_200_OK)  # 返回200而不是500，不影响用户体验
