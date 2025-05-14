"""
启动Django服务器脚本
确保服务器监听所有网络接口
"""

import os
import sys
import subprocess

def start_server():
    """启动Django服务器"""
    print("启动Django服务器...")
    
    # 设置环境变量
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
    
    # 构建命令
    command = [
        sys.executable,  # Python解释器路径
        'manage.py',     # Django管理脚本
        'runserver',     # 运行服务器命令
        '0.0.0.0:8000',  # 监听所有网络接口的8000端口
        '--noreload'     # 禁用自动重载
    ]
    
    # 启动服务器
    try:
        subprocess.run(command, cwd='backend')
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except Exception as e:
        print(f"启动服务器时出错: {e}")

if __name__ == "__main__":
    start_server()
