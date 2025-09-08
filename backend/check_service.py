#!/usr/bin/env python3
"""
检查Django服务是否正常运行
"""

import requests
import sys
import time

def check_django_service():
    """检查Django服务"""
    print("🔍 检查Django服务...")
    
    urls_to_check = [
        'http://192.168.234.232:8000/',
        'http://192.168.234.232:8000/api/v1/document-converter/health/',
        'http://192.168.234.232:8000/api/v1/document-converter/status/',
    ]
    
    for url in urls_to_check:
        try:
            print(f"检查: {url}")
            response = requests.get(url, timeout=5)
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                print(f"  ✅ 正常")
                try:
                    data = response.json()
                    print(f"  响应: {data}")
                except:
                    print(f"  响应: {response.text[:100]}...")
            else:
                print(f"  ❌ 异常")
                print(f"  响应: {response.text[:200]}")
                
        except Exception as e:
            print(f"  ❌ 连接失败: {e}")
        
        print()

def main():
    """主函数"""
    print("=" * 60)
    print("🔧 Django文档转换服务检查工具")
    print("=" * 60)
    
    check_django_service()
    
    print("💡 如果服务不可用，请检查：")
    print("1. Django服务是否启动:")
    print("   cd backend")
    print("   python manage.py runserver 0.0.0.0:8000")
    print()
    print("2. 网络配置是否正确:")
    print("   确保IP地址 192.168.234.232 可以访问")
    print()
    print("3. 防火墙设置:")
    print("   确保端口8000没有被防火墙阻止")

if __name__ == "__main__":
    main()
