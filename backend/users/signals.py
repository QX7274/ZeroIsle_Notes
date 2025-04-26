from django.db.models.signals import post_save
from django.dispatch import receiver
from .models.user import User
from .models.user_profile import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    当用户创建时自动创建用户资料
    """
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    当用户保存时自动保存用户资料
    """
    instance.profile.save()
