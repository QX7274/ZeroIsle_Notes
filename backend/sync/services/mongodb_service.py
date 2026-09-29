"""
MongoDB服务
提供与MongoDB Atlas的连接和操作

环境变量契约（RISK-BE-008）：
- 必填：MONGO_URI（缺失直接 ValueError）
- 可选：MONGO_DB_NAME（默认 ZeroIsle_Notes，兜底时打印「正在使用默认库名」显式日志）
- 可选：MONGO_SERVER_SELECTION_TIMEOUT_MS / MONGO_CONNECT_TIMEOUT_MS / MONGO_SOCKET_TIMEOUT_MS
- 可选：MONGO_TLS / MONGO_TLS_CA_FILE
- 可选：MONGO_CONFIG_STRICT（true=旧变量名直接失败，false=仅告警；缺省按 DEBUG 推导）

旧变量名对照表（不再隐式读取）：
    MONGO_DB -> MONGO_DB_NAME
    MONGO_HOST / MONGO_PORT / MONGO_USER / MONGO_PASSWORD -> MONGO_URI

策略：检测到「旧名已设置但对应新名未设置」时，生产（DEBUG=False）直接失败并给出可执行修复提示，
开发（DEBUG=True）降级为 WARNING；两种方式都打印变量对照表，绝不静默连到默认库名。
"""

import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# 设置日志
logger = logging.getLogger(__name__)

# 默认库名（未设置 MONGO_DB_NAME 时的兜底值；兜底时会打印显式日志）
DEFAULT_DB_NAME = 'ZeroIsle_Notes'

# 变量对照表：旧变量名 -> 当前变量名
LEGACY_ENV_MAPPING = (
    ('MONGO_DB', 'MONGO_DB_NAME'),
    ('MONGO_HOST', 'MONGO_URI'),
    ('MONGO_PORT', 'MONGO_URI'),
    ('MONGO_USER', 'MONGO_URI'),
    ('MONGO_PASSWORD', 'MONGO_URI'),
)

# 便于日志/异常直接展示的对照串
LEGACY_ENV_REMEDIATION = '；'.join(f'{old} -> {new}' for old, new in LEGACY_ENV_MAPPING)


class MongoConfigError(ValueError):
    """Mongo 连接配置错误。

    继承 ValueError，兼容既有调用方对 ValueError 的处理习惯（例如缺少 MONGO_URI 的分支）。
    """


def _is_probably_production():
    """判定当前是否按「生产」处理（旧变量名直接失败）。

    优先读取 Django settings.DEBUG（Django 已配置时）；未配置时回退环境变量 DEBUG。
    """
    try:
        from django.conf import settings
        if settings.configured:
            return not bool(getattr(settings, 'DEBUG', False))
    except Exception:
        # Django 未安装/未配置时按环境变量判断，不因探测失败中断初始化
        pass

    debug_value = str(os.environ.get('DEBUG', '')).strip().lower()
    return debug_value not in ('true', '1', 't', 'yes', 'on')


def is_strict_mongo_config():
    """是否对旧变量名采取「直接失败」策略。

    优先级：显式 MONGO_CONFIG_STRICT（true/false） > DEBUG 推导（DEBUG=False 视为生产，严格）。
    """
    override = str(os.environ.get('MONGO_CONFIG_STRICT', '')).strip().lower()
    if override in ('true', '1', 't', 'yes', 'on'):
        return True
    if override in ('false', '0', 'f', 'no', 'off'):
        return False
    return _is_probably_production()


def detect_legacy_mongo_env(env=None):
    """检测「设置了旧变量名但未设置对应新变量名」的部署。

    Args:
        env: 环境变量映射，默认 os.environ（便于单测注入）

    Returns:
        list: [(旧变量名, 应使用的新变量名)]，未命中返回空列表
    """
    source = os.environ if env is None else env

    def is_set(name):
        value = source.get(name)
        return value is not None and str(value).strip() != ''

    return [(old, new) for old, new in LEGACY_ENV_MAPPING if is_set(old) and not is_set(new)]


