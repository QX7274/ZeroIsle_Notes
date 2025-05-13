from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .mongodb_models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    当用户创建时自动创建用户资料
    """
    if created:
        # 创建MongoDB用户资料
        profile = UserProfile(
            user=instance,
            django_user_id=str(instance.id)
        )
        profile.save()


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    当用户保存时自动保存用户资料
    """
    # 查找并更新MongoDB用户资料
    profile = UserProfile.objects(django_user_id=str(instance.id)).first()
    if profile:
        # 更新资料字段
        profile.username = instance.username
        profile.email = instance.email
        profile.save()
