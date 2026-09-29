"""
MongoDB 环境变量统一解析（RISK-BE-008 收口）单元测试

覆盖 4 类场景：
1. 只设旧名（MONGO_HOST/PORT/USER/PASSWORD/MONGO_DB）-> 拼出等价 URI/库名 + 大声弃用 WARNING（含变量对照表）
2. 只设新名（MONGO_URI/MONGO_DB_NAME）-> 取值正确、无告警
3. 新旧都设 -> 新名生效、无告警
4. 都不设 -> 保持既有契约（不生成 URI；库名默认并打印「正在使用默认库名」）

并验证 settings 侧回填后与 sync.services.mongodb_service 的 guard 口径一致（不再「一半认旧名、一半报错」）。
所有用例均为纯函数 + 注入 env/logger，不连接真实 Mongo。
"""

from unittest import TestCase, mock

from django.conf import settings

from backend.settings.base import (
    DEFAULT_DB_NAME,
    DEFAULT_MONGO_PORT,
    LEGACY_MONGO_ENV_MAPPING,
    MONGO_SOURCE_DEFAULT,
    MONGO_SOURCE_LEGACY,
    MONGO_SOURCE_NEW,
    apply_resolved_mongo_env,
    mongo_legacy_vars_in_use,
    resolve_mongo_config,
)

from ..services.mongodb_service import detect_legacy_mongo_env

FULL_URI = 'mongodb://new-host:27017/NewDb'


def _log_text(log):
    """把 mock logger 的 warning/info 调用拼成文本，便于断言对照表文案。"""
    lines = []
    for call in list(log.warning.call_args_list) + list(log.info.call_args_list):
        lines.append(' '.join(str(arg) for arg in call.args))
    return '\n'.join(lines)


class ResolveMongoConfigTests(TestCase):
    """resolve_mongo_config 的四类场景。"""

    def _resolve(self, env):
        log = mock.MagicMock()
        return resolve_mongo_config(env=dict(env), log=log), log

    def test_only_legacy_vars_resolve_and_warn_loudly(self):
        """只设旧名：拼出等价 URI/库名，并大声告警（含变量对照表）。"""
        env = {
            'MONGO_HOST': 'legacy-host',
            'MONGO_PORT': '27018',
            'MONGO_USER': 'legacy-user',
            'MONGO_PASSWORD': 'legacy-pass',
            'MONGO_DB': 'LegacyDb',
        }

        config, log = self._resolve(env)

        self.assertEqual(
            config['uri'],
            'mongodb://legacy-user:legacy-pass@legacy-host:27018/LegacyDb?authSource=admin',
        )
        self.assertEqual(config['uri_source'], MONGO_SOURCE_LEGACY)
        self.assertEqual(config['db_name'], 'LegacyDb')
        self.assertEqual(config['db_name_source'], MONGO_SOURCE_LEGACY)
        self.assertEqual(config['legacy_vars'], list(LEGACY_MONGO_ENV_MAPPING))

        text = _log_text(log)
        self.assertIn('MONGO_DB -> MONGO_DB_NAME', text)
        self.assertIn('MONGO_HOST -> MONGO_URI', text)
        self.assertIn('MONGO_PORT -> MONGO_URI', text)
        self.assertIn('MONGO_USER -> MONGO_URI', text)
        self.assertIn('MONGO_PASSWORD -> MONGO_URI', text)
        self.assertIn('变量对照表', text)
        # 旧名已提供库名，不应误报默认库名
        self.assertNotIn('正在使用默认库名', text)

    def test_legacy_db_only_uses_legacy_db_name_without_uri(self):
        """只有旧库名（无连接参数）：不拼 URI，但库名取旧名并告警。"""
        config, log = self._resolve({'MONGO_DB': 'LegacyDb'})

        self.assertEqual(config['uri'], '')
        self.assertEqual(config['uri_source'], MONGO_SOURCE_DEFAULT)
        self.assertEqual(config['db_name'], 'LegacyDb')
        self.assertEqual(config['db_name_source'], MONGO_SOURCE_LEGACY)
        self.assertIn('MONGO_DB -> MONGO_DB_NAME', _log_text(log))

    def test_only_new_vars_no_warning(self):
        """只设新名：取值正确且没有任何弃用告警。"""
        config, log = self._resolve({'MONGO_URI': FULL_URI, 'MONGO_DB_NAME': 'NewDb'})

        self.assertEqual(config['uri'], FULL_URI)
        self.assertEqual(config['uri_source'], MONGO_SOURCE_NEW)
        self.assertEqual(config['db_name'], 'NewDb')
        self.assertEqual(config['db_name_source'], MONGO_SOURCE_NEW)
        self.assertEqual(config['legacy_vars'], [])
        log.warning.assert_not_called()

    def test_new_vars_win_over_legacy_without_warning(self):
        """新旧都设：新名生效，旧名不参与、不告警。"""
        env = {
            'MONGO_URI': FULL_URI,
            'MONGO_DB_NAME': 'NewDb',
            'MONGO_HOST': 'legacy-host',
            'MONGO_PORT': '27018',
            'MONGO_USER': 'legacy-user',
            'MONGO_PASSWORD': 'legacy-pass',
            'MONGO_DB': 'LegacyDb',
        }

        config, log = self._resolve(env)

        self.assertEqual(config['uri'], FULL_URI)
        self.assertEqual(config['uri_source'], MONGO_SOURCE_NEW)
        self.assertEqual(config['db_name'], 'NewDb')
        self.assertEqual(config['db_name_source'], MONGO_SOURCE_NEW)
        self.assertEqual(config['legacy_vars'], [])
        self.assertEqual(mongo_legacy_vars_in_use(env), [])
        log.warning.assert_not_called()

    def test_neither_set_keeps_existing_contract(self):
        """都不设：不生成 URI（保留 base.py 本地连接分支契约），库名默认并显式打印。"""
        config, log = self._resolve({})

        self.assertEqual(config['uri'], '')
        self.assertEqual(config['uri_source'], MONGO_SOURCE_DEFAULT)
        self.assertEqual(config['db_name'], DEFAULT_DB_NAME)
        self.assertEqual(config['db_name_source'], MONGO_SOURCE_DEFAULT)
        self.assertEqual(config['legacy_vars'], [])
        log.warning.assert_not_called()
        text = _log_text(log)
        self.assertIn('正在使用默认库名', text)
        self.assertIn(DEFAULT_DB_NAME, text)

    def test_invalid_legacy_port_falls_back_to_default(self):
        """旧端口非法时回退默认端口并告警，不把启动打挂。"""
        config, log = self._resolve({'MONGO_HOST': 'legacy-host', 'MONGO_PORT': 'not-a-port'})

        self.assertEqual(config['uri'], f'mongodb://legacy-host:{DEFAULT_MONGO_PORT}/')
        self.assertIn('MONGO_PORT', _log_text(log))

    def test_legacy_password_is_url_encoded(self):
        """旧名带特殊字符的账号密码需要 URL 编码后才能拼进 URI。"""
        config, _ = self._resolve({
            'MONGO_HOST': 'legacy-host',
            'MONGO_USER': 'user@example.com',
            'MONGO_PASSWORD': 'p@ss:word',
        })

        self.assertEqual(
            config['uri'],
            'mongodb://user%40example.com:p%40ss%3Aword@legacy-host:27017/?authSource=admin',
        )


