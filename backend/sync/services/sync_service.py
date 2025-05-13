"""
数据同步服务
处理前端数据与MongoDB Atlas云数据库的同步
"""

import logging
import json
from datetime import datetime
from django.utils import timezone
from django.conf import settings
from bson import ObjectId
from pymongo.errors import PyMongoError

# 导入MongoDB服务
from mongodb_service import mongodb_service

# 设置日志
logger = logging.getLogger(__name__)

class SyncService:
    """
    数据同步服务类
    处理前端数据与MongoDB Atlas的同步
    """

    @staticmethod
    def sync_notes(user_id, notes_data, client_timestamp=None):
        """
        同步笔记数据

        Args:
            user_id: 用户ID
            notes_data: 笔记数据列表
            client_timestamp: 客户端时间戳

        Returns:
            dict: 同步结果
        """
        try:
            # 获取笔记集合
            notes_collection = mongodb_service.db.notes

            # 处理每个笔记
            results = {
                'created': 0,
                'updated': 0,
                'deleted': 0,
                'failed': 0,
                'details': []
            }

            for note in notes_data:
                try:
                    # 确保笔记有ID
                    note_id = note.get('_id') or note.get('id')
                    if not note_id:
                        # 生成新ID
                        note_id = str(ObjectId())
                        note['_id'] = note_id

                    # 确保笔记有用户ID
                    note['user_id'] = user_id

                    # 检查操作类型
                    operation = note.get('_operation', 'update')

                    if operation == 'delete':
                        # 删除笔记
                        result = notes_collection.delete_one({'_id': note_id, 'user_id': user_id})
                        if result.deleted_count > 0:
                            results['deleted'] += 1
                            results['details'].append({
                                'id': note_id,
                                'status': 'deleted'
                            })
                        else:
                            results['failed'] += 1
                            results['details'].append({
                                'id': note_id,
                                'status': 'failed',
                                'error': '笔记不存在或无权删除'
                            })
                    else:
                        # 添加同步时间戳
                        note['synced_at'] = datetime.now().isoformat()

                        # 检查笔记是否存在
                        existing_note = notes_collection.find_one({'_id': note_id})

                        if existing_note:
                            # 更新笔记
                            # 移除操作标记
                            if '_operation' in note:
                                del note['_operation']

                            result = notes_collection.update_one(
                                {'_id': note_id, 'user_id': user_id},
                                {'$set': note}
                            )

                            if result.modified_count > 0:
                                results['updated'] += 1
                                results['details'].append({
                                    'id': note_id,
                                    'status': 'updated'
                                })
                            else:
                                results['failed'] += 1
                                results['details'].append({
                                    'id': note_id,
                                    'status': 'failed',
                                    'error': '笔记更新失败'
                                })
                        else:
                            # 创建笔记
                            # 移除操作标记
                            if '_operation' in note:
                                del note['_operation']

                            result = notes_collection.insert_one(note)

                            if result.inserted_id:
                                results['created'] += 1
                                results['details'].append({
                                    'id': note_id,
                                    'status': 'created'
                                })
                            else:
                                results['failed'] += 1
                                results['details'].append({
                                    'id': note_id,
                                    'status': 'failed',
                                    'error': '笔记创建失败'
                                })
                except Exception as e:
                    logger.error(f"处理笔记同步时出错: {str(e)}")
                    results['failed'] += 1
                    results['details'].append({
                        'id': note.get('_id', 'unknown'),
                        'status': 'failed',
                        'error': str(e)
                    })

            return {
                'success': True,
                'results': results,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"笔记同步失败: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    @staticmethod
    def get_latest_notes(user_id, since=None):
        """
        获取最新笔记数据

        Args:
            user_id: 用户ID
            since: 上次同步时间

        Returns:
            list: 笔记列表
        """
        try:
            # 获取笔记集合
            notes_collection = mongodb_service.db.notes

            # 构建查询条件
            query = {'user_id': user_id}

            # 如果提供了时间戳，只获取该时间之后更新的笔记
            if since:
                try:
                    since_date = datetime.fromisoformat(since)
                    query['updated_at'] = {'$gt': since_date.isoformat()}
                except (ValueError, TypeError):
                    logger.warning(f"无效的时间戳格式: {since}")

            # 查询笔记
            notes = list(notes_collection.find(query))

            # 转换ObjectId为字符串
            for note in notes:
                if '_id' in note and isinstance(note['_id'], ObjectId):
                    note['_id'] = str(note['_id'])

            return notes
        except Exception as e:
            logger.error(f"获取最新笔记失败: {str(e)}")
            return []

    @staticmethod
    def sync_reminders(user_id, reminders_data, client_timestamp=None):
        """
        同步提醒数据

        Args:
            user_id: 用户ID
            reminders_data: 提醒数据列表
            client_timestamp: 客户端时间戳

        Returns:
            dict: 同步结果
        """
        try:
            # 获取提醒集合
            reminders_collection = mongodb_service.db.reminders

            # 处理每个提醒
            results = {
                'created': 0,
                'updated': 0,
                'deleted': 0,
                'failed': 0,
                'details': []
            }

            for reminder in reminders_data:
                try:
                    # 确保提醒有ID
                    reminder_id = reminder.get('_id') or reminder.get('id')
                    if not reminder_id:
                        # 生成新ID
                        reminder_id = str(ObjectId())
                        reminder['_id'] = reminder_id

                    # 确保提醒有用户ID
                    reminder['user_id'] = user_id

                    # 检查操作类型
                    operation = reminder.get('_operation', 'update')

                    if operation == 'delete':
                        # 删除提醒
                        result = reminders_collection.delete_one({'_id': reminder_id, 'user_id': user_id})
                        if result.deleted_count > 0:
                            results['deleted'] += 1
                            results['details'].append({
                                'id': reminder_id,
                                'status': 'deleted'
                            })
                        else:
                            results['failed'] += 1
                            results['details'].append({
                                'id': reminder_id,
                                'status': 'failed',
                                'error': '提醒不存在或无权删除'
                            })
                    else:
                        # 添加同步时间戳
                        reminder['synced_at'] = datetime.now().isoformat()

                        # 检查提醒是否存在
                        existing_reminder = reminders_collection.find_one({'_id': reminder_id})

                        if existing_reminder:
                            # 更新提醒
                            # 移除操作标记
                            if '_operation' in reminder:
                                del reminder['_operation']

                            result = reminders_collection.update_one(
                                {'_id': reminder_id, 'user_id': user_id},
                                {'$set': reminder}
                            )

                            if result.modified_count > 0:
                                results['updated'] += 1
                                results['details'].append({
                                    'id': reminder_id,
                                    'status': 'updated'
                                })
                            else:
                                results['failed'] += 1
                                results['details'].append({
                                    'id': reminder_id,
                                    'status': 'failed',
                                    'error': '提醒更新失败'
                                })
                        else:
                            # 创建提醒
                            # 移除操作标记
                            if '_operation' in reminder:
                                del reminder['_operation']

                            result = reminders_collection.insert_one(reminder)

                            if result.inserted_id:
                                results['created'] += 1
                                results['details'].append({
                                    'id': reminder_id,
                                    'status': 'created'
                                })
                            else:
                                results['failed'] += 1
                                results['details'].append({
                                    'id': reminder_id,
                                    'status': 'failed',
                                    'error': '提醒创建失败'
                                })
                except Exception as e:
                    logger.error(f"处理提醒同步时出错: {str(e)}")
                    results['failed'] += 1
                    results['details'].append({
                        'id': reminder.get('_id', 'unknown'),
                        'status': 'failed',
                        'error': str(e)
                    })

            return {
                'success': True,
                'results': results,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"提醒同步失败: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    @staticmethod
    def get_latest_reminders(user_id, since=None):
        """
        获取最新提醒数据

        Args:
            user_id: 用户ID
            since: 上次同步时间

        Returns:
            list: 提醒列表
        """
        try:
            # 获取提醒集合
            reminders_collection = mongodb_service.db.reminders

            # 构建查询条件
            query = {'user_id': user_id}

            # 如果提供了时间戳，只获取该时间之后更新的提醒
            if since:
                try:
                    since_date = datetime.fromisoformat(since)
                    query['updated_at'] = {'$gt': since_date.isoformat()}
                except (ValueError, TypeError):
                    logger.warning(f"无效的时间戳格式: {since}")

            # 查询提醒
            reminders = list(reminders_collection.find(query))

            # 转换ObjectId为字符串
            for reminder in reminders:
                if '_id' in reminder and isinstance(reminder['_id'], ObjectId):
                    reminder['_id'] = str(reminder['_id'])

            return reminders
        except Exception as e:
            logger.error(f"获取最新提醒失败: {str(e)}")
            return []

    @staticmethod
    def sync_user_settings(user_id, settings_data):
        """
        同步用户设置

        Args:
            user_id: 用户ID
            settings_data: 设置数据

        Returns:
            dict: 同步结果
        """
        try:
            # 获取设置集合
            settings_collection = mongodb_service.db.user_settings

            # 添加用户ID和同步时间戳
            settings_data['user_id'] = user_id
            settings_data['synced_at'] = datetime.now().isoformat()

            # 检查设置是否存在
            existing_settings = settings_collection.find_one({'user_id': user_id})

            if existing_settings:
                # 更新设置
                result = settings_collection.update_one(
                    {'user_id': user_id},
                    {'$set': settings_data}
                )

                if result.modified_count > 0:
                    return {
                        'success': True,
                        'status': 'updated',
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'status': 'failed',
                        'error': '设置更新失败',
                        'timestamp': datetime.now().isoformat()
                    }
            else:
                # 创建设置
                result = settings_collection.insert_one(settings_data)

                if result.inserted_id:
                    return {
                        'success': True,
                        'status': 'created',
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'status': 'failed',
                        'error': '设置创建失败',
                        'timestamp': datetime.now().isoformat()
                    }
        except Exception as e:
            logger.error(f"用户设置同步失败: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    @staticmethod
    def get_user_settings(user_id):
        """
        获取用户设置

        Args:
            user_id: 用户ID

        Returns:
            dict: 用户设置
        """
        try:
            # 获取设置集合
            settings_collection = mongodb_service.db.user_settings

            # 查询设置
            settings = settings_collection.find_one({'user_id': user_id})

            # 转换ObjectId为字符串
            if settings and '_id' in settings and isinstance(settings['_id'], ObjectId):
                settings['_id'] = str(settings['_id'])

            return settings or {}
        except Exception as e:
            logger.error(f"获取用户设置失败: {str(e)}")
            return {}

    @staticmethod
    def sync_all_data(user_id, data):
        """
        同步所有数据

        Args:
            user_id: 用户ID
            data: 所有数据

        Returns:
            dict: 同步结果
        """
        results = {
            'notes': None,
            'reminders': None,
            'settings': None,
            'user': None,
            'timestamp': datetime.now().isoformat()
        }

        # 同步笔记
        if 'notes' in data and isinstance(data['notes'], list):
            results['notes'] = SyncService.sync_notes(user_id, data['notes'])

        # 同步提醒
        if 'reminders' in data and isinstance(data['reminders'], list):
            results['reminders'] = SyncService.sync_reminders(user_id, data['reminders'])

        # 同步设置
        if 'settings' in data and isinstance(data['settings'], dict):
            results['settings'] = SyncService.sync_user_settings(user_id, data['settings'])

        # 同步用户信息
        if 'user' in data and isinstance(data['user'], dict):
            results['user'] = SyncService.sync_user_data(user_id, data['user'])

        return {
            'success': True,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }

    @staticmethod
    def sync_key_data(user_id, data):
        """
        只同步关键数据（用户信息和设置）

        Args:
            user_id: 用户ID
            data: 关键数据

        Returns:
            dict: 同步结果
        """
        results = {
            'settings': None,
            'user': None,
            'timestamp': datetime.now().isoformat()
        }

        # 同步设置
        if 'settings' in data and isinstance(data['settings'], dict):
            results['settings'] = SyncService.sync_user_settings(user_id, data['settings'])

        # 同步用户信息
        if 'user' in data and isinstance(data['user'], dict):
            results['user'] = SyncService.sync_user_data(user_id, data['user'])

        return {
            'success': True,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }

    @staticmethod
    def sync_user_data(user_id, user_data):
        """
        同步用户数据

        Args:
            user_id: 用户ID
            user_data: 用户数据

        Returns:
            dict: 同步结果
        """
        try:
            # 获取用户集合
            users_collection = mongodb_service.db.users

            # 添加用户ID和同步时间戳
            user_data['_id'] = user_id
            user_data['synced_at'] = datetime.now().isoformat()

            # 检查用户是否存在
            existing_user = users_collection.find_one({'_id': user_id})

            if existing_user:
                # 更新用户
                result = users_collection.update_one(
                    {'_id': user_id},
                    {'$set': user_data}
                )

                if result.modified_count > 0:
                    return {
                        'success': True,
                        'status': 'updated',
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'status': 'failed',
                        'error': '用户更新失败',
                        'timestamp': datetime.now().isoformat()
                    }
            else:
                # 创建用户
                result = users_collection.insert_one(user_data)

                if result.inserted_id:
                    return {
                        'success': True,
                        'status': 'created',
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'status': 'failed',
                        'error': '用户创建失败',
                        'timestamp': datetime.now().isoformat()
                    }
        except Exception as e:
            logger.error(f"用户数据同步失败: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
