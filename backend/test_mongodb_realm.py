"""
测试MongoDB Realm连接
"""

import os
import sys
import django
import logging
import asyncio
from datetime import datetime
import uuid

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.development')
django.setup()


logger = logging.getLogger(__name__)

# 导入MongoDB Realm服务
from mongodb_realm_service import mongodb_realm_service

async def test_connection():
    """测试MongoDB Realm连接"""
    logger.info("测试MongoDB Realm连接...")
    status = mongodb_realm_service.get_connection_status()
    logger.info(f"连接状态: {status}")

    logger.info("\n测试异步连接...")
    try:
        connection_success = await mongodb_realm_service.init_async_client()
        if not connection_success:
            logger.error("异步连接失败，终止测试")
            return
        logger.info("异步连接成功!")

        # 测试插入数据
        test_user = {
            'id': str(uuid.uuid4()),
            'username': 'test_user',
            'email': 'test@example.com',
            'password': 'pbkdf2_sha256$260000$test_password',
            'is_active': True,
            'date_joined': datetime.now()
        }

        logger.info("\n测试插入用户数据...")
        user_id = await mongodb_realm_service.insert_document('users', test_user)
        logger.info(f"插入用户ID: {user_id}")

        logger.info("\n测试查询用户数据...")
        user = await mongodb_realm_service.find_document('users', {'username': 'test_user'})
        logger.info(f"查询结果: {user}")

        # 测试插入笔记数据
        test_note = {
            'id': str(uuid.uuid4()),
            'user': test_user['id'],
            'title': '测试笔记',
            'content': '这是一个测试笔记',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'realm_sync_status': 'pending'
        }

        logger.info("\n测试插入笔记数据...")
        note_id = await mongodb_realm_service.insert_document('notes', test_note)
        logger.info(f"插入笔记ID: {note_id}")

        logger.info("\n测试查询笔记数据...")
        note = await mongodb_realm_service.find_document('notes', {'title': '测试笔记'})
        logger.info(f"查询结果: {note}")

        # 测试更新笔记数据
        logger.info("\n测试更新笔记数据...")
        update_count = await mongodb_realm_service.update_document('notes', {'title': '测试笔记'}, {'content': '这是一个更新后的测试笔记', 'realm_sync_status': 'synced'})
        logger.info(f"更新笔记数量: {update_count}")

        logger.info("\n测试查询更新后的笔记数据...")
        updated_note = await mongodb_realm_service.find_document('notes', {'title': '测试笔记'})
        logger.info(f"查询结果: {updated_note}")

        # 测试删除笔记数据
        logger.info("\n测试删除笔记数据...")
        delete_count = await mongodb_realm_service.delete_document('notes', {'title': '测试笔记'})
        logger.info(f"删除笔记数量: {delete_count}")

        # 测试删除用户数据
        logger.info("\n测试删除用户数据...")
        delete_count = await mongodb_realm_service.delete_document('users', {'username': 'test_user'})
        logger.info(f"删除用户数量: {delete_count}")

        logger.info("\n测试完成!")

    except Exception as e:
        logger.error(f"测试失败: {str(e)}")

def test_sync_connection():
    """测试同步MongoDB Realm连接"""
    logger.info("测试同步MongoDB Realm连接...")
    status = mongodb_realm_service.get_connection_status()
    logger.info(f"连接状态: {status}")

    # 检查连接状态
    if status != "已连接":
        logger.error("同步连接失败，终止测试")
        return

    try:
        # 测试插入数据
        test_user = {
            'id': str(uuid.uuid4()),
            'username': 'test_user_sync',
            'email': 'test_sync@example.com',
            'password': 'pbkdf2_sha256$260000$test_password',
            'is_active': True,
            'date_joined': datetime.now()
        }

        logger.info("\n测试同步插入用户数据...")
        user_id = mongodb_realm_service.insert_document_sync('users', test_user)
        logger.info(f"插入用户ID: {user_id}")

        logger.info("\n测试同步查询用户数据...")
        user = mongodb_realm_service.find_document_sync('users', {'username': 'test_user_sync'})
        logger.info(f"查询结果: {user}")

        # 测试插入笔记数据
        test_note = {
            'id': str(uuid.uuid4()),
            'user': test_user['id'],
            'title': '测试笔记同步',
            'content': '这是一个测试笔记同步',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'realm_sync_status': 'pending'
        }

        logger.info("\n测试同步插入笔记数据...")
        note_id = mongodb_realm_service.insert_document_sync('notes', test_note)
        logger.info(f"插入笔记ID: {note_id}")

        logger.info("\n测试同步查询笔记数据...")
        note = mongodb_realm_service.find_document_sync('notes', {'title': '测试笔记同步'})
        logger.info(f"查询结果: {note}")

        # 测试更新笔记数据
        logger.info("\n测试同步更新笔记数据...")
        update_count = mongodb_realm_service.update_document_sync('notes', {'title': '测试笔记同步'}, {'content': '这是一个更新后的测试笔记同步', 'realm_sync_status': 'synced'})
        logger.info(f"更新笔记数量: {update_count}")

        logger.info("\n测试同步查询更新后的笔记数据...")
        updated_note = mongodb_realm_service.find_document_sync('notes', {'title': '测试笔记同步'})
        logger.info(f"查询结果: {updated_note}")

        # 测试删除笔记数据
        logger.info("\n测试同步删除笔记数据...")
        delete_count = mongodb_realm_service.delete_document_sync('notes', {'title': '测试笔记同步'})
        logger.info(f"删除笔记数量: {delete_count}")

        # 测试删除用户数据
        logger.info("\n测试同步删除用户数据...")
        delete_count = mongodb_realm_service.delete_document_sync('users', {'username': 'test_user_sync'})
        logger.info(f"删除用户数量: {delete_count}")

        logger.info("\n同步测试完成!")

    except Exception as e:
        logger.error(f"同步测试失败: {str(e)}")

if __name__ == "__main__":
    # 测试异步连接
    asyncio.run(test_connection())

    # 测试同步连接
    test_sync_connection()
