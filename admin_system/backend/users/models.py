from mongoengine import Document, StringField, EmailField, URLField, DateTimeField, BooleanField, DictField, ListField, ReferenceField, UUIDField, IntField
from django.utils import timezone
import uuid

class UserProfile(Document):
    """用户资料 - 对应主软件的用户模型"""
    USER_STATUS_CHOICES = (
        ('active', '活跃'),
        ('inactive', '未激活'),
        ('banned', '已禁用'),
    )

    # 主键口径必须与主后端 backend/users/mongodb_models.py:User 一致。
    #
    # 历史缺陷（务必不要改回 binary=False）：此处曾写死 binary=False，
    # 导致 mongoengine 把 _id 落库成**字符串**；而主后端用默认的
    # UUIDField(binary=True)（见 mongoengine UUIDField.__init__ 默认值），
    # 落库为 **Binary UUID**（BSON subtype 4）。两者指向同一个 users 集合，于是：
    #   - 管理端写入的用户，主后端按 Binary UUID 反解 → 查不到（DoesNotExist）；
    #   - 主后端写入的用户，管理端按字符串查 → 同样查不到；
    #   - UserActivity.user / VerificationCode.user 等 ReferenceField 也会因
    #     主键类型不匹配而引用失败。
    # 这与主后端注释中记录的 RISK-BE-003 属同一类事故。
    #
    # 修复：去掉 binary=False，使用默认值（binary=True）与主后端对齐。
    # 注意：**已存在的历史字符串 _id 数据不会被本次改动修正**，需要另做数据迁移，
    # 否则库中会并存两种主键形态。迁移方案见 docs/管理后台功能基线与演进规划.md。
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    username = StringField(max_length=150, unique=True, required=True, verbose_name='用户名')
    email = EmailField(unique=True, sparse=True, verbose_name='邮箱')
    phone = StringField(max_length=20, unique=True, sparse=True, verbose_name='手机号')
    nickname = StringField(max_length=50, verbose_name='昵称')
    avatar = URLField(verbose_name='头像URL')
    bio = StringField(verbose_name='个人简介')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_staff = BooleanField(default=False, verbose_name='是否管理员')
    # is_superuser 同样由主后端声明（backend/users/mongodb_models.py:34）并写入 users 集合。
    # 管理后台此前未声明它，而 mongoengine 的 Document.__getattr__ 对未知字段会抛
    # FieldDoesNotExist —— 即使写成 getattr(user, 'is_superuser', False) 也会抛，
    # 因为默认值只在 AttributeError 时生效，而这里抛的是 FieldDoesNotExist。
    # 影响：任何读取该字段的权限判定（如 analytics 的 _is_admin）都会 500。
    is_superuser = BooleanField(default=False, verbose_name='是否超级用户')
    status = StringField(choices=USER_STATUS_CHOICES, default='active', verbose_name='状态')
    preferences = DictField(verbose_name='用户偏好设置')
    wechat_id = StringField(max_length=100, unique=True, sparse=True, verbose_name='微信ID')
    qq_id = StringField(max_length=100, unique=True, sparse=True, verbose_name='QQ ID')
    date_joined = DateTimeField(default=timezone.now, verbose_name='注册时间')
    last_login = DateTimeField(verbose_name='最后登录时间')

    # --- 与主后端 users 集合对齐的字段（只读用途）---
    #
    # 为什么必须显式声明：mongoengine 的 Document.__getattr__ 对**未声明**字段会抛
    # FieldDoesNotExist，而且 getattr(obj, name, default) **屏蔽不掉** ——
    # 默认值只在抛 AttributeError 时生效，这里抛的是 FieldDoesNotExist。
    # 因此只要代码里读到某个未声明字段，接口就会 500。
    #
    # 这些字段在 users 集合中确实存在（主后端 backend/users/mongodb_models.py 声明并写入），
    # 管理后台此前未声明它们，构成了同类隐患。此处补齐，使管理端能安全读取。
    first_name = StringField(max_length=30, default='', verbose_name='名')
    last_name = StringField(max_length=150, default='', verbose_name='姓')
    is_verified = BooleanField(default=False, verbose_name='是否已验证')
    last_login_ip = StringField(max_length=100, verbose_name='最后登录IP')
    django_user_id = StringField(max_length=36, sparse=True, verbose_name='Django用户ID')
    # 第三方登录凭证（只读展示；管理后台不参与登录，故不用于鉴权）
    wechat_openid = StringField(max_length=100, sparse=True, verbose_name='微信OpenID')
    wechat_unionid = StringField(max_length=100, verbose_name='微信UnionID')
    wechat_avatar = URLField(verbose_name='微信头像URL')
    qq_openid = StringField(max_length=100, sparse=True, verbose_name='QQ OpenID')
    qq_avatar = URLField(verbose_name='QQ头像URL')
    # Realm 同步相关（阶段3 已确认本集合与主后端共用）
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_api_key = StringField(max_length=100, sparse=True, verbose_name='Realm API Key')
    realm_app_id = StringField(max_length=100, sparse=True, verbose_name='Realm App ID')
    realm_sync_enabled = BooleanField(default=True, verbose_name='是否启用Realm同步')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')

    # 统计字段
    note_count = IntField(default=0, verbose_name='笔记数量')
    canvas_count = IntField(default=0, verbose_name='画布数量')
    login_count = IntField(default=0, verbose_name='登录次数')

    # 密码哈希（方案 B 必需）
    #
    # 这个字段在 users 集合里**一直存在** —— 主后端
    # backend/users/mongodb_models.py:26 声明了 password = StringField(required=True)，
    # 并由 login/register 写入。但管理后台的 UserProfile 此前没有声明它，
    # 于是 mongoengine 既不加载、也不允许查询该字段：
    #   - UserProfile.objects(username=...) 取回的文档没有 password 属性；
    #   - 用 .update(password=...) 会抛 InvalidQueryError: Cannot resolve field "password"。
    # 结果是管理后台**无法校验任何密码**，登录不可能成功。
    # 现在显式声明，使管理后台能读取主后端写入的同一份哈希。
    password = StringField(required=False, verbose_name='密码哈希')

    # 密码重置相关字段
    password_reset_at = DateTimeField(verbose_name='密码重置时间')
    password_reset_by = StringField(max_length=150, verbose_name='密码重置管理员')

    meta = {
        'collection': 'users',  # 对应主软件的用户集合
        'ordering': ['-date_joined'],
        'indexes': [
            'username',
            'email',
            'phone',
            'is_active',
            'status',
            'date_joined',
            'last_login'
        ],
        'verbose_name': '用户资料',
        'verbose_name_plural': '用户资料'
    }

    def __str__(self):
        return self.username or self.email or str(self.id)

    @property
    def full_name(self):
        return self.nickname or self.username

    @property
    def is_banned(self):
        return self.status == 'banned' or not self.is_active

    # --- DRF 兼容属性（方案 B 必需）---
    #
    # 方案 B 让 DRF 的 request.user 直接是 mongoengine 用户文档。
    # DRF 的 IsAuthenticated 权限类会检查 `user.is_authenticated`，
    # 若该属性不存在，*所有*受保护接口都会被判为未认证。
    # 主后端 backend/users/mongodb_models.py:100 也定义了同名属性，此处对齐。
    @property
    def is_authenticated(self):
        """经认证取到的用户对象恒为已认证（与主后端口径一致）。"""
        return True

    @property
    def is_anonymous(self):
        return False

