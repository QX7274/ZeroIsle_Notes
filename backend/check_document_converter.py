"""
文档转换服务健康检查脚本
用于诊断文档转换服务的可用性和配置
"""

import os
import sys
import socket
import requests
from urllib.parse import urlparse

def check_port_open(host, port, timeout=5):
    """检查端口是否开放"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except socket.error:
        return False

def check_service_health(base_url):
    """检查服务健康状态"""
    health_url = f"{base_url}/api/v1/document-converter/health/"
    
    try:
        print(f"\n正在检查服务健康状态: {health_url}")
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 服务健康检查通过")
            print(f"   状态: {data.get('status', 'unknown')}")
            print(f"   支持的格式: {', '.join(data.get('supported_formats', []))}")
            return True
        else:
            print(f"❌ 服务健康检查失败: HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务（连接被拒绝）")
        return False
    except requests.exceptions.Timeout:
        print("❌ 服务健康检查超时")
        return False
    except Exception as e:
        print(f"❌ 服务健康检查失败: {str(e)}")
        return False

def check_convert_endpoint(base_url):
    """检查转换端点是否可访问"""
    convert_url = f"{base_url}/api/v1/document-converter/convert/"
    
    try:
        print(f"\n正在检查转换端点: {convert_url}")
        # 发送一个空的POST请求，预期会返回400（缺少文件）
        response = requests.post(convert_url, timeout=10)
        
        if response.status_code in [400, 405]:
            print("✅ 转换端点可访问（返回预期的错误代码）")
            return True
        else:
            print(f"⚠️  转换端点返回意外状态码: HTTP {response.status_code}")
            return True  # 端点可访问，即使状态码不是预期的
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到转换端点")
        return False
    except requests.exceptions.Timeout:
        print("❌ 转换端点检查超时")
        return False
    except Exception as e:
        print(f"❌ 转换端点检查失败: {str(e)}")
        return False

def get_network_interfaces():
    """获取本机网络接口地址"""
    hostname = socket.gethostname()
    try:
        # 获取所有IP地址
        ip_addresses = socket.gethostbyname_ex(hostname)[2]
        # 过滤掉回环地址
        ip_addresses = [ip for ip in ip_addresses if not ip.startswith("127.")]
        return ip_addresses
    except:
        return []

def main():
    """主函数"""
    print("=" * 60)
    print("文档转换服务诊断工具")
    print("=" * 60)
    
    # 获取后端URL（从命令行参数或使用默认值）
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://192.168.152.232:8000"
        print(f"\n使用默认URL: {base_url}")
        print("如需指定其他URL，请使用: python check_document_converter.py <URL>")
    
    # 解析URL
    parsed = urlparse(base_url)
    host = parsed.hostname or 'localhost'
    port = parsed.port or 8000
    
    print(f"\n目标主机: {host}")
    print(f"目标端口: {port}")
    
    # 1. 检查端口是否开放
    print("\n" + "-" * 60)
    print("1. 检查端口连通性")
    print("-" * 60)
    
    if check_port_open(host, port):
        print(f"✅ 端口 {port} 已开放并可访问")
    else:
        print(f"❌ 端口 {port} 无法访问")
        print("\n可能的原因：")
        print("  1. Django服务器未启动")
        print("  2. 防火墙阻止了连接")
        print("  3. IP地址不正确")
        print("\n建议操作：")
        print("  - 启动Django服务器: python manage.py runserver 0.0.0.0:8000")
        print("  - 检查防火墙设置")
        print("  - 确认设备在同一网络中")
        return
    
    # 2. 检查服务健康状态
    print("\n" + "-" * 60)
    print("2. 检查服务健康状态")
    print("-" * 60)
    
    health_ok = check_service_health(base_url)
    
    # 3. 检查转换端点
    print("\n" + "-" * 60)
    print("3. 检查转换端点")
    print("-" * 60)
    
    convert_ok = check_convert_endpoint(base_url)
    
    # 4. 显示网络信息
    print("\n" + "-" * 60)
    print("4. 本机网络信息")
    print("-" * 60)
    
    ip_addresses = get_network_interfaces()
    if ip_addresses:
        print("\n本机IP地址：")
        for ip in ip_addresses:
            print(f"  - {ip}")
            print(f"    前端配置: http://{ip}:8000")
    else:
        print("\n无法获取本机IP地址")
    
    # 总结
    print("\n" + "=" * 60)
    print("诊断总结")
    print("=" * 60)
    
    all_ok = health_ok and convert_ok
    
    if all_ok:
        print("\n✅ 所有检查都通过！服务正常运行。")
        print(f"\n在前端配置中使用此URL: {base_url}")
        print(f"API端点: {base_url}/api/v1/document-converter/")
    else:
        print("\n❌ 部分检查失败，请查看上面的详细信息。")
        print("\n常见问题解决方案：")
        print("  1. 确保Django服务器正在运行")
        print("  2. 确保使用 0.0.0.0 而不是 127.0.0.1")
        print("  3. 检查防火墙设置")
        print("  4. 确认设备在同一网络中")
        print("  5. 尝试使用其他IP地址（见上方本机IP列表）")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    main()



