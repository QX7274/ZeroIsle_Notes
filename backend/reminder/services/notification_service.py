"""
通知服务
提供提醒通知的发送、处理和管理功能
"""

import logging
import uuid
import json
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from reminder.mongodb_models import ReminderNotification, Reminder

logger = logging.getLogger('backend')

class NotificationService:
    """
    通知服务类
    处理提醒通知的业务逻辑
    """

    def send_notification(self, notification):
        """
        发送通知

        Args:
            notification: 通知对象

        Returns:
            bool: 是否成功
        """
        try:
            # 检查通知状态
            if notification.status != 'pending':
                logger.warning(f"通知已经处理: {notification.id}")
                return False

            # 获取提醒
            reminder = notification.reminder

            # 检查提醒是否已完成或禁用
            if reminder.is_completed or not reminder.is_enabled:
                notification.status = 'failed'
                notification.error_message = '提醒已完成或禁用'
                notification.save()
                return False

            # 发送通知逻辑
            # 这里可以集成不同的通知渠道，如邮件、短信、推送等
            success = self._send_notification_to_user(reminder.user, reminder)

            # 更新通知状态
            if success:
                notification.status = 'sent'
                notification.sent_time = timezone.now()
            else:
                notification.status = 'failed'
                notification.error_message = '发送失败'

            notification.save()

            # 如果是重复提醒，创建下一次通知
            if reminder.frequency != 'once' and not reminder.is_completed:
                self._schedule_next_notification(reminder)

            return success
        except Exception as e:
            logger.error(f"发送通知失败: {e}")

            # 更新通知状态
            notification.status = 'failed'
            notification.error_message = str(e)
            notification.save()

            return False

    def process_pending_notifications(self):
        """
        处理待发送的通知

        Returns:
            tuple: (成功数量, 失败数量)
        """
        try:
            now = timezone.now()

            # 获取待发送的通知
            notifications = ReminderNotification.objects.filter(
                status='pending',
                scheduled_time__lte=now
            )

            success_count = 0
            error_count = 0

            # 发送通知
            for notification in notifications:
                try:
                    if self.send_notification(notification):
                        success_count += 1
                    else:
                        error_count += 1
                except Exception as e:
                    logger.error(f"处理通知失败: {e}")
                    error_count += 1

            return success_count, error_count
        except Exception as e:
            logger.error(f"处理待发送的通知失败: {e}")
            return 0, 0

    def _send_notification_to_user(self, user, reminder):
        """
        向用户发送通知

        Args:
            user: 用户对象
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 记录日志
            logger.info(f"向用户 {user.username} 发送提醒: {reminder.title}")

            # 获取用户通知偏好
            notification_preferences = self._get_user_notification_preferences(user)

            # 根据用户偏好发送通知
            success = False

            # 发送邮件通知
            if notification_preferences.get('email_enabled', True) and user.email:
                email_success = self._send_email_notification(user, reminder)
                success = success or email_success

            # 发送推送通知
            if notification_preferences.get('push_enabled', True):
                push_success = self._send_push_notification(user, reminder)
                success = success or push_success

            # 发送短信通知
            if notification_preferences.get('sms_enabled', False) and hasattr(user, 'phone_number') and user.phone_number:
                sms_success = self._send_sms_notification(user, reminder)
                success = success or sms_success

            # 发送WebSocket通知（实时通知）
            websocket_success = self._send_websocket_notification(user, reminder)
            success = success or websocket_success

            # 记录通知发送结果
            if success:
                logger.info(f"成功向用户 {user.username} 发送提醒: {reminder.title}")
            else:
                logger.warning(f"向用户 {user.username} 发送提醒失败: {reminder.title}")

            return success
        except Exception as e:
            logger.error(f"向用户发送通知失败: {e}")
            return False

    def _get_user_notification_preferences(self, user):
        """
        获取用户通知偏好

        Args:
            user: 用户对象

        Returns:
            dict: 通知偏好
        """
        try:
            # 默认偏好
            default_preferences = {
                'email_enabled': True,
                'push_enabled': True,
                'sms_enabled': False,
                'websocket_enabled': True,
                'reminder_notification_enabled': True,
                'reminder_notification_advance_time': 15,  # 提前15分钟通知
            }

            # 如果用户有通知偏好设置，使用用户设置
            if hasattr(user, 'notification_preferences'):
                user_preferences = user.notification_preferences
                if user_preferences:
                    # 合并默认偏好和用户偏好
                    return {**default_preferences, **user_preferences}

            return default_preferences
        except Exception as e:
            logger.error(f"获取用户通知偏好失败: {e}")
            return default_preferences

    def _send_email_notification(self, user, reminder):
        """
        发送邮件通知

        Args:
            user: 用户对象
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 准备邮件内容
            subject = f"提醒: {reminder.title}"

            # 使用模板渲染邮件内容
            context = {
                'user': user,
                'reminder': reminder,
                'app_name': getattr(settings, 'APP_NAME', '零屿笔记'),
                'app_url': getattr(settings, 'APP_URL', 'https://app.zeroisland.com'),
            }

            # 尝试使用HTML模板
            try:
                html_message = render_to_string('emails/reminder_notification.html', context)
            except Exception as e:
                logger.warning(f"渲染HTML邮件模板失败: {e}")
                html_message = None

            # 尝试使用文本模板
            try:
                plain_message = render_to_string('emails/reminder_notification.txt', context)
            except Exception as e:
                logger.warning(f"渲染文本邮件模板失败: {e}")
                # 如果文本模板渲染失败，使用简单的文本内容
                plain_message = f"您有一个提醒: {reminder.title}\n\n"
                if reminder.description:
                    plain_message += f"{reminder.description}\n\n"
                plain_message += f"时间: {reminder.due_date.strftime('%Y-%m-%d %H:%M')}\n"
                plain_message += f"优先级: {reminder.get_priority_display()}\n"

            # 发送邮件
            return self._send_email(
                to_email=user.email,
                subject=subject,
                message=plain_message,
                html_message=html_message
            )
        except Exception as e:
            logger.error(f"发送邮件通知失败: {e}")
            return False

    def _send_email(self, to_email, subject, message, html_message=None):
        """
        发送邮件

        Args:
            to_email: 收件人邮箱
            subject: 主题
            message: 内容
            html_message: HTML内容（可选）

        Returns:
            bool: 是否成功
        """
        try:
            # 获取发件人
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)

            # 发送邮件
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[to_email],
                fail_silently=False,
                html_message=html_message
            )

            logger.info(f"成功发送邮件到 {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"发送邮件失败: {e}")
            return False

    def _send_push_notification(self, user, reminder):
        """
        发送推送通知

        Args:
            user: 用户对象
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 准备通知内容
            title = reminder.title
            message = reminder.description or reminder.title

            # 获取设备令牌
            device_tokens = self._get_user_device_tokens(user)

            if not device_tokens:
                logger.info(f"用户 {user.username} 没有注册设备，跳过推送通知")
                return False

            # 发送推送通知
            success = False

            # 尝试使用Firebase Cloud Messaging
            fcm_success = self._send_fcm_notification(device_tokens, title, message, reminder)
            success = success or fcm_success

            # 尝试使用Apple Push Notification Service
            apns_success = self._send_apns_notification(device_tokens, title, message, reminder)
            success = success or apns_success

            if success:
                logger.info(f"成功向用户 {user.username} 发送推送通知: {title}")
            else:
                logger.warning(f"向用户 {user.username} 发送推送通知失败: {title}")

            return success
        except Exception as e:
            logger.error(f"发送推送通知失败: {e}")
            return False

    def _get_user_device_tokens(self, user):
        """
        获取用户设备令牌

        Args:
            user: 用户对象

        Returns:
            list: 设备令牌列表
        """
        try:
            # 如果有设备模型，从数据库获取
            if hasattr(user, 'devices'):
                return [device.token for device in user.devices.filter(is_active=True)]

            # 如果没有设备模型，返回空列表
            return []
        except Exception as e:
            logger.error(f"获取用户设备令牌失败: {e}")
            return []

    def _send_fcm_notification(self, device_tokens, title, message, reminder):
        """
        使用Firebase Cloud Messaging发送推送通知

        Args:
            device_tokens: 设备令牌列表
            title: 标题
            message: 内容
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 检查是否配置了Firebase
            if not hasattr(settings, 'FCM_API_KEY') or not settings.FCM_API_KEY:
                logger.warning("未配置Firebase Cloud Messaging，跳过FCM推送")
                return False

            # 这里实现FCM推送逻辑
            # 示例：使用firebase-admin包
            # 需要安装：pip install firebase-admin
            try:
                import firebase_admin
                from firebase_admin import messaging

                # 初始化Firebase
                if not firebase_admin._apps:
                    from firebase_admin import credentials
                    cred = credentials.Certificate(settings.FCM_CREDENTIALS_PATH)
                    firebase_admin.initialize_app(cred)

                # 准备消息
                message_data = {
                    'title': title,
                    'body': message,
                    'data': {
                        'reminder_id': str(reminder.id),
                        'type': 'reminder',
                        'priority': reminder.priority,
                        'due_date': reminder.due_date.isoformat(),
                    }
                }

                # 发送消息
                response = messaging.MulticastMessage(
                    tokens=device_tokens,
                    notification=messaging.Notification(
                        title=title,
                        body=message
                    ),
                    data=message_data['data']
                )

                result = messaging.send_multicast(response)

                # 检查结果
                if result.success_count > 0:
                    logger.info(f"成功发送FCM推送通知: {result.success_count}/{len(device_tokens)}")
                    return True
                else:
                    logger.warning(f"FCM推送通知失败: {result.failure_count}/{len(device_tokens)}")
                    return False
            except ImportError:
                logger.warning("未安装firebase-admin包，跳过FCM推送")
                return False
        except Exception as e:
            logger.error(f"发送FCM推送通知失败: {e}")
            return False

    def _send_apns_notification(self, device_tokens, title, message, reminder):
        """
        使用Apple Push Notification Service发送推送通知

        Args:
            device_tokens: 设备令牌列表
            title: 标题
            message: 内容
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 检查是否配置了APNS
            if not hasattr(settings, 'APNS_CERTIFICATE_PATH') or not settings.APNS_CERTIFICATE_PATH:
                logger.warning("未配置Apple Push Notification Service，跳过APNS推送")
                return False

            # 这里实现APNS推送逻辑
            # 示例：使用apns2包
            # 需要安装：pip install apns2
            try:
                from apns2.client import APNsClient
                from apns2.payload import Payload

                # 初始化APNS客户端
                client = APNsClient(
                    settings.APNS_CERTIFICATE_PATH,
                    use_sandbox=getattr(settings, 'APNS_USE_SANDBOX', True),
                    use_alternative_port=False
                )

                # 准备负载
                payload = Payload(
                    alert={
                        'title': title,
                        'body': message
                    },
                    sound='default',
                    badge=1,
                    custom={
                        'reminder_id': str(reminder.id),
                        'type': 'reminder',
                        'priority': reminder.priority,
                        'due_date': reminder.due_date.isoformat(),
                    }
                )

                # 发送通知
                success_count = 0
                for token in device_tokens:
                    try:
                        client.send_notification(token, payload, topic=settings.APNS_TOPIC)
                        success_count += 1
                    except Exception as e:
                        logger.error(f"向设备发送APNS推送通知失败: {token}, 错误: {e}")

                # 检查结果
                if success_count > 0:
                    logger.info(f"成功发送APNS推送通知: {success_count}/{len(device_tokens)}")
                    return True
                else:
                    logger.warning(f"APNS推送通知失败: 0/{len(device_tokens)}")
                    return False
            except ImportError:
                logger.warning("未安装apns2包，跳过APNS推送")
                return False
        except Exception as e:
            logger.error(f"发送APNS推送通知失败: {e}")
            return False

    def _send_sms_notification(self, user, reminder):
        """
        发送短信通知

        Args:
            user: 用户对象
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 检查用户是否有手机号
            if not hasattr(user, 'phone_number') or not user.phone_number:
                logger.info(f"用户 {user.username} 没有手机号，跳过短信通知")
                return False

            # 检查是否配置了短信服务
            if not hasattr(settings, 'SMS_API_KEY') or not settings.SMS_API_KEY:
                logger.warning("未配置短信服务，跳过短信通知")
                return False

            # 准备短信内容
            sms_content = f"【零屿笔记】提醒: {reminder.title}"
            if reminder.description:
                sms_content += f", {reminder.description[:50]}"
            sms_content += f", 时间: {reminder.due_date.strftime('%m月%d日 %H:%M')}"

            # 这里实现短信发送逻辑
            # 示例：使用阿里云短信服务
            # 需要安装：pip install aliyun-python-sdk-core aliyun-python-sdk-dysmsapi
            try:
                from aliyunsdkcore.client import AcsClient
                from aliyunsdkcore.request import CommonRequest

                # 初始化客户端
                client = AcsClient(
                    settings.SMS_API_KEY,
                    settings.SMS_API_SECRET,
                    settings.SMS_REGION_ID
                )

                # 创建请求
                request = CommonRequest()
                request.set_accept_format('json')
                request.set_domain('dysmsapi.aliyuncs.com')
                request.set_method('POST')
                request.set_protocol_type('https')
                request.set_version('2017-05-25')
                request.set_action_name('SendSms')

                # 设置参数
                request.add_query_param('PhoneNumbers', user.phone_number)
                request.add_query_param('SignName', settings.SMS_SIGN_NAME)
                request.add_query_param('TemplateCode', settings.SMS_TEMPLATE_CODE)
                request.add_query_param('TemplateParam', json.dumps({
                    'content': sms_content
                }))

                # 发送请求
                response = client.do_action_with_exception(request)
                response_dict = json.loads(response)

                # 检查结果
                if response_dict.get('Code') == 'OK':
                    logger.info(f"成功向用户 {user.username} 发送短信通知")
                    return True
                else:
                    logger.warning(f"向用户 {user.username} 发送短信通知失败: {response_dict.get('Message')}")
                    return False
            except ImportError:
                logger.warning("未安装阿里云SDK，跳过短信通知")
                return False
        except Exception as e:
            logger.error(f"发送短信通知失败: {e}")
            return False

    def _send_websocket_notification(self, user, reminder):
        """
        发送WebSocket通知（实时通知）

        Args:
            user: 用户对象
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 检查是否配置了WebSocket
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
            except ImportError:
                logger.warning("未安装channels包，跳过WebSocket通知")
                return False

            # 获取通道层
            channel_layer = get_channel_layer()
            if not channel_layer:
                logger.warning("未配置通道层，跳过WebSocket通知")
                return False

            # 获取用户的WebSocket组名
            group_name = f"user_{user.id}"

            # 准备通知内容
            notification_data = {
                'type': 'reminder.notification',
                'message': {
                    'id': str(reminder.id),
                    'title': reminder.title,
                    'description': reminder.description or "",
                    'due_date': reminder.due_date.isoformat(),
                    'priority': reminder.priority,
                    'category': getattr(reminder, 'category', 'other'),
                    'color': getattr(reminder, 'color', '#3498db'),
                    'timestamp': timezone.now().isoformat()
                }
            }

            # 发送通知
            async_to_sync(channel_layer.group_send)(
                group_name,
                notification_data
            )

            logger.info(f"成功向用户 {user.username} 发送WebSocket通知")
            return True
        except Exception as e:
            logger.error(f"发送WebSocket通知失败: {e}")
            return False

    def _schedule_next_notification(self, reminder):
        """
        安排下一次通知

        Args:
            reminder: 提醒对象

        Returns:
            ReminderNotification: 创建的通知
        """
        try:
            from reminder.services import ReminderService

            return ReminderService._schedule_notification(reminder)
        except Exception as e:
            logger.error(f"安排下一次通知失败: {e}")
            return None
