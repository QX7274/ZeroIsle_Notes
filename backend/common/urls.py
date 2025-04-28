"""
Common应用URL配置
"""

from django.urls import path
from .views.mongodb_test import MongoDBTestView

urlpatterns = [
    path('mongodb-test/', MongoDBTestView.as_view(), name='mongodb-test'),
]
