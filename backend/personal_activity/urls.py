"""
Personal Activity Tracking URLs
个人活动记录URL配置
"""

from django.urls import path, include
from . import views

app_name = 'personal_activity'

urlpatterns = [
    # 活动管理
    path('activities/', views.activity_list_view, name='activity_list'),
    path('activities/<str:activity_id>/', views.activity_detail_view, name='activity_detail'),
    path('activities/<str:activity_id>/status/', views.activity_status_view, name='activity_status'),
    path('activities/<str:activity_id>/progress/', views.activity_progress_view, name='activity_progress'),
    
    # 仪表板
    path('dashboard/', views.dashboard_view, name='dashboard'),
    
    # 搜索
    path('search/', views.search_activities_view, name='search_activities'),
    
    # 批量操作
    path('batch/', views.batch_operation_view, name='batch_operation'),
    
    # 分类管理
    path('categories/', views.category_list_view, name='category_list'),
    path('categories/<str:category_id>/', views.category_detail_view, name='category_detail'),
    path('categories/tree/', views.category_tree_view, name='category_tree'),
    
    # 目标管理
    path('goals/', views.goal_list_view, name='goal_list'),
    path('goals/<str:goal_id>/', views.goal_detail_view, name='goal_detail'),
    
    # 分析报告
    path('analytics/reports/', views.analytics_reports_view, name='analytics_reports'),
    path('analytics/insights/', views.analytics_insights_view, name='analytics_insights'),
    path('analytics/trends/', views.analytics_trends_view, name='analytics_trends'),
    
    # 数据导出
    path('export/', views.export_data_view, name='export_data'),
    path('import/', views.import_data_view, name='import_data'),

    # 图片上传管理
    path('upload-image/', views.upload_image_view, name='upload_image'),
    path('delete-image/<str:filename>/', views.delete_image_view, name='delete_image'),
]
