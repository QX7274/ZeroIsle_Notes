"""
测试MongoDB Atlas连接
"""

import os
import sys
import urllib.parse
from dotenv import load_dotenv
import mongoengine
import pymongo
from pymongo.errors import ConnectionFailure

def test_mongoengine_connection():
    """测试使用mongoengine连接MongoDB Atlas"""
    print("测试使用mongoengine连接MongoDB Atlas...")

    try:
        # 加载环境变量
        load_dotenv()

        # 获取MongoDB连接参数
        mongo_uri = os.environ.get('MONGO_URI', '')
        if not mongo_uri:
            print("错误: 未设置MONGO_URI环境变量")
            return False

        # 使用已编码的密码
        mongo_uri = 'mongodb+srv://qianxin7274:zxcvbnm%40%40081325@cluster0.eqjxvnu.mongodb.net/'

        # 连接到MongoDB
        print(f"连接到: {mongo_uri}")
        conn = mongoengine.connect(
            host=mongo_uri,
            ssl=True,
            tlsAllowInvalidCertificates=True
        )

        # 测试连接
        conn.server_info()
        print("mongoengine连接成功!")

        # 列出所有数据库
        print("可用数据库:")
        for db in conn.list_database_names():
            print(f"  - {db}")

        return True
    except Exception as e:
        print(f"mongoengine连接失败: {str(e)}")
        return False
    finally:
        # 断开连接
        mongoengine.disconnect()

def test_pymongo_connection():
    """测试使用pymongo连接MongoDB Atlas"""
    print("\n测试使用pymongo连接MongoDB Atlas...")

    try:
        # 加载环境变量
        load_dotenv()

        # 获取MongoDB连接参数
        mongo_uri = os.environ.get('MONGO_URI', '')
        if not mongo_uri:
            print("错误: 未设置MONGO_URI环境变量")
            return False

        # 使用已编码的密码
        mongo_uri = 'mongodb+srv://qianxin7274:zxcvbnm%40%40081325@cluster0.eqjxvnu.mongodb.net/'

        # 连接到MongoDB
        print(f"连接到: {mongo_uri}")
        client = pymongo.MongoClient(
            mongo_uri,
            ssl=True,
            tlsAllowInvalidCertificates=True
        )

        # 测试连接
        client.admin.command('ping')
        print("pymongo连接成功!")

        # 列出所有数据库
        print("可用数据库:")
        for db in client.list_database_names():
            print(f"  - {db}")

        return True
    except ConnectionFailure as e:
        print(f"pymongo连接失败: {str(e)}")
        return False
    finally:
        # 断开连接
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    print("MongoDB Atlas连接测试")
    print("=" * 50)

    # 测试mongoengine连接
    mongoengine_success = test_mongoengine_connection()

    # 测试pymongo连接
    pymongo_success = test_pymongo_connection()

    # 输出总结
    print("\n测试结果:")
    print(f"mongoengine连接: {'成功' if mongoengine_success else '失败'}")
    print(f"pymongo连接: {'成功' if pymongo_success else '失败'}")

    # 设置退出代码
    if mongoengine_success and pymongo_success:
        print("\n所有测试通过!")
        sys.exit(0)
    else:
        print("\n测试失败!")
        sys.exit(1)
