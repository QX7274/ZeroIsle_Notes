"""
验证器工具函数
"""

import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

def validate_phone_number(value):
    """验证手机号码"""
    if not re.match(r'^1[3-9]\d{9}$', value):
        raise ValidationError(
            _('%(value)s 不是有效的手机号码'),
            params={'value': value},
        )

def validate_password_strength(value):
    """验证密码强度"""
    # 至少8个字符
    if len(value) < 8:
        raise ValidationError(_('密码长度至少为8个字符'))
    
    # 至少包含一个数字
    if not any(char.isdigit() for char in value):
        raise ValidationError(_('密码必须包含至少一个数字'))
    
    # 至少包含一个字母
    if not any(char.isalpha() for char in value):
        raise ValidationError(_('密码必须包含至少一个字母'))
    
    # 至少包含一个特殊字符（可选）
    # if not any(char in '!@#$%^&*()_+-=[]{}|;:,.<>?/~`' for char in value):
    #     raise ValidationError(_('密码必须包含至少一个特殊字符'))

def validate_username(value):
    """验证用户名"""
    # 只允许字母、数字、下划线和连字符
    if not re.match(r'^[a-zA-Z0-9_-]+$', value):
        raise ValidationError(_('用户名只能包含字母、数字、下划线和连字符'))
    
    # 长度限制
    if len(value) < 3 or len(value) > 30:
        raise ValidationError(_('用户名长度必须在3-30个字符之间'))
    
    # 不能以数字开头
    if value[0].isdigit():
        raise ValidationError(_('用户名不能以数字开头'))
    
    # 不能是纯数字
    if value.isdigit():
        raise ValidationError(_('用户名不能是纯数字'))
