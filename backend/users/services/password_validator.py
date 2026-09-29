"""
密码强度校验器
提供密码强度验证和评分功能
"""

import re
import logging

logger = logging.getLogger(__name__)

# 密码策略配置
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True

# 常见弱密码列表（整串精确匹配，历史行为保留）
COMMON_WEAK_PASSWORDS = {
    'password', 'password123', '123456', '12345678', '123456789',
    'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'letmein',
    'iloveyou', 'admin', 'welcome', 'login', 'princess', 'sunshine',
    'password1', 'qwerty123', '1234567890', '000000', '111111',
}

# ---------------------------------------------------------------------------
# 弱口令词根判定（RISK-BE-010）
#
# 旧规则只做「整串精确匹配」，'Password123!' / 'P@ssw0rd' / 'PASSWORD123' 这类
# 「常见弱密码 + 后缀/大小写/字符替换」变体全部放行，弱口令策略形同虚设。
#
# 新规则 = 既有整串名单 + 归一化后的词根包含判定：
#   1. 原口令小写后命中 COMMON_WEAK_PASSWORDS；
#   2. 归一化（小写 + leet 还原 + 去非字母数字）后命中整串名单；
#   3. 归一化后包含任一 COMMON_WEAK_ROOTS 词根。
#
# 设计取舍（避免误伤强口令）：
# - 只收录「不做任何修饰就已经是高危弱口令」的强信号词；
# - **刻意不收录** 'pass' / 'word' / 'secret' / 'hello' 这类会出现在长口令里的普通子串，
#   否则 "Str0ngPassphrase!2026" 会因为含 'pass' 被误判为弱口令；
# - 已知边界（需产品确认）：包含词根的长口令（如 "MyPasswordIsVeryLong!2026"）仍判弱；
#   若产品希望放行此类长口令，需要额外引入长度/熵豁免，本次不做。
COMMON_WEAK_ROOTS = (
    'password', 'passwd', 'qwerty', 'azerty', 'letmein', 'iloveyou',
    'admin', 'administrator', 'welcome', 'monkey', 'dragon', 'master',
    'sunshine', 'princess', 'login', 'football', 'baseball', 'soccer',
    'superman', 'batman', 'starwars', 'trustno1', 'whatever', 'freedom',
    'shadow', 'michael', 'jordan', 'hunter', 'ranger', 'buster',
    'harley', 'tigger', 'charlie', 'donald', 'matthew', 'joshua',
    'amanda', 'ashley', 'nicole', 'chelsea',
    'abc123', '123456', '12345678', '123456789', '111111', '000000', '654321',
    'woaini', 'nihao',
)

# 常见 leet 替换：把 'P@ssw0rd' 归一化回 'password'
LEET_TRANSLATION = str.maketrans({
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't',
})

_NON_ALNUM_RE = re.compile(r'[^a-z0-9]')


def normalize_password_variants(password):
    """返回口令归一化后的可比形态（去重）：
    - 去符号但保留数字（'abc123456' 这类数字词根仍可命中）；
    - leet 还原后再去符号（'P@ssw0rd' → 'password'）。

    Args:
        password: 原始口令

    Returns:
        tuple: 归一化形态（可能为空元组）
    """
    if not password:
        return ()

    lowered = password.lower()
    stripped = _NON_ALNUM_RE.sub('', lowered)
    leet_normalized = _NON_ALNUM_RE.sub('', lowered.translate(LEET_TRANSLATION))
    return tuple({stripped, leet_normalized})


def is_common_weak_password(password):
    """判定是否为常见弱口令（RISK-BE-010）。

    Args:
        password: 原始口令

    Returns:
        bool: True 表示命中弱口令规则
    """
    if not password:
        return False

    if password.lower() in COMMON_WEAK_PASSWORDS:
        return True

    for variant in normalize_password_variants(password):
        if not variant:
            continue
        if variant in COMMON_WEAK_PASSWORDS:
            return True
        if any(root in variant for root in COMMON_WEAK_ROOTS):
            return True

    return False


class PasswordValidationError(Exception):
    """密码验证错误"""
    def __init__(self, errors):
        self.errors = errors
        super().__init__(str(errors))