class MongoDBService:
    """
    MongoDB服务类（单例模式）
    提供与MongoDB Atlas的连接和操作
    """

    _instance = None
    client = None
    db = None
    initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBService, cls).__new__(cls)
            # 防止在模块导入时立即初始化，改为首次调用时初始化
        return cls._instance

    def initialize(self):
        """
        初始化MongoDB连接

        配置校验（RISK-BE-008）在读取任何连接参数之前执行：
        旧变量名（MONGO_DB/MONGO_HOST/MONGO_PORT...）必须显式暴露，绝不静默落到默认库名。
        """
        if self.initialized:
            return

        # 旧变量名先于连接参数校验，避免旧部署拿到「MONGO_URI not set」这类误导性错误
        self._assert_no_silent_legacy_config()

        try:
            # 获取MongoDB连接URI
            mongo_uri = os.environ.get('MONGO_URI')
            if not mongo_uri:
                raise ValueError("MONGO_URI environment variable not set.")
            db_name = self._resolve_db_name()

            # 获取连接参数
            server_selection_timeout_ms = int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000))
            connect_timeout_ms = int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', 5000))
            socket_timeout_ms = int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', 10000))

            # TLS/SSL 配置
            tls_enabled = os.environ.get('MONGO_TLS', 'False').lower() in ('true', '1', 't')
            tls_ca_file = os.environ.get('MONGO_TLS_CA_FILE')

            kwargs = {
                'serverSelectionTimeoutMS': server_selection_timeout_ms,
                'connectTimeoutMS': connect_timeout_ms,
                'socketTimeoutMS': socket_timeout_ms,
            }

            if tls_enabled:
                kwargs['tls'] = True
                if tls_ca_file and os.path.exists(tls_ca_file):
                    kwargs['tlsCAFile'] = tls_ca_file
                else:
                    logger.warning("MONGO_TLS is enabled but MONGO_TLS_CA_FILE is not set or does not exist.")

            # 创建MongoDB客户端
            self.client = MongoClient(mongo_uri, **kwargs)

            # 测试连接
            self.client.admin.command('ping')

            # 获取数据库
            self.db = self.client[db_name]

            self.initialized = True
            logger.info(f"MongoDB连接成功: {db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB连接失败: {str(e)}")
            self.initialized = False
            raise  # 抛出异常，让调用方处理
        except Exception as e:
            logger.error(f"MongoDB初始化失败: {str(e)}")
            self.initialized = False
            raise  # 抛出异常，让调用方处理



    def _assert_no_silent_legacy_config(self):
        """RISK-BE-008：旧变量名必须显式暴露，绝不静默。

        生产（DEBUG=False，或显式 MONGO_CONFIG_STRICT=true）直接抛 MongoConfigError 给出修复提示；
        开发（DEBUG=True）降级为 WARNING。两种方式都会打印完整变量对照表。
        """
        findings = detect_legacy_mongo_env()
        if not findings:
            return

        detail = '；'.join(f'{old} -> {new}' for old, new in findings)
        message = (
            '检测到旧的 MongoDB 环境变量但缺少对应的新变量名，旧变量不会被读取：'
            f'{detail}。变量对照表：{LEGACY_ENV_REMEDIATION}。'
            '请在部署环境改用（或同时设置）新变量名后重试。'
        )

        if is_strict_mongo_config():
            raise MongoConfigError(message)

        logger.warning(message)

    def _resolve_db_name(self):
        """解析库名：MONGO_DB_NAME 优先；兜底 DEFAULT_DB_NAME 时打印显式日志。"""
        configured = str(os.environ.get('MONGO_DB_NAME') or '').strip()
        if configured:
            logger.info('MongoDB 库名来自 MONGO_DB_NAME: %s', configured)
            return configured

        logger.info('未设置 MONGO_DB_NAME，正在使用默认库名: %s', DEFAULT_DB_NAME)
        return DEFAULT_DB_NAME

    def close(self):
        """
        关闭MongoDB连接
        """
        if self.client:
            self.client.close()
            logger.info("MongoDB连接已关闭")

# 创建单例实例
mongodb_service = MongoDBService()

# 导出单例实例与配置契约（变量对照表/校验函数，供测试与运维脚本复用）
__all__ = [
    'mongodb_service',
    'MongoDBService',
    'MongoConfigError',
    'detect_legacy_mongo_env',
    'is_strict_mongo_config',
    'LEGACY_ENV_MAPPING',
    'DEFAULT_DB_NAME',
]