class ApplyResolvedMongoEnvTests(TestCase):
    """settings 回填 os.environ 后与 sync 服务 guard 的口径一致性。"""

    def test_settings_backfill_makes_guard_consistent(self):
        """旧名兜底解析后回填新名，guard 不再把同一份配置判为「缺新名」。"""
        env = {'MONGO_HOST': 'legacy-host', 'MONGO_PORT': '27018', 'MONGO_DB': 'LegacyDb'}
        config = resolve_mongo_config(env=env, log=mock.MagicMock())

        # 回填前：这就是 task-31 里「settings 认旧名、sync 服务却要失败」的矛盾点
        self.assertNotEqual(detect_legacy_mongo_env(env), [])

        applied = apply_resolved_mongo_env(config, env=env)

        self.assertEqual(sorted(applied), ['MONGO_DB_NAME', 'MONGO_URI'])
        # 回填后：下游 guard 看到的是「新名已就绪」，不会再失败/告警
        self.assertEqual(detect_legacy_mongo_env(env), [])
        self.assertEqual(env['MONGO_URI'], 'mongodb://legacy-host:27018/LegacyDb')
        self.assertEqual(env['MONGO_DB_NAME'], 'LegacyDb')

    def test_backfill_skips_explicit_new_vars(self):
        """显式新名优先，回填不覆盖。"""
        env = {'MONGO_URI': FULL_URI, 'MONGO_DB_NAME': 'NewDb', 'MONGO_HOST': 'legacy-host'}
        config = resolve_mongo_config(env=env, log=mock.MagicMock())

        self.assertEqual(apply_resolved_mongo_env(config, env=env), [])
        self.assertEqual(env['MONGO_URI'], FULL_URI)
        self.assertEqual(env['MONGO_DB_NAME'], 'NewDb')

    def test_default_values_are_not_backfilled(self):
        """默认值（本地 localhost/默认库名）不回填，保留 sync 服务「缺 MONGO_URI 即报错」契约。"""
        env = {}
        config = resolve_mongo_config(env=env, log=mock.MagicMock())

        self.assertEqual(apply_resolved_mongo_env(config, env=env), [])
        self.assertEqual(env, {})

    def test_backfill_is_idempotent(self):
        env = {'MONGO_DB': 'LegacyDb'}
        config = resolve_mongo_config(env=env, log=mock.MagicMock())

        self.assertEqual(apply_resolved_mongo_env(config, env=env), ['MONGO_DB_NAME'])
        self.assertEqual(apply_resolved_mongo_env(config, env=env), [])
        self.assertEqual(env['MONGO_DB_NAME'], 'LegacyDb')

    def test_settings_expose_resolved_mongo_contract(self):
        """settings 必须暴露解析后的 MONGO_URI / MONGO_DB_NAME，供下游共用同一口径。"""
        self.assertTrue(hasattr(settings, 'MONGO_URI'))
        self.assertTrue(hasattr(settings, 'MONGO_DB_NAME'))
        self.assertTrue(str(settings.MONGO_DB_NAME).strip())
