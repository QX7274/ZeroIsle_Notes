# 模板目录

本目录包含零屿笔记应用的HTML模板文件，主要用于邮件模板、PDF导出模板和其他需要HTML渲染的功能。

## 目录结构

- **emails/**: 邮件模板
  - **base.html**: 基础邮件模板，所有邮件模板的父模板
  - **welcome.html**: 欢迎邮件，新用户注册后发送
  - **password_reset.html**: 密码重置邮件，用户请求重置密码时发送
  - **password_changed.html**: 密码修改通知，用户修改密码后发送
  - **verification_code.html**: 验证码邮件，发送验证码
  - **account_locked.html**: 账号锁定通知，账号被锁定时发送
  - **new_device_login.html**: 新设备登录通知，检测到新设备登录时发送
  - **subscription_confirmation.html**: 订阅确认，用户订阅服务时发送
  - **subscription_expiry.html**: 订阅到期提醒，订阅即将到期时发送
  - **note_shared.html**: 笔记分享通知，笔记被分享时发送
  - **comment_notification.html**: 评论通知，笔记收到评论时发送
  - **weekly_digest.html**: 周报摘要，发送用户活动周报
- **exports/**: 导出模板
  - **note_export.html**: 笔记导出模板，用于导出笔记为HTML或PDF
  - **knowledge_graph_export.html**: 知识图谱导出模板，用于导出知识图谱
  - **mind_map_export.html**: 思维导图导出模板，用于导出思维导图
  - **report_export.html**: 报告导出模板，用于导出分析报告
- **admin/**: 管理后台模板
  - **dashboard.html**: 管理后台仪表盘模板
  - **user_management.html**: 用户管理模板
  - **content_management.html**: 内容管理模板
  - **system_settings.html**: 系统设置模板
- **errors/**: 错误页面模板
  - **404.html**: 404错误页面，资源不存在
  - **500.html**: 500错误页面，服务器内部错误
  - **403.html**: 403错误页面，权限不足
  - **maintenance.html**: 维护页面，系统维护时显示
- **index.html**: 主页模板，API文档入口页面

## 邮件模板

### 基础邮件模板 (base.html)

基础邮件模板定义了所有邮件的通用结构和样式，包括：

- 邮件头部（标题、Logo）
- 邮件正文容器
- 邮件底部（联系信息、版权声明、退订链接）

其他邮件模板通过继承基础模板并覆盖特定区块来定制内容。

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}零屿笔记{% endblock %}</title>
    <style>
        /* 邮件样式 */
    </style>
</head>
<body>
    <div class="header">
        <img src="https://example.com/logo.png" alt="零屿笔记" class="logo">
        <h1>{% block header %}零屿笔记{% endblock %}</h1>
    </div>
    
    <div class="content">
        {% block content %}{% endblock %}
    </div>
    
    <div class="footer">
        <p>零屿笔记团队</p>
        <p>© {% now "Y" %} 零屿笔记. 保留所有权利.</p>
        <p>如果您不想再收到此类邮件，请<a href="{{ unsubscribe_url }}">点击这里退订</a>.</p>
    </div>
</body>
</html>
```

### 欢迎邮件 (welcome.html)

欢迎邮件在用户注册后发送，包含以下内容：

- 欢迎信息
- 账号激活链接（如果需要）
- 快速入门指南
- 常见问题链接
- 联系支持团队的方式

```html
{% extends "emails/base.html" %}

{% block title %}欢迎加入零屿笔记{% endblock %}

{% block header %}欢迎加入{% endblock %}

{% block content %}
<p>您好 {{ user.username }},</p>

<p>感谢您注册零屿笔记！我们很高兴您加入我们的社区。</p>

{% if activation_required %}
<p>请点击下面的按钮激活您的账号：</p>
<a href="{{ activation_url }}" class="button">激活账号</a>
{% endif %}

<h2>快速入门</h2>
<ul>
    <li>创建您的第一个笔记</li>
    <li>探索知识图谱功能</li>
    <li>尝试AI助手</li>
    <li>设置提醒</li>
</ul>

