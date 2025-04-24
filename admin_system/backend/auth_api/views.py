from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import AdminLoginLog
from .serializers import (
    UserSerializer,
    AdminLoginSerializer,
    AdminLoginLogSerializer,
    ChangePasswordSerializer
)

class LoginView(APIView):
    """管理员登录视图"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']

            user = authenticate(username=username, password=password)

            if user is not None and user.is_staff:
                refresh = RefreshToken.for_user(user)

                # 记录登录日志
                log_data = {
                    'username': username,
                    'ip_address': self.get_client_ip(request),
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'status': True,
                    'message': '登录成功'
                }
                AdminLoginLog.objects.create(**log_data)

                return Response({
                    'status': 'success',
                    'message': '登录成功',
                    'data': {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                        'user': UserSerializer(user).data
                    }
                }, status=status.HTTP_200_OK)
            else:
                # 记录失败的登录尝试
                log_data = {
                    'username': username,
                    'ip_address': self.get_client_ip(request),
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'status': False,
                    'message': '用户名或密码错误'
                }
                AdminLoginLog.objects.create(**log_data)

                return Response({
                    'status': 'error',
                    'message': '用户名或密码错误，或者您没有管理员权限'
                }, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'status': 'error',
            'message': '无效的输入数据',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def get_client_ip(self, request):
        """获取客户端IP地址"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class LogoutView(APIView):
    """管理员登出视图"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({
                'status': 'success',
                'message': '登出成功'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'登出失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

class CheckAuthView(APIView):
    """检查认证状态视图"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'status': 'success',
            'data': {
                'isAuthenticated': True,
                'user': UserSerializer(request.user).data
            }
        }, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    """修改密码视图"""
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            old_password = serializer.validated_data['old_password']
            new_password = serializer.validated_data['new_password']

            # 验证旧密码
            if not user.check_password(old_password):
                return Response({
                    'status': 'error',
                    'message': '旧密码不正确'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 设置新密码
            user.set_password(new_password)
            user.save()

            return Response({
                'status': 'success',
                'message': '密码修改成功'
            }, status=status.HTTP_200_OK)

        return Response({
            'status': 'error',
            'message': '无效的输入数据',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class AdminLoginLogViewSet(viewsets.ReadOnlyModelViewSet):
    """管理员登录日志视图集"""
    queryset = AdminLoginLog.objects.all()
    serializer_class = AdminLoginLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AdminLoginLog.objects.all()

        # 按用户名筛选
        username = self.request.query_params.get('username')
        if username:
            queryset = queryset.filter(username=username)

        # 按状态筛选
        status_param = self.request.query_params.get('status')
        if status_param:
            status_bool = status_param.lower() == 'true'
            queryset = queryset.filter(status=status_bool)

        # 按时间范围筛选
        start_time = self.request.query_params.get('start_time')
        end_time = self.request.query_params.get('end_time')
        if start_time:
            queryset = queryset.filter(login_time__gte=start_time)
        if end_time:
            queryset = queryset.filter(login_time__lte=end_time)

        return queryset