class UserActivity(Document):
    """用户活动记录

    注意：collection 为 **user_activities**，与主后端
    backend/common/analytics_service.py:UserActivity 是同一个集合。

    主后端该模型使用 user_id = StringField(...)（字符串外键）且带 90 天 TTL 索引；
    此处原先用 user = ReferenceField(UserProfile)。在主键口径已对齐（见上）
    之后，ReferenceField 可以正常解引用，但两边字段形态仍不一致，
    属阶段3后续待对齐项；当前先补主键，避免新写入的文档落成 ObjectId。
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(UserProfile, required=True, verbose_name='用户')
    activity_type = StringField(required=True, verbose_name='活动类型')
    description = StringField(verbose_name='活动描述')
    ip_address = StringField(verbose_name='IP地址')
    user_agent = StringField(verbose_name='用户代理')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'user_activities',
        'ordering': ['-created_at'],
        'indexes': [
            'user',
            'activity_type',
            'created_at'
        ],
        'verbose_name': '用户活动',
        'verbose_name_plural': '用户活动'
    }

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.created_at}"

class VerificationCode(Document):
    """验证码

    注意：collection 为 **verification_codes**，与主后端
    backend/users/mongodb_models.py:VerificationCode 是同一个集合，
    主键口径必须一致（主后端为 UUID binary）。
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())

    PURPOSE_CHOICES = (
        ('register', '注册'),
        ('login', '登录'),
        ('reset_password', '重置密码'),
        ('change_phone', '变更手机号'),
        ('change_email', '变更邮箱'),
    )

    user = ReferenceField(UserProfile, required=False, verbose_name='用户')
    email = EmailField(sparse=True, verbose_name='邮箱')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    code = StringField(max_length=10, required=True, verbose_name='验证码')
    purpose = StringField(choices=PURPOSE_CHOICES, required=True, verbose_name='用途')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    is_used = BooleanField(default=False, verbose_name='是否已使用')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    created_by = StringField(max_length=150, verbose_name='创建者')

    meta = {
        'collection': 'verification_codes',
        'ordering': ['-created_at'],
        'indexes': [
            'user',
            'email',
            'phone',
            'code',
            'purpose',
            'expires_at',
            'is_used',
            'created_at'
        ],
        'verbose_name': '验证码',
        'verbose_name_plural': '验证码'
    }

    def __str__(self):
        return f"{self.code} - {self.purpose} - {self.created_at}"
