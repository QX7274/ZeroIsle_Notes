from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .mongodb_models import UserProfile, User as MongoUser

User = get_user_model()


@receiver(post_save, sender=User)
def create_mongo_user_and_profile(sender, instance, created, **kwargs):
    """
    When a Django User is created, automatically create the corresponding
    MongoUser and UserProfile documents.
    """
    if created:
        # 1. Reuse existing MongoUser first (avoid duplicate username/email/phone)
        mongo_user = (
            MongoUser.objects(django_user_id=str(instance.id)).first()
            or MongoUser.objects(username=instance.username).first()
        )

        if not mongo_user and getattr(instance, 'email', None):
            mongo_user = MongoUser.objects(email=instance.email).first()

        if not mongo_user and getattr(instance, 'phone', None):
            mongo_user = MongoUser.objects(phone=instance.phone).first()

        if not mongo_user:
            mongo_user = MongoUser(
                username=instance.username,
                email=instance.email or None,
                phone=instance.phone or None,
                password=instance.password,
                django_user_id=str(instance.id)
            ).save()
        else:
            # backfill mapping and latest basic fields
            mongo_user.django_user_id = str(instance.id)
            mongo_user.email = instance.email or mongo_user.email
            mongo_user.phone = instance.phone or mongo_user.phone
            mongo_user.save()

        # 2. Create/fix the UserProfile referencing the MongoUser
        profile = UserProfile.objects(django_user_id=str(instance.id)).first()
        if not profile:
            profile = UserProfile.objects(user=mongo_user).first()

        if not profile:
            profile = UserProfile(user=mongo_user, django_user_id=str(instance.id))
        else:
            profile.user = mongo_user
            profile.django_user_id = str(instance.id)

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
