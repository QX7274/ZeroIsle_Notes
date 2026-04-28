"""
密码重置视图
"""

import logging
import importlib.util
from pathlib import Path
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

# users/services.py 与 users/services/ 目录同名，使用动态加载避免导入冲突
_password_service_path = Path(__file__).resolve().parents[1] / 'services' / 'password_service.py'
_spec = importlib.util.spec_from_file_location('users_password_service_module', _password_service_path)
_password_service_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_password_service_module)
PasswordService = _password_service_module.PasswordService

logger = logging.getLogger(__name__)

class PasswordResetView(APIView):
    """
    密码重置视图
    用于发送密码重置验证码
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """
        发送密码重置验证码

        请求参数:
        - user_id: 用户ID
        - reset_type: 重置类型（email或phone）

        返回:
        - 验证码信息
        """
        try:
            user_id = request.data.get('user_id')
            reset_type = request.data.get('reset_type', 'email')

            if not user_id:
                return Response({
                    'status': 'error',
                    'message': '用户ID不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 记录请求来源
            request_source = 'user'
            if request.user.is_authenticated and request.user.is_staff:
                request_source = 'admin'

            # 根据重置类型发送验证码
            if reset_type == 'email':
                result = PasswordService.send_reset_code_by_email(
                    user_id=user_id,
                    request_source=request_source
                )
            elif reset_type == 'phone':
                result = PasswordService.send_reset_code_by_phone(
                    user_id=user_id,
                    request_source=request_source
                )
            else:
                return Response({
                    'status': 'error',
                    'message': '无效的重置类型'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 返回结果
            if result['status'] == 'success':
                # 记录日志
                logger.info(f"用户 {user_id} 请求了密码重置验证码，类型: {reset_type}")
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"发送密码重置验证码失败: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'发送密码重置验证码失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VerifyResetCodeView(APIView):
    """
    验证重置码视图
    验证用户输入的重置验证码
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """
        验证重置验证码

        请求参数:
        - user_id: 用户ID
        - code: 验证码
        - reset_type: 重置类型（email或phone）

        返回:
        - 验证结果
        """
        try:
            user_id = request.data.get('user_id')
            code = request.data.get('code')
            reset_type = request.data.get('reset_type', 'email')

            if not user_id or not code:
                return Response({
                    'status': 'error',
                    'message': '用户ID和验证码不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 验证验证码
            result = PasswordService.verify_reset_code(
                user_id=user_id,
                code=code,
                reset_type=reset_type
            )

            # 返回结果
            if result['status'] == 'success':
                # 记录日志
                logger.info(f"用户 {user_id} 验证了密码重置验证码")
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"验证重置码失败: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'验证重置码失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CompletePasswordResetView(APIView):
    """
    完成密码重置视图
    完成用户密码重置
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """
        完成密码重置

        请求参数:
        - user_id: 用户ID
        - verification_id: 验证码ID
        - new_password: 新密码

        返回:
        - 重置结果
        """
        try:
            user_id = request.data.get('user_id')
            verification_id = request.data.get('verification_id')
            new_password = request.data.get('new_password')

            if not user_id or not verification_id or not new_password:
                return Response({
                    'status': 'error',
                    'message': '用户ID、验证码ID和新密码不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 记录请求来源
            request_source = 'user'
            if request.user.is_authenticated and request.user.is_staff:
                request_source = 'admin'

            # 重置密码
            result = PasswordService.reset_password(
                user_id=user_id,
                verification_id=verification_id,
                new_password=new_password,
                request_source=request_source
            )

            # 返回结果
            if result['status'] == 'success':
                # 记录日志
                logger.info(f"用户 {user_id} 完成了密码重置")
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"完成密码重置失败: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'完成密码重置失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
