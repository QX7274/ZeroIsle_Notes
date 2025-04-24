from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import UserRegistrationView, UserLoginView, UserProfileView
from notes.views import (
    NoteViewSet, TagViewSet, NoteShareViewSet,
    NoteAttachmentViewSet, NoteVersionViewSet
)
from reminder.views import ReminderViewSet, ReminderNotificationViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet)
router.register(r'tags', TagViewSet)
router.register(r'note-shares', NoteShareViewSet)
router.register(r'note-attachments', NoteAttachmentViewSet)
router.register(r'note-versions', NoteVersionViewSet)
router.register(r'reminders', ReminderViewSet)
router.register(r'reminder-notifications', ReminderNotificationViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/register/', UserRegistrationView.as_view(), name='register'),
    path('api/auth/login/', UserLoginView.as_view(), name='login'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/profile/', UserProfileView.as_view(), name='profile'),
    path('api/community/', include('community.urls')),
]