<p>如果您有任何问题，请查看我们的<a href="{{ faq_url }}">常见问题</a>或直接<a href="{{ support_url }}">联系支持团队</a>。</p>

<p>祝您使用愉快！</p>
{% endblock %}
```

## 导出模板

### 笔记导出模板 (note_export.html)

笔记导出模板用于将笔记导出为HTML或PDF格式，包含以下内容：

- 笔记标题
- 笔记内容（支持富文本、Markdown等格式）
- 笔记元数据（创建时间、更新时间、标签等）
- 附件列表
- 导出信息（导出时间、导出格式等）

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ note.title }} - 零屿笔记</title>
    <style>
        /* 导出样式 */
    </style>
</head>
<body>
    <div class="note-container">
        <h1 class="note-title">{{ note.title }}</h1>
        
        <div class="note-metadata">
            <p>创建时间: {{ note.created_at|date:"Y-m-d H:i" }}</p>
            <p>更新时间: {{ note.updated_at|date:"Y-m-d H:i" }}</p>
            {% if note.tags %}
            <p>标签: 
                {% for tag in note.tags %}
                <span class="tag">{{ tag.name }}</span>
                {% endfor %}
            </p>
            {% endif %}
        </div>
        
        <div class="note-content">
            {{ note.content|safe }}
        </div>
        
        {% if note.attachments %}
        <div class="attachments">
            <h2>附件</h2>
            <ul>
                {% for attachment in note.attachments %}
                <li>{{ attachment.name }} ({{ attachment.size|filesizeformat }})</li>
                {% endfor %}
            </ul>
        </div>
        {% endif %}
        
        <div class="export-info">
            <p>导出时间: {{ export_time|date:"Y-m-d H:i" }}</p>
            <p>导出格式: {{ export_format }}</p>
            <p>由零屿笔记导出</p>
        </div>
    </div>
</body>
</html>
```

## 使用方法

### 在Django视图中使用模板

```python
from django.shortcuts import render
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.core.mail import send_mail

def export_note_as_html(request, note_id):
    """导出笔记为HTML"""
    note = Note.objects.get(id=note_id)
    
    # 渲染模板
    html_content = render_to_string('exports/note_export.html', {
        'note': note,
        'export_time': timezone.now(),
        'export_format': 'HTML'
    })
    
    # 返回HTML响应
    return HttpResponse(html_content, content_type='text/html')

def send_welcome_email(user):
    """发送欢迎邮件"""
    subject = '欢迎加入零屿笔记'
    
    # 渲染邮件内容
    html_content = render_to_string('emails/welcome.html', {
        'user': user,
        'activation_required': False,
        'faq_url': 'https://example.com/faq',
        'support_url': 'https://example.com/support'
    })
    
    # 发送邮件
    send_mail(
        subject=subject,
        message='',  # 纯文本内容（可选）
        from_email='noreply@example.com',
        recipient_list=[user.email],
        html_message=html_content
    )
```

### 在Celery任务中使用模板

```python
from celery import shared_task
from django.template.loader import render_to_string
from django.core.mail import send_mail

@shared_task
def send_password_reset_email(user_id, reset_url):
    """发送密码重置邮件（异步任务）"""
    user = User.objects.get(id=user_id)
    subject = '零屿笔记 - 密码重置'
    
    # 渲染邮件内容
    html_content = render_to_string('emails/password_reset.html', {
        'user': user,
        'reset_url': reset_url,
        'expiry_hours': 24
    })
    
    # 发送邮件
    send_mail(
        subject=subject,
        message='',
        from_email='noreply@example.com',
        recipient_list=[user.email],
        html_message=html_content
    )
```

## 注意事项

- **响应式设计**: 确保邮件模板在不同设备上显示正常
- **内联样式**: 邮件模板应使用内联样式，避免使用外部CSS
- **图片处理**: 邮件中的图片应使用绝对URL，并考虑添加alt文本
- **兼容性**: 考虑不同邮件客户端的兼容性问题
- **个性化**: 适当使用用户信息进行个性化，提高用户体验
- **本地化**: 支持多语言模板，根据用户偏好选择语言
- **可访问性**: 确保模板符合可访问性标准，方便所有用户使用