class PasswordValidator:
    """
    密码强度校验器
    
    使用方法:
        validator = PasswordValidator()
        
        # 验证密码
        is_valid, errors = validator.validate('MyPassword123!')
        
        # 获取密码强度评分
        score = validator.get_strength_score('MyPassword123!')
        
        # 获取详细的强度信息
        info = validator.get_strength_info('MyPassword123!')
    """
    
    def __init__(
        self,
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
        require_uppercase=REQUIRE_UPPERCASE,
        require_lowercase=REQUIRE_LOWERCASE,
        require_digit=REQUIRE_DIGIT,
        require_special=REQUIRE_SPECIAL
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.require_uppercase = require_uppercase
        self.require_lowercase = require_lowercase
        self.require_digit = require_digit
        self.require_special = require_special
    
    def validate(self, password, username=None):
        """
        验证密码是否符合要求
        
        Args:
            password: 密码字符串
            username: 用户名（可选，用于检查密码是否包含用户名）
            
        Returns:
            tuple: (is_valid, errors_list)
        """
        errors = []
        
        if not password:
            errors.append('密码不能为空')
            return False, errors
        
        # 长度检查
        if len(password) < self.min_length:
            errors.append(f'密码长度至少为{self.min_length}个字符')
        
        if len(password) > self.max_length:
            errors.append(f'密码长度不能超过{self.max_length}个字符')
        
        # 字符类型检查
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            errors.append('密码必须包含至少一个大写字母')
        
        if self.require_lowercase and not re.search(r'[a-z]', password):
            errors.append('密码必须包含至少一个小写字母')
        
        if self.require_digit and not re.search(r'\d', password):
            errors.append('密码必须包含至少一个数字')
        
        if self.require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]', password):
            errors.append('密码必须包含至少一个特殊字符')
        
        # 检查常见弱密码（RISK-BE-010：整串名单 + 归一化后的词根包含判定）
        if is_common_weak_password(password):
            errors.append('密码过于常见，请使用更复杂的密码')
        
        # 检查密码是否包含用户名
        if username and username.lower() in password.lower():
            errors.append('密码不能包含用户名')
        
        # 检查重复字符
        if self._has_repeated_chars(password, 3):
            errors.append('密码不能包含3个或更多连续相同的字符')
        
        # 检查简单序列
        if self._has_sequential_chars(password, 4):
            errors.append('密码不能包含4个或更多连续的字符序列（如1234或abcd）')
        
        return len(errors) == 0, errors
    
    def get_strength_score(self, password):
        """
        获取密码强度评分 (0-100)
        
        评分规则:
        - 长度: 最高30分
        - 字符多样性: 最高40分
        - 额外加分: 最高30分
        
        Args:
            password: 密码字符串
            
        Returns:
            int: 0-100的评分
        """
        if not password:
            return 0
        
        score = 0
        
        # 长度评分 (最高30分)
        length = len(password)
        if length >= 16:
            score += 30
        elif length >= 12:
            score += 25
        elif length >= 10:
            score += 20
        elif length >= 8:
            score += 15
        elif length >= 6:
            score += 10
        else:
            score += 5
        
        # 字符多样性评分 (最高40分)
        has_lower = bool(re.search(r'[a-z]', password))
        has_upper = bool(re.search(r'[A-Z]', password))
        has_digit = bool(re.search(r'\d', password))
        has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]', password))
        
        char_types = sum([has_lower, has_upper, has_digit, has_special])
        score += char_types * 10
        
        # 额外加分 (最高30分)
        
        # 长度超过12额外加分
        if length > 12:
            score += min((length - 12) * 2, 10)
        
        # 特殊字符数量加分
        special_count = len(re.findall(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]', password))
        if special_count >= 3:
            score += 10
        elif special_count >= 2:
            score += 5
        
        # 无重复字符加分
        if not self._has_repeated_chars(password, 2):
            score += 5
        
        # 无简单序列加分
        if not self._has_sequential_chars(password, 3):
            score += 5
        
        # 扣分项（与 validate 共用同一套弱密码判定，避免两处口径不一致）
        if is_common_weak_password(password):
            score -= 30
        
        return max(0, min(100, score))
    
    def get_strength_info(self, password, username=None):
        """
        获取详细的密码强度信息
        
        Args:
            password: 密码字符串
            username: 用户名（可选）
            
        Returns:
            dict: 包含强度信息的字典
        """
        is_valid, errors = self.validate(password, username)
        score = self.get_strength_score(password)
        
        # 确定强度等级
        if score >= 80:
            level = 'strong'
            level_text = '强'
            level_color = '#4CAF50'  # 绿色
        elif score >= 60:
            level = 'medium'
            level_text = '中'
            level_color = '#FF9800'  # 橙色
        elif score >= 40:
            level = 'weak'
            level_text = '弱'
            level_color = '#FF5722'  # 深橙色
        else:
            level = 'very_weak'
            level_text = '非常弱'
            level_color = '#F44336'  # 红色
        
        # 检查各项要求
        checks = {
            'length': len(password) >= self.min_length if password else False,
            'uppercase': bool(re.search(r'[A-Z]', password)) if password else False,
            'lowercase': bool(re.search(r'[a-z]', password)) if password else False,
            'digit': bool(re.search(r'\d', password)) if password else False,
            'special': bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]', password)) if password else False,
        }
        
        return {
            'is_valid': is_valid,
            'score': score,
            'level': level,
            'level_text': level_text,
            'level_color': level_color,
            'errors': errors,
            'checks': checks,
            'suggestions': self._get_suggestions(password, checks),
        }
    
    def _get_suggestions(self, password, checks):
        """
        获取改进密码的建议
        """
        suggestions = []
        
        if not password:
            return ['请输入密码']
        
        if not checks.get('length'):
            suggestions.append(f'增加密码长度至{self.min_length}个字符以上')
        
        if not checks.get('uppercase'):
            suggestions.append('添加大写字母')
        
        if not checks.get('lowercase'):
            suggestions.append('添加小写字母')
        
        if not checks.get('digit'):
            suggestions.append('添加数字')
        
        if not checks.get('special'):
            suggestions.append('添加特殊字符（如 !@#$%）')
        
        if len(password) < 12:
            suggestions.append('考虑使用12个字符以上的密码以提高安全性')
        
        return suggestions
    
    def _has_repeated_chars(self, password, count):
        """
        检查是否有连续重复的字符
        """
        if not password or len(password) < count:
            return False
        
        for i in range(len(password) - count + 1):
            if len(set(password[i:i + count])) == 1:
                return True
        return False
    
    def _has_sequential_chars(self, password, count):
        """
        检查是否有简单的字符序列（如1234, abcd）
        """
        if not password or len(password) < count:
            return False
        
        sequences = [
            '0123456789',
            'abcdefghijklmnopqrstuvwxyz',
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm',
        ]
        
        password_lower = password.lower()
        
        for seq in sequences:
            for i in range(len(seq) - count + 1):
                substring = seq[i:i + count]
                if substring in password_lower:
                    return True
                # 反向检查
                if substring[::-1] in password_lower:
                    return True
        
        return False


# 全局单例
_default_validator = None


def get_password_validator():
    """
    获取默认的密码验证器实例
    """
    global _default_validator
    if _default_validator is None:
        _default_validator = PasswordValidator()
    return _default_validator


def validate_password(password, username=None):
    """
    便捷函数：验证密码
    
    Args:
        password: 密码字符串
        username: 用户名（可选）
        
    Returns:
        tuple: (is_valid, errors)
    """
    return get_password_validator().validate(password, username)


def get_password_strength(password):
    """
    便捷函数：获取密码强度评分
    
    Args:
        password: 密码字符串
        
    Returns:
        int: 0-100的评分
    """
    return get_password_validator().get_strength_score(password)


def get_password_strength_info(password, username=None):
    """
    便捷函数：获取详细的密码强度信息
    
    Args:
        password: 密码字符串
        username: 用户名（可选）
        
    Returns:
        dict: 密码强度信息
    """
    return get_password_validator().get_strength_info(password, username)
