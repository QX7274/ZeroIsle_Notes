#!/usr/bin/env python3
"""
简单的文档转换服务测试脚本
"""

import requests
import json

def test_health():
    """测试健康检查"""
    print("🔍 测试健康检查...")
    
    try:
        response = requests.get('http://192.168.234.232:8000/api/v1/document-converter/health/', timeout=5)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 服务状态: {data.get('status')}")
            return True
        else:
            print(f"❌ 健康检查失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 健康检查异常: {e}")
        return False

def test_status():
    """测试状态接口"""
    print("🔍 测试状态接口...")
    
    try:
        response = requests.get('http://192.168.234.232:8000/api/v1/document-converter/status/', timeout=5)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 服务状态: {data.get('status')}")
            return True
        else:
            print(f"❌ 状态检查失败: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 状态检查异常: {e}")
        return False

def main():
    """主函数"""
    print("=" * 50)
    print("🧪 简单文档转换服务测试")
    print("=" * 50)
    
    # 测试健康检查
    health_ok = test_health()
    print()
    
    # 测试状态接口
    status_ok = test_status()
    print()
    
    if health_ok and status_ok:
        print("🎉 基础测试通过！")
    else:
        print("❌ 基础测试失败！")
        print("请检查：")
        print("1. Django服务是否启动: python manage.py runserver 0.0.0.0:8000")
        print("2. URL配置是否正确")
        print("3. 网络连接是否正常")

if __name__ == "__main__":
    main()
