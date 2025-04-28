from django.contrib.auth import login, get_user_model
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth.forms import UserCreationForm as UserRegistrationForm
from mongodb_service import mongodb_service

User = get_user_model()


def register_user(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()

            # 写入MongoDB
            mongo_data = {
                'django_user_id': user.id,
                'username': user.username,
                'email': user.email,
                'date_joined': user.date_joined.isoformat()
            }
            insert_result = mongodb_service.insert_user_sync(mongo_data)

            if insert_result:
                login(request, user)
                return redirect('/')
            return JsonResponse({'error': '数据库写入失败'}, status=500)
        return JsonResponse({'errors': form.errors}, status=400)
    return render(request, 'registration/register.html')

def login_user(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        # 查询MongoDB用户
        mongo_user = mongodb_service.get_user_sync(username)
        if not mongo_user:
            return JsonResponse({'error': '用户不存在'}, status=401)

        # 验证Django用户密码
        try:
            user = User.objects.get(id=mongo_user['django_user_id'])
            if user.check_password(password):
                login(request, user)
                return redirect('/')
            return JsonResponse({'error': '密码错误'}, status=401)
        except User.DoesNotExist:
            return JsonResponse({'error': '用户数据不一致'}, status=500)
    return render(request, 'registration/login.html')