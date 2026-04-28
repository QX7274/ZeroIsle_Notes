"""
数据同步服务（优化版）
处理前端数据与MongoDB Atlas云数据库的同步
- 支持冲突解决
- 支持版本控制
- 支持批量操作
- 统一时间戳管理
"""

import logging
import json
from datetime import datetime
from django.utils import timezone
from django.conf import settings
from bson import ObjectId
from pymongo.errors import PyMongoError
from pymongo import UpdateOne, InsertOne, DeleteOne

# 导入MongoDB服务 - 修复导入路径
from .mongodb_service import mongodb_service

# 设置日志
logger = logging.getLogger(__name__)

class SyncService:
    """
    数据同步服务类（优化版）
    处理前端数据与MongoDB Atlas的同步
    - 支持冲突解决
    - 支持版本控制
    - 支持批量操作
    """

    # 冲突解决策略
    CONFLICT_STRATEGY_SERVER = 'server'  # 服务器优先
    CONFLICT_STRATEGY_CLIENT = 'client'  # 客户端优先
    CONFLICT_STRATEGY_LATEST = 'latest'  # 最新优先（默认）

    @staticmethod
    def _normalize_id(id_value):
        """
        规范化ID为ObjectId

        Args:
            id_value: ID值（可能是字符串或ObjectId）

        Returns:
            ObjectId: 规范化的ObjectId
        """
        if isinstance(id_value, ObjectId):
            return id_value
        try:
            return ObjectId(id_value)
        except Exception:
            # 如果无法转换，生成新的ObjectId
            return ObjectId()

    @staticmethod
    def _get_server_timestamp():
        """
        获取服务器时间戳（timezone-aware）

        Returns:
            datetime: 服务器时间戳
        """
        return timezone.now()

    @staticmethod
    def sync_notes(user_id, notes_data, client_timestamp=None, conflict_strategy='latest'):
        """
        同步笔记数据 (P0-SYNC1 Refactored)
        """
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()
            notes_collection = mongodb_service.db.notes

            results = {'created': 0, 'updated': 0, 'unchanged': 0, 'deleted': 0, 'conflicts': 0, 'failed': 0, 'details': []}
            bulk_operations = []
            server_timestamp = SyncService._get_server_timestamp()

            # 1. 批量获取服务器端笔记状态
            note_ids_to_check = [SyncService._normalize_id(n.get('_id') or n.get('id')) for n in notes_data if (n.get('_id') or n.get('id'))]
            server_notes = {str(n['_id']): n for n in notes_collection.find({'_id': {'$in': note_ids_to_check}, 'user_id': user_id})}

            for note in notes_data:
                try:
                    note_id_str = note.get('_id') or note.get('id')
                    note_id = SyncService._normalize_id(note_id_str) if note_id_str else ObjectId()
                    note_id_str = str(note_id)
                    note['user_id'] = user_id
                    operation = note.get('_operation', 'update')

                    if operation == 'delete':
                        bulk_operations.append(DeleteOne({'_id': note_id, 'user_id': user_id}))
                        results['details'].append({'id': note_id_str, 'status': 'deleted'})
                        continue

                    # 移除元数据
                    client_updated_at_str = note.pop('client_updated_at', None)
                    note.pop('_operation', None); note.pop('updated_at', None); note.pop('created_at', None)

                    server_note = server_notes.get(note_id_str)
                    decision = 'proceed'

                    if server_note:
                        # 冲突检测
                        server_updated_at = server_note.get('updated_at')
                        client_updated_at = datetime.fromisoformat(client_updated_at_str.replace('Z', '+00:00')) if client_updated_at_str else None

                        if server_updated_at and client_updated_at and abs((server_updated_at - client_updated_at).total_seconds()) > 1:
                            results['conflicts'] += 1
                            if conflict_strategy == SyncService.CONFLICT_STRATEGY_SERVER:
                                decision = 'ignore_client'
                            elif conflict_strategy == SyncService.CONFLICT_STRATEGY_LATEST and server_updated_at > client_updated_at:
                                decision = 'ignore_client_latest'

                    if decision.startswith('ignore'):
                        results['unchanged'] += 1
                        results['details'].append({'id': note_id_str, 'status': 'conflict_ignored', 'decision': decision})
                        continue

                    # 准备写入
                    update_data = {
                        '$set': note,
                        '$currentDate': {'updated_at': True},
                        '$setOnInsert': {'created_at': server_timestamp}
                    }
                    bulk_operations.append(UpdateOne({'_id': note_id, 'user_id': user_id}, update_data, upsert=True))
                    results['details'].append({'id': note_id_str, 'status': 'processed', 'decision': 'upsert'})

                except Exception as e:
                    logger.error(f"处理笔记同步时出错: {str(e)}")
                    results['failed'] += 1
                    results['details'].append({'id': note.get('_id', 'unknown'), 'status': 'failed', 'error': str(e)})

            if bulk_operations:
                try:
                    bulk_result = notes_collection.bulk_write(bulk_operations, ordered=False)
                    results['created'] = bulk_result.upserted_count
                    results['updated'] = bulk_result.modified_count
                    results['deleted'] = bulk_result.deleted_count
                    results['unchanged'] += bulk_result.matched_count - bulk_result.modified_count
                except Exception as e:
                    logger.error(f"批量操作失败: {str(e)}")
                    results['failed'] += len(bulk_operations)

            return {'success': True, 'data': results, 'errors': [], 'timestamp': server_timestamp.isoformat()}
        except Exception as e:
            logger.error(f"笔记同步失败: {str(e)}")
            return {'success': False, 'data': None, 'errors': [{'code': 'SYNC_NOTES_FAILED', 'message': str(e)}], 'timestamp': SyncService._get_server_timestamp().isoformat()}

    @staticmethod
    def pull_notes(user_id, cursor=None, limit=100):
        """
        使用游标拉取笔记数据，以实现稳定可靠的分页。

        Args:
            user_id (str): 用户ID
            cursor (str, optional): 上次同步的游标，格式为 'timestamp_id'。Defaults to None.
            limit (int, optional): 每次拉取的数量。Defaults to 100.

        Returns:
            dict: 包含 'items' 和 'next_cursor' 的字典
        """
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            notes_collection = mongodb_service.db.notes
            query = {'user_id': user_id}
            sort_order = [('updated_at', 1), ('_id', 1)]  # 升序排序

            if cursor:
                try:
                    last_updated_at_iso, last_id_str = cursor.split('_')
                    last_updated_at = datetime.fromisoformat(last_updated_at_iso.replace('Z', '+00:00'))
                    last_id = ObjectId(last_id_str)
                    query['$or'] = [
                        {'updated_at': {'$gt': last_updated_at}},
                        {
                            'updated_at': last_updated_at,
                            '_id': {'$gt': last_id}
                        }
                    ]
                except (ValueError, TypeError) as e:
                    logger.warning(f"无效的游标格式: {cursor}, 错误: {e}. 将全量拉取。")

            notes = list(notes_collection.find(query).sort(sort_order).limit(limit))

            next_cursor = None
            if notes and len(notes) == limit:
                last_note = notes[-1]
                next_cursor = f"{last_note['updated_at'].isoformat()}_{str(last_note['_id'])}"

            # 转换ObjectId和datetime为字符串以进行序列化
            for note in notes:
                if '_id' in note and isinstance(note['_id'], ObjectId):
                    note['_id'] = str(note['_id'])
                for field in ['created_at', 'updated_at']:
                    if field in note and isinstance(note[field], datetime):
                        note[field] = note[field].isoformat()

            return {
                'success': True,
                'data': {
                    'items': notes,
                    'next_cursor': next_cursor
                },
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }
        except Exception as e:
            logger.error(f"拉取笔记失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'PULL_NOTES_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }


    @staticmethod
    def sync_reminders(user_id, reminders_data, client_timestamp=None, conflict_strategy='latest'):
        """
        同步提醒数据 (重构版：支持批量、冲突解决和时区)

        Args:
            user_id: 用户ID
            reminders_data: 提醒数据列表
            client_timestamp: 客户端时间戳
            conflict_strategy: 冲突解决策略

        Returns:
            dict: 同步结果
        """
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            reminders_collection = mongodb_service.db.reminders

            results = {
                'created': 0, 'updated': 0, 'unchanged': 0, 'deleted': 0,
                'conflicts': 0, 'failed': 0, 'details': []
            }

            bulk_operations = []
            server_timestamp = SyncService._get_server_timestamp()

            for reminder in reminders_data:
                try:
                    reminder_id_str = reminder.get('_id') or reminder.get('id')
                    reminder_id = ObjectId(reminder_id_str) if reminder_id_str else ObjectId()
                    reminder_id_str = str(reminder_id)

                    reminder['user_id'] = user_id
                    operation = reminder.get('_operation', 'update')

                    if operation == 'delete':
                        bulk_operations.append(DeleteOne({'_id': reminder_id, 'user_id': user_id}))
                        results['details'].append({'id': reminder_id_str, 'status': 'deleted'})
                        continue

                    instance_op = reminder.get('_instance_operation')
                    if instance_op:
                        # This logic remains correct as it handles exceptions, not primary data.
                        instance_collection = mongodb_service.db.reminder_instances
                        instance_doc = {
                            'original_reminder_id': reminder_id,
                            'user_id': user_id,
                            'original_time': datetime.fromisoformat(instance_op['original_time'].replace('Z', '+00:00')),
                            'status': instance_op['status'],
                            'created_at': server_timestamp,
                        }
                        if instance_op.get('new_time'):
                            instance_doc['new_time'] = datetime.fromisoformat(instance_op['new_time'].replace('Z', '+00:00'))

                        instance_collection.insert_one(instance_doc)
                        results['details'].append({'id': reminder_id_str, 'status': 'instance_updated'})
                        continue

                    # 移除操作标记和客户端时间戳
                    if '_operation' in reminder: del reminder['_operation']
                    reminder.pop('updated_at', None)
                    reminder.pop('created_at', None)

                    # 统一处理创建和更新，强制使用服务器时间戳
                    update_data = {
                        '$set': reminder,
                        '$currentDate': { 'updated_at': True },
                        '$setOnInsert': { 'created_at': server_timestamp }
                    }

                    bulk_operations.append(
                        UpdateOne({'_id': reminder_id, 'user_id': user_id}, update_data, upsert=True)
                    )
                    results['details'].append({'id': reminder_id_str, 'status': 'processed'})

                except Exception as e:
                    logger.error(f"处理提醒同步时出错: {str(e)}")
                    results['failed'] += 1
                    results['details'].append({'id': reminder.get('_id', 'unknown'), 'status': 'failed', 'error': str(e)})

            if bulk_operations:
                try:
                    bulk_result = reminders_collection.bulk_write(bulk_operations, ordered=False)
                    results['created'] += bulk_result.inserted_count
                    results['updated'] += bulk_result.modified_count
                    results['deleted'] += bulk_result.deleted_count
                    results['unchanged'] += bulk_result.matched_count - bulk_result.modified_count
                except Exception as e:
                    logger.error(f"提醒批量操作失败: {str(e)}")
                    results['failed'] += len(bulk_operations)

            return {
                'success': True,
                'data': results,
                'errors': [],
                'timestamp': server_timestamp.isoformat()
            }
        except Exception as e:
            logger.error(f"提醒同步失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'SYNC_REMINDERS_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }

    @staticmethod
    def pull_reminders(user_id, cursor=None, limit=100):
        """
        使用游标拉取提醒数据。

        Args:
            user_id (str): 用户ID
            cursor (str, optional): 上次同步的游标。Defaults to None.
            limit (int, optional): 每次拉取的数量。Defaults to 100.

        Returns:
            dict: 包含 'items' 和 'next_cursor' 的字典
        """
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            reminders_collection = mongodb_service.db.reminders
            query = {'user_id': user_id}
            sort_order = [('updated_at', 1), ('_id', 1)]

            if cursor:
                try:
                    last_updated_at_iso, last_id_str = cursor.split('_')
                    last_updated_at = datetime.fromisoformat(last_updated_at_iso.replace('Z', '+00:00'))
                    last_id = ObjectId(last_id_str)
                    query['$or'] = [
                        {'updated_at': {'$gt': last_updated_at}},
                        {
                            'updated_at': last_updated_at,
                            '_id': {'$gt': last_id}
                        }
                    ]
                except (ValueError, TypeError) as e:
                    logger.warning(f"无效的游标格式: {cursor}, 错误: {e}. 将全量拉取。")

            reminders = list(reminders_collection.find(query).sort(sort_order).limit(limit))

            next_cursor = None
            if reminders and len(reminders) == limit:
                last_reminder = reminders[-1]
                next_cursor = f"{last_reminder['updated_at'].isoformat()}_{str(last_reminder['_id'])}"

            # 先保留 ObjectId 列表用于关联查询，再做序列化转换
            reminder_object_ids = [r.get('_id') for r in reminders if isinstance(r.get('_id'), ObjectId)]

            for reminder in reminders:
                if '_id' in reminder and isinstance(reminder['_id'], ObjectId):
                    reminder['_id'] = str(reminder['_id'])
                for field in ['created_at', 'updated_at', 'scheduled_time']:
                    if field in reminder and isinstance(reminder[field], datetime):
                        reminder[field] = reminder[field].isoformat()

            # 获取相关的提醒实例（例外情况）
            instance_collection = mongodb_service.db.reminder_instances
            instances = list(instance_collection.find({
                'user_id': user_id,
                'original_reminder_id': {'$in': reminder_object_ids}
            }))

            for instance in instances:
                if '_id' in instance and isinstance(instance['_id'], ObjectId):
                    instance['_id'] = str(instance['_id'])
                if 'original_reminder_id' in instance and isinstance(instance['original_reminder_id'], ObjectId):
                    instance['original_reminder_id'] = str(instance['original_reminder_id'])
                for field in ['created_at', 'original_time', 'new_time']:
                    if field in instance and isinstance(instance[field], datetime):
                        instance[field] = instance[field].isoformat()

            return {
                'success': True,
                'data': {
                    'items': reminders,
                    'instances': instances, # 将例外实例一并返回
                    'next_cursor': next_cursor
                },
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }
        except Exception as e:
            logger.error(f"拉取提醒失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'PULL_REMINDERS_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }

    @staticmethod
    def sync_user_settings(user_id, settings_data):
        """同步用户设置"""
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            settings_collection = mongodb_service.db.user_settings

            # 添加用户ID和同步时间戳（统一使用服务器时间戳，避免时区混用）
            settings_data['user_id'] = user_id
            settings_data['synced_at'] = SyncService._get_server_timestamp().isoformat()

            existing_settings = settings_collection.find_one({'user_id': user_id})

            if existing_settings:
                result = settings_collection.update_one({'user_id': user_id}, {'$set': settings_data})
                results = {'created': 0, 'updated': 0, 'unchanged': 0}
                results['updated' if result.modified_count > 0 else 'unchanged'] = 1
            else:
                settings_collection.insert_one(settings_data)
                results = {'created': 1, 'updated': 0, 'unchanged': 0}

            return {
                'success': True,
                'data': results,
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat(),
            }
        except Exception as e:
            logger.error(f"用户设置同步失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'SYNC_SETTINGS_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat(),
            }

    @staticmethod
    def get_user_settings(user_id):
        """获取用户设置"""
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            settings_collection = mongodb_service.db.user_settings
            settings = settings_collection.find_one({'user_id': user_id})

            if settings and '_id' in settings and isinstance(settings['_id'], ObjectId):
                settings['_id'] = str(settings['_id'])

            return {
                'success': True,
                'data': settings or {},
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat(),
            }
        except Exception as e:
            logger.error(f"获取用户设置失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'GET_SETTINGS_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat(),
            }

    @staticmethod
    def sync_all_data(user_id, data):
        """
        同步所有数据
        """
        results = {}
        all_errors = []

        # 同步笔记
        if 'notes' in data and isinstance(data['notes'], list):
            note_result = SyncService.sync_notes(user_id, data['notes'])
            results['notes'] = note_result.get('data')
            if not note_result.get('success'):
                all_errors.extend(note_result.get('errors', []))

        # 同步提醒
        if 'reminders' in data and isinstance(data['reminders'], list):
            reminder_result = SyncService.sync_reminders(user_id, data['reminders'])
            results['reminders'] = reminder_result.get('data')
            if not reminder_result.get('success'):
                all_errors.extend(reminder_result.get('errors', []))

        # 同步设置
        if 'settings' in data and isinstance(data['settings'], dict):
            settings_result = SyncService.sync_user_settings(user_id, data['settings'])
            results['settings'] = settings_result.get('data')
            if not settings_result.get('success'):
                all_errors.extend(settings_result.get('errors', []))

        # 同步用户信息
        if 'user' in data and isinstance(data['user'], dict):
            user_result = SyncService.sync_user_data(user_id, data['user'])
            results['user'] = user_result.get('data')
            if not user_result.get('success'):
                all_errors.extend(user_result.get('errors', []))

        return {
            'success': not all_errors,
            'data': results,
            'errors': all_errors,
            'timestamp': SyncService._get_server_timestamp().isoformat()
        }

    @staticmethod
    def sync_key_data(user_id, data):
        """
        只同步关键数据（用户信息和设置）
        """
        results = {}
        all_errors = []

        # 同步设置
        if 'settings' in data and isinstance(data['settings'], dict):
            settings_result = SyncService.sync_user_settings(user_id, data['settings'])
            results['settings'] = settings_result.get('data')
            if not settings_result.get('success'):
                all_errors.extend(settings_result.get('errors', []))

        # 同步用户信息
        if 'user' in data and isinstance(data['user'], dict):
            user_result = SyncService.sync_user_data(user_id, data['user'])
            results['user'] = user_result.get('data')
            if not user_result.get('success'):
                all_errors.extend(user_result.get('errors', []))

        return {
            'success': not all_errors,
            'data': results,
            'errors': all_errors,
            'timestamp': SyncService._get_server_timestamp().isoformat()
        }

    @staticmethod
    def get_user_data(user_id):
        """获取用户基础数据"""
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            users_collection = mongodb_service.db.users
            # 注意：这里的 user_id 是字符串（UUID形式），与 mongodb_models.py 中定义的 UUIDField 一致性需注意
            user_data = users_collection.find_one({'_id': user_id})

            if user_data and '_id' in user_data:
                user_data['_id'] = str(user_data['_id'])

            return {
                'success': True,
                'data': user_data,
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }
        except Exception as e:
            logger.error(f"获取用户数据失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'GET_USER_DATA_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }

    @staticmethod
    def sync_user_data(user_id, user_data):
        """同步用户数据"""
        try:
            if not mongodb_service.initialized:
                mongodb_service.initialize()

            users_collection = mongodb_service.db.users

            # 添加用户ID和同步时间戳
            user_data['_id'] = user_id
            user_data['synced_at'] = SyncService._get_server_timestamp().isoformat()

            existing_user = users_collection.find_one({'_id': user_id})

            if existing_user:
                result = users_collection.update_one({'_id': user_id}, {'$set': user_data})
                results = {'created': 0, 'updated': 0, 'unchanged': 0}
                results['updated' if result.modified_count > 0 else 'unchanged'] = 1
            else:
                users_collection.insert_one(user_data)
                results = {'created': 1, 'updated': 0, 'unchanged': 0}

            return {
                'success': True,
                'data': results,
                'errors': [],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }
        except Exception as e:
            logger.error(f"用户数据同步失败: {str(e)}")
            return {
                'success': False,
                'data': None,
                'errors': [{'code': 'SYNC_USER_DATA_FAILED', 'message': str(e)}],
                'timestamp': SyncService._get_server_timestamp().isoformat()
            }
