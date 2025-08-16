#!/usr/bin/env python3
"""
文档转换服务设置脚本
用于检查和安装文档转换所需的依赖
"""

import sys
import os
import platform
import subprocess
import importlib.util

def check_python_version():
    """检查Python版本"""
    print("检查Python版本...")
    if sys.version_info < (3, 8):
        print("❌ 错误: 需要Python 3.8或更高版本")
        return False
    print(f"✅ Python版本: {sys.version}")
    return True

def check_windows_system():
    """检查是否为Windows系统"""
    print("检查操作系统...")
    if platform.system() != 'Windows':
        print("❌ 警告: 文档转换功能仅在Windows系统上可用")
        print("   如果您在其他系统上，请考虑使用LibreOffice或云服务替代方案")
        return False
    print(f"✅ 操作系统: {platform.system()} {platform.release()}")
    return True

def check_office_installation():
    """检查Microsoft Office安装"""
    print("检查Microsoft Office安装...")
    
    try:
        import comtypes.client
        
        # 尝试创建Word应用程序
        try:
            word_app = comtypes.client.CreateObject('Word.Application')
            word_app.Quit()
            print("✅ Microsoft Word 已安装并可用")
            word_available = True
        except Exception as e:
            print(f"❌ Microsoft Word 不可用: {e}")
            word_available = False
        
        # 尝试创建PowerPoint应用程序
        try:
            ppt_app = comtypes.client.CreateObject('PowerPoint.Application')
            ppt_app.Quit()
            print("✅ Microsoft PowerPoint 已安装并可用")
            ppt_available = True
        except Exception as e:
            print(f"❌ Microsoft PowerPoint 不可用: {e}")
            ppt_available = False
        
        return word_available or ppt_available
        
    except ImportError:
        print("❌ comtypes库未安装，无法检查Office")
        return False

def install_dependencies():
    """安装必要的依赖"""
    print("安装文档转换依赖...")
    
    dependencies = [
        'comtypes==1.2.0',
        'pywin32==306'
    ]
    
    for dep in dependencies:
        print(f"安装 {dep}...")
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', dep])
            print(f"✅ {dep} 安装成功")
        except subprocess.CalledProcessError as e:
            print(f"❌ {dep} 安装失败: {e}")
            return False
    
    return True

def check_dependencies():
    """检查依赖是否已安装"""
    print("检查Python依赖...")
    
    dependencies = {
        'comtypes': 'comtypes',
        'win32api': 'pywin32'
    }
    
    missing_deps = []
    
    for module, package in dependencies.items():
        try:
            importlib.import_module(module)
            print(f"✅ {package} 已安装")
        except ImportError:
            print(f"❌ {package} 未安装")
            missing_deps.append(package)
    
    return len(missing_deps) == 0, missing_deps

def test_conversion():
    """测试文档转换功能"""
    print("测试文档转换功能...")
    
    try:
        # 导入转换服务
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from document_converter.services import document_converter
        
        print("✅ 文档转换服务导入成功")
        
        # 测试临时文件清理
        document_converter.cleanup_temp_files()
        print("✅ 临时文件清理功能正常")
        
        return True
        
    except Exception as e:
        print(f"❌ 文档转换服务测试失败: {e}")
        return False

def main():
    """主函数"""
    print("=" * 50)
    print("零屿笔记 - 文档转换服务设置")
    print("=" * 50)
    
    # 检查Python版本
    if not check_python_version():
        sys.exit(1)
    
    # 检查Windows系统
    is_windows = check_windows_system()
    if not is_windows:
        print("\n⚠️  警告: 在非Windows系统上，文档转换功能将不可用")
        print("   您可以继续使用其他功能，或考虑使用替代方案")
        return
    
    # 检查依赖
    deps_ok, missing_deps = check_dependencies()
    
    if not deps_ok:
        print(f"\n缺少依赖: {', '.join(missing_deps)}")
        install = input("是否自动安装缺少的依赖? (y/n): ").lower().strip()
        
        if install == 'y':
            if not install_dependencies():
                print("❌ 依赖安装失败")
                sys.exit(1)
        else:
            print("请手动安装缺少的依赖:")
            for dep in missing_deps:
                print(f"  pip install {dep}")
            sys.exit(1)
    
    # 检查Office安装
    if not check_office_installation():
        print("\n❌ Microsoft Office 不可用")
        print("请确保已安装Microsoft Office (Word和/或PowerPoint)")
        print("如果已安装，请尝试以管理员权限运行此脚本")
        sys.exit(1)
    
    # 测试转换功能
    if not test_conversion():
        print("❌ 文档转换功能测试失败")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✅ 文档转换服务设置完成!")
    print("=" * 50)
    print("\n现在您可以:")
    print("1. 启动Django服务器")
    print("2. 在React Native应用中导入Word/PPT文档")
    print("3. 享受真实的文档转换功能")
    print("\n注意事项:")
    print("- 确保Office应用程序没有被其他进程占用")
    print("- 大文件转换可能需要较长时间")
    print("- 建议定期清理临时文件")

if __name__ == '__main__':
    main()
