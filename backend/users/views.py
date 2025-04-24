from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from datetime import timedelta
import random
import requests
from .models import VerificationCode, ThirdPartyAccount
from .serializers import (
    UserSerializer, VerificationCodeSerializer,
    ThirdPartyAccountSerializer, LoginSerializer, UserRegistrationSerializer, UserLoginSerializer
)
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'send_verification_code', 'login']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer

    @action(detail=False, methods=['post'])
    def send_verification_code(self, request):
        serializer = VerificationCodeSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone']
            purpose = serializer.validated_data.get('purpose', 'login')
            code = ''.join(random.choices('0123456789', k=6))
            expires_at = timezone.now() + timedelta(minutes=5)

            # 检查用户是否存在（登录时需要验证用户存在）
            if purpose == 'login':
                if not User.objects.filter(phone=phone).exists():
                    return Response(
                        {'error': '该手机号尚未注册，请先注册'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 发送验证码（这里需要接入实际的短信服务）
            # send_sms(phone, code)

            VerificationCode.objects.create(
                phone=phone,
                code=code,
                purpose=purpose,
                expires_at=expires_at
            )
            return Response({'message': '验证码已发送'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone']
            password = serializer.validated_data.get('password')
            verification_code = serializer.validated_data.get('verification_code')

            try:
                user = User.objects.get(phone=phone)
                # 如果使用密码登录，验证密码
                if password and not user.check_password(password):
                    return Response(
                        {'error': '密码错误'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # 如果使用验证码登录，验证码已在serializer中验证
            except User.DoesNotExist:
                return Response(
                    {'error': '用户不存在'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 生成token
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': UserSerializer(user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def wechat_login(self, request):
        code = request.data.get('code')
        if not code:
            return Response(
                {'error': '缺少授权码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取微信access_token
        app_id = 'YOUR_WECHAT_APP_ID'
        app_secret = 'YOUR_WECHAT_APP_SECRET'
        url = f'https://api.weixin.qq.com/sns/oauth2/access_token?appid={app_id}&secret={app_secret}&code={code}&grant_type=authorization_code'
        response = requests.get(url)
        data = response.json()

        if 'errcode' in data:
            return Response(
                {'error': '微信授权失败'},
                status=status.HTTP_400_BAD_REQUEST
            )

        access_token = data['access_token']
        openid = data['openid']

        # 获取用户信息
        url = f'https://api.weixin.qq.com/sns/userinfo?access_token={access_token}&openid={openid}'
        response = requests.get(url)
        user_info = response.json()

        if 'errcode' in user_info:
            return Response(
                {'error': '获取用户信息失败'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 查找或创建用户
        try:
            third_party_account = ThirdPartyAccount.objects.get(
                provider='wechat',
                openid=openid
            )
            user = third_party_account.user
        except ThirdPartyAccount.DoesNotExist:
            user = User.objects.create(
                phone=f'wechat_{openid}',
                nickname=user_info.get('nickname'),
                avatar=user_info.get('headimgurl')
            )
            ThirdPartyAccount.objects.create(
                user=user,
                provider='wechat',
                openid=openid,
                nickname=user_info.get('nickname'),
                avatar=user_info.get('headimgurl')
            )

        # 生成token
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        })

    @action(detail=False, methods=['post'])
    def qq_login(self, request):
        code = request.data.get('code')
        if not code:
            return Response(
                {'error': '缺少授权码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取QQ access_token
        app_id = 'YOUR_QQ_APP_ID'
        app_key = 'YOUR_QQ_APP_KEY'
        redirect_uri = 'YOUR_REDIRECT_URI'
        url = f'https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id={app_id}&client_secret={app_key}&code={code}&redirect_uri={redirect_uri}'
        response = requests.get(url)
        data = response.text.split('&')
        access_token = data[0].split('=')[1]

        # 获取openid
        url = f'https://graph.qq.com/oauth2.0/me?access_token={access_token}'
        response = requests.get(url)
        data = response.json()
        openid = data['openid']

        # 获取用户信息
        url = f'https://graph.qq.com/user/get_user_info?access_token={access_token}&oauth_consumer_key={app_id}&openid={openid}'
        response = requests.get(url)
        user_info = response.json()

        if user_info['ret'] != 0:
            return Response(
                {'error': '获取用户信息失败'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 查找或创建用户
        try:
            third_party_account = ThirdPartyAccount.objects.get(
                provider='qq',
                openid=openid
            )
            user = third_party_account.user
        except ThirdPartyAccount.DoesNotExist:
            user = User.objects.create(
                phone=f'qq_{openid}',
                nickname=user_info.get('nickname'),
                avatar=user_info.get('figureurl_qq_1')
            )
            ThirdPartyAccount.objects.create(
                user=user,
                provider='qq',
                openid=openid,
                nickname=user_info.get('nickname'),
                avatar=user_info.get('figureurl_qq_1')
            )

        # 生成token
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        })

class UserRegistrationView(APIView):
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserLoginView(APIView):
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            # 获取登录凭证
            email = serializer.validated_data.get('email')
            phone = serializer.validated_data.get('phone')
            password = serializer.validated_data.get('password')

            user = None
            # 先尝试邮箱登录
            if email:
                user = authenticate(email=email, password=password)

            # 如果邮箱登录失败，尝试手机号登录
            if user is None and phone:
                try:
                    user_obj = User.objects.get(phone=phone)
                    if user_obj.check_password(password):
                        user = user_obj
                except User.DoesNotExist:
                    pass

            if user:
                refresh = RefreshToken.for_user(user)
                return Response({
                    'user': UserSerializer(user).data,
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                })
            return Response({'error': '无效的凭据'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {'error': '必须提供旧密码和新密码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(old_password):
            return Response(
                {'error': '旧密码不正确'},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': '密码修改成功'})

    @action(detail=False, methods=['post'])
    def reset_password(self, request):
        phone = request.data.get('phone')
        verification_code = request.data.get('verification_code')
        new_password = request.data.get('new_password')

        if not phone or not verification_code or not new_password:
            return Response(
                {'error': '必须提供手机号、验证码和新密码'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 验证验证码
        try:
            code_record = VerificationCode.objects.get(
                phone=phone,
                code=verification_code,
                expires_at__gte=timezone.now()
            )
        except VerificationCode.DoesNotExist:
            return Response(
                {'error': '验证码无效或已过期'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 查找用户
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response(
                {'error': '用户不存在'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 更新密码
        user.set_password(new_password)
        user.save()

        # 删除验证码记录
        code_record.delete()

        return Response({'message': '密码重置成功'})