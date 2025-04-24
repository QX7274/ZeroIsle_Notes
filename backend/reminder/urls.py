"""提醒系统URL配置"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'reminders', views.ReminderViewSet, basename='reminder')

urlpatterns = [
    path('', include(router.urls)),
    path('upcoming/', views.get_upcoming_reminders, name='upcoming_reminders'),
    path('complete/<uuid:pk>/', views.mark_reminder_complete, name='mark_reminder_complete'),
    path('from-note/', views.create_reminder_from_note, name='create_reminder_from_note'),
]