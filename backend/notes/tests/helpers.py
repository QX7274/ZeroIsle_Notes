"""backend/notes/tests 共用辅助：Django auth User 与 mongoengine MongoUser 的解析。

背景（RISK-BE-002 后续）：
notes 的文档模型（Category / Note / Tag）用 mongoengine ReferenceField 引用
users.mongodb_models.User（下面简称 MongoUser）；Django 侧 auth User 由
users/signals.py 的 post_save 镜像成 MongoUser，两者靠 MongoUser.django_user_id 关联。
生产代码已经做了这层解析（notes/views/realm_note.py::_get_mongo_user），
测试若要直接构造这些文档，也必须先把 Django user 解析成对应的 MongoUser，
否则 mongoengine 会把 Django User 对象原样送进 bson 编码并抛
InvalidDocument: cannot encode object <users.models.user.User>。

本模块只被测试使用，不改动业务信号/视图。
"""

from users.mongodb_models import User as MongoUser


def reset_mongo_test_data():
    """清空本目录测试会写入的 mongoengine 集合。

    mongomock 不参与 Django 的事务回滚（django.test.TestCase 只回滚 SQLite），
    同一个 pytest 进程里跨用例会命中唯一索引
    （MongoUser.username / Category(user,name) / Tag(user,name)）而报 NotUniqueError。
    因此每个用例开始前显式清一次，恢复「用例隔离」这一测试本该有的前提。
    只清测试数据，不触碰兼容垫片，也不改业务代码。
    """
    # 延迟导入：避免测试收集阶段就拉起全部模型
    from users.mongodb_models import UserProfile
    from notes.mongodb_models import Note, NoteVersion, NoteShare, Category, Tag

    for model in (NoteShare, NoteVersion, Note, Tag, Category, UserProfile, MongoUser):
        model.objects.all().delete()


def mongo_user_for(django_user):
    """返回 Django user 对应的 MongoUser（与生产 _get_mongo_user 同口径）。

    - 信号已镜像时直接复用（按 django_user_id，退回 username）；
    - 信号未注册/未触发时按同一映射补建（password 是 required 字段，用 Django
      侧已哈希的密码回填，绝不写明文）。
    """
    if django_user is None:
        return None

    mapping = str(django_user.id)
    mongo_user = (
        MongoUser.objects(django_user_id=mapping).first()
        or MongoUser.objects(username=django_user.username).first()
    )

    if mongo_user is not None:
        if not mongo_user.django_user_id:
            # 补齐映射，保证后续按 django_user_id 能查到同一个 MongoUser
            mongo_user.django_user_id = mapping
            mongo_user.save()
        return mongo_user

    return MongoUser(
        username=django_user.username,
        email=getattr(django_user, 'email', None) or None,
        phone=getattr(django_user, 'phone', None) or None,
        password=getattr(django_user, 'password', '') or '!unusable-password-hash',
        django_user_id=mapping,
    ).save()
