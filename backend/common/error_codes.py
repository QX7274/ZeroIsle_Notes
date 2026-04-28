"""
全局API错误码定义

错误码规范:
- 1xxx: 认证/授权错误
- 2xxx: 资源错误
- 3xxx: 业务逻辑错误
- 5xxx: 服务器错误
"""

# ============ 认证/授权错误 (1xxx) ============

UNAUTHORIZED = 1001
"""未认证 - 用户未登录或Token无效"""

FORBIDDEN = 1002
"""权限不足 - 用户无权访问该资源"""

TOKEN_EXPIRED = 1003
"""Token已过期 - 需要刷新Token"""

TOKEN_INVALID = 1004
"""Token无效 - Token格式错误或被篡改"""

INVALID_CREDENTIALS = 1005
"""凭证无效 - 用户名或密码错误"""

# ============ 资源错误 (2xxx) ============

NOT_FOUND = 2001
"""资源不存在 - 请求的资源不存在"""

RESOURCE_CONFLICT = 2002
"""资源冲突 - 资源已存在或状态冲突"""

RESOURCE_DELETED = 2003
"""资源已删除 - 请求的资源已被删除"""

# ============ 业务逻辑错误 (3xxx) ============

INVALID_INPUT = 3001
"""输入无效 - 请求参数不符合要求"""

OPERATION_FAILED = 3002
"""操作失败 - 业务操作执行失败"""

INVALID_STATE = 3003
"""状态无效 - 资源状态不允许该操作"""

QUOTA_EXCEEDED = 3004
"""配额超限 - 超过使用限制"""

DUPLICATE_ENTRY = 3005
"""重复条目 - 数据重复"""

# ============ 服务错误 (5xxx) ============

INTERNAL_ERROR = 5000
"""服务器错误 - 内部服务器错误"""

SERVICE_UNAVAILABLE = 5001
"""服务不可用 - 服务暂时不可用"""

DATABASE_ERROR = 5002
"""数据库错误 - 数据库操作失败"""

EXTERNAL_SERVICE_ERROR = 5003
"""外部服务错误 - 调用外部服务失败"""

FILE_OPERATION_ERROR = 5004
"""文件操作错误 - 文件操作失败"""

# ============ AI服务特定错误 (3100-3199) ============

AI_SERVICE_ERROR = 3100
"""AI服务错误 - AI服务调用失败"""

AI_RATE_LIMIT = 3101
"""AI速率限制 - 超过API调用频率限制"""

AI_INVALID_MODEL = 3102
"""AI模型无效 - 指定的模型不存在"""

AI_TIMEOUT = 3103
"""AI超时 - AI服务响应超时"""

# ============ 错误码映射表 ============

ERROR_CODE_MAP = {
    UNAUTHORIZED: '未认证',
    FORBIDDEN: '权限不足',
    TOKEN_EXPIRED: 'Token已过期',
    TOKEN_INVALID: 'Token无效',
    INVALID_CREDENTIALS: '凭证无效',
    NOT_FOUND: '资源不存在',
    RESOURCE_CONFLICT: '资源冲突',
    RESOURCE_DELETED: '资源已删除',
    INVALID_INPUT: '输入无效',
    OPERATION_FAILED: '操作失败',
    INVALID_STATE: '状态无效',
    QUOTA_EXCEEDED: '配额超限',
    DUPLICATE_ENTRY: '重复条目',
    INTERNAL_ERROR: '服务器错误',
    SERVICE_UNAVAILABLE: '服务不可用',
    DATABASE_ERROR: '数据库错误',
    EXTERNAL_SERVICE_ERROR: '外部服务错误',
    FILE_OPERATION_ERROR: '文件操作错误',
    AI_SERVICE_ERROR: 'AI服务错误',
    AI_RATE_LIMIT: 'AI速率限制',
    AI_INVALID_MODEL: 'AI模型无效',
    AI_TIMEOUT: 'AI超时',
}


def get_error_message(code):
    """
    根据错误码获取错误消息
    
    Args:
        code: 错误码
        
    Returns:
        str: 错误消息，如果错误码不存在则返回'未知错误'
    """
    return ERROR_CODE_MAP.get(code, '未知错误')

