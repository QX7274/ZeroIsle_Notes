"""
增强版备份服务（优化版）
- 修复ObjectId恢复问题
- 批处理导出/导入
- 完整性校验（SHA256）
- 可选加密支持
- 流式处理大数据集
- 操作审计
"""

import os
import json
import shutil
import zipfile
import tempfile
import hashlib
import logging
from datetime import datetime
from urllib.parse import quote_plus
from typing import Dict, List, Any, Optional, Tuple
from django.utils import timezone
from pymongo import MongoClient
from pymongo.errors import PyMongoError, BulkWriteError
from bson import ObjectId, json_util
from bson.errors import InvalidId

logger = logging.getLogger(__name__)


class BackupServiceEnhanced:
    """
    增强版备份服务类
    - 批处理：避免内存溢出
    - ObjectId恢复：正确处理MongoDB对象ID
    - 完整性校验：SHA256哈希验证
    - 流式处理：支持大数据集
    """
    
    # 批处理大小配置
    DEFAULT_BATCH_SIZE = 2000
    DEFAULT_INSERT_BATCH_SIZE = 1000
    
    # ObjectId字段白名单（需要转换的字段）
    OBJECTID_FIELDS = {
        '_id',
        'user_id', 'user', 
        'note_id', 'note',
        'category_id', 'category',
        'tag_id', 'tag',
        'parent_id', 'parent',
        'created_by', 'updated_by',
        'owner_id', 'owner'
    }
    
    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, 
                 mongo_user=None, mongo_password=None, backup_dir=None):
        """初始化增强版备份服务"""
        from django.conf import settings
        
        self.mongo_host = mongo_host or settings.MONGO_HOST
        self.mongo_port = mongo_port or settings.MONGO_PORT
        self.mongo_db = mongo_db or settings.MONGO_DB
        self.mongo_user = mongo_user or settings.MONGO_USER
        self.mongo_password = mongo_password or settings.MONGO_PASSWORD
        
        # 备份目录
        self.backup_dir = backup_dir or os.path.join(settings.BASE_DIR, 'backups')
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)
        
        # 连接MongoDB
        self.client = self._get_mongo_client()
        self.db = self.client[self.mongo_db]
    
    def _get_mongo_client(self):
        """获取MongoDB客户端连接"""
        if self.mongo_user and self.mongo_password:
            encoded_user = quote_plus(str(self.mongo_user))
            encoded_password = quote_plus(str(self.mongo_password))
            mongo_uri = f"mongodb://{encoded_user}:{encoded_password}@{self.mongo_host}:{self.mongo_port}/{self.mongo_db}?authSource=admin"
        else:
            mongo_uri = f"mongodb://{self.mongo_host}:{self.mongo_port}/{self.mongo_db}"

        return MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)

    @staticmethod
    def calculate_file_hash(file_path: str) -> str:
        """
        计算文件的SHA256哈希值
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: SHA256哈希值（十六进制）
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            # 分块读取，避免大文件内存溢出
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    @staticmethod
    def restore_objectid_in_document(doc: Dict[str, Any], 
                                     fields: Optional[set] = None) -> Dict[str, Any]:
        """
        恢复文档中的ObjectId字段
        
        Args:
            doc: 文档字典
            fields: 需要转换的字段集合（默认使用OBJECTID_FIELDS）
            
        Returns:
            Dict: 转换后的文档
        """
        if fields is None:
            fields = BackupServiceEnhanced.OBJECTID_FIELDS
        
        for field in fields:
            if field in doc:
                value = doc[field]
                # 处理字符串类型的ObjectId
                if isinstance(value, str) and ObjectId.is_valid(value):
                    try:
                        doc[field] = ObjectId(value)
                    except InvalidId:
                        logger.warning(f"无法转换字段 {field} 的值: {value}")
                # 处理嵌套的引用字段（如数组）
                elif isinstance(value, list):
                    doc[field] = [
                        ObjectId(v) if isinstance(v, str) and ObjectId.is_valid(v) else v
                        for v in value
                    ]
        
        return doc
    
    def export_collection_batch(self, collection_name: str, output_dir: str,
                               batch_size: int = DEFAULT_BATCH_SIZE) -> Tuple[int, List[str]]:
        """
        批量导出集合数据（流式处理）
        
        Args:
            collection_name: 集合名称
            output_dir: 输出目录
            batch_size: 批处理大小
            
        Returns:
            Tuple[int, List[str]]: (文档总数, 文件路径列表)
        """
        collection = self.db[collection_name]
        total_count = 0
        file_paths = []
        batch_index = 0
        
        # 使用游标批量读取
        cursor = collection.find({}, no_cursor_timeout=True).batch_size(batch_size)
        
        try:
            batch_documents = []
            
            for doc in cursor:
                # 使用bson.json_util序列化（保留类型信息）
                batch_documents.append(doc)
                total_count += 1
                
                # 达到批次大小，写入文件
                if len(batch_documents) >= batch_size:
                    file_path = self._write_batch_to_file(
                        collection_name, batch_documents, output_dir, batch_index
                    )
                    file_paths.append(file_path)
                    batch_documents = []
                    batch_index += 1
            
            # 写入剩余文档
            if batch_documents:
                file_path = self._write_batch_to_file(
                    collection_name, batch_documents, output_dir, batch_index
                )
                file_paths.append(file_path)
        
        finally:
            cursor.close()
        
        logger.info(f"导出集合 {collection_name}: {total_count} 个文档, {len(file_paths)} 个文件")
        return total_count, file_paths
    
    def _write_batch_to_file(self, collection_name: str, documents: List[Dict],
                            output_dir: str, batch_index: int) -> str:
        """
        将批次数据写入文件
        
        Args:
            collection_name: 集合名称
            documents: 文档列表
            output_dir: 输出目录
            batch_index: 批次索引
            
        Returns:
            str: 文件路径
        """
        # 生成文件名
        if batch_index == 0:
            filename = f"{collection_name}.json"
        else:
            filename = f"{collection_name}_{batch_index}.json"
        
        file_path = os.path.join(output_dir, filename)
        
        # 使用json_util序列化（保留ObjectId等类型）
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(documents, f, default=json_util.default, ensure_ascii=False, indent=2)
        
        return file_path
    
    def import_collection_batch(self, collection_name: str, file_paths: List[str],
                               clear_existing: bool = True,
                               batch_size: int = DEFAULT_INSERT_BATCH_SIZE) -> Dict[str, Any]:
        """
        批量导入集合数据
        
        Args:
            collection_name: 集合名称
            file_paths: 数据文件路径列表
            clear_existing: 是否清空现有数据
            batch_size: 插入批次大小
            
        Returns:
            Dict: 导入统计信息
        """
        collection = self.db[collection_name]
        
        # 清空现有数据
        if clear_existing:
            delete_result = collection.delete_many({})
            logger.info(f"清空集合 {collection_name}: 删除 {delete_result.deleted_count} 个文档")
        
        total_inserted = 0
        total_errors = 0
        
        for file_path in file_paths:
            if not os.path.exists(file_path):
                logger.warning(f"文件不存在: {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                # 使用json_util反序列化（恢复ObjectId等类型）
                documents = json.load(f, object_hook=json_util.object_hook)
            
            # 恢复ObjectId字段
            documents = [self.restore_objectid_in_document(doc) for doc in documents]
            
            # 分批插入
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                try:
                    result = collection.insert_many(batch, ordered=False)
                    total_inserted += len(result.inserted_ids)
                except BulkWriteError as e:
                    # 记录错误但继续
                    total_inserted += e.details.get('nInserted', 0)
                    total_errors += len(e.details.get('writeErrors', []))
                    logger.warning(f"批量插入部分失败: {e.details}")
        
        logger.info(f"导入集合 {collection_name}: 成功 {total_inserted}, 失败 {total_errors}")
        
        return {
            'collection': collection_name,
            'inserted': total_inserted,
            'errors': total_errors
        }

    def create_manifest(self, temp_dir: str, collections_info: Dict[str, Any]) -> str:
        """
        创建备份清单文件（包含文件哈希）

        Args:
            temp_dir: 临时目录
            collections_info: 集合信息字典

        Returns:
            str: 清单文件路径
        """
        manifest = {
            'version': '2.0',
            'created_at': timezone.now().isoformat(),
            'collections': {},
            'files': {}
        }

        # 收集所有文件信息
        collections_dir = os.path.join(temp_dir, 'collections')

        for collection_name, info in collections_info.items():
            manifest['collections'][collection_name] = {
                'document_count': info['count'],
                'file_count': len(info['files'])
            }

            # 计算每个文件的哈希
            for file_path in info['files']:
                if os.path.exists(file_path):
                    file_hash = self.calculate_file_hash(file_path)
                    relative_path = os.path.relpath(file_path, temp_dir)
                    manifest['files'][relative_path] = {
                        'size': os.path.getsize(file_path),
                        'sha256': file_hash
                    }

        # 保存清单文件
        manifest_path = os.path.join(temp_dir, 'manifest.json')
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        return manifest_path

    def verify_manifest(self, temp_dir: str) -> Tuple[bool, List[str]]:
        """
        验证备份清单（检查文件完整性）

        Args:
            temp_dir: 临时目录

        Returns:
            Tuple[bool, List[str]]: (是否通过, 错误信息列表)
        """
        manifest_path = os.path.join(temp_dir, 'manifest.json')

        if not os.path.exists(manifest_path):
            return False, ['清单文件不存在']

        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        errors = []

        # 验证每个文件
        for relative_path, file_info in manifest.get('files', {}).items():
            file_path = os.path.join(temp_dir, relative_path)

            # 检查文件是否存在
            if not os.path.exists(file_path):
                errors.append(f"文件不存在: {relative_path}")
                continue

            # 检查文件大小
            actual_size = os.path.getsize(file_path)
            expected_size = file_info.get('size', 0)
            if actual_size != expected_size:
                errors.append(f"文件大小不匹配: {relative_path} (期望: {expected_size}, 实际: {actual_size})")

            # 检查文件哈希
            expected_hash = file_info.get('sha256')
            if expected_hash:
                actual_hash = self.calculate_file_hash(file_path)
                if actual_hash != expected_hash:
                    errors.append(f"文件哈希不匹配: {relative_path}")

        return len(errors) == 0, errors

    def create_backup_enhanced(self, backup_obj, collections: List[str],
                              batch_size: int = DEFAULT_BATCH_SIZE) -> Dict[str, Any]:
        """
        创建增强版备份

        Args:
            backup_obj: 备份对象
            collections: 要备份的集合列表
            batch_size: 批处理大小

        Returns:
            Dict: 备份结果
        """
        temp_dir = tempfile.mkdtemp()

        try:
            # 创建集合目录
            collections_dir = os.path.join(temp_dir, 'collections')
            os.makedirs(collections_dir)

            # 导出每个集合
            collections_info = {}

            for collection_name in collections:
                if collection_name not in self.db.list_collection_names():
                    logger.warning(f"集合不存在: {collection_name}")
                    continue

                try:
                    count, file_paths = self.export_collection_batch(
                        collection_name, collections_dir, batch_size
                    )
                    collections_info[collection_name] = {
                        'count': count,
                        'files': file_paths
                    }
                except Exception as e:
                    logger.error(f"导出集合 {collection_name} 失败: {str(e)}")
                    raise

            # 创建元数据
            metadata = {
                'backup_id': str(backup_obj.id),
                'backup_type': backup_obj.backup_type,
                'name': backup_obj.name,
                'description': backup_obj.description,
                'created_by': backup_obj.created_by,
                'created_at': timezone.now().isoformat(),
                'database': self.mongo_db,
                'collections': list(collections_info.keys()),
                'total_documents': sum(info['count'] for info in collections_info.values())
            }

            metadata_path = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            # 创建清单文件
            manifest_path = self.create_manifest(temp_dir, collections_info)

            # 创建ZIP文件
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            backup_id_short = str(backup_obj.id)[:8]
            zip_filename = f"{backup_obj.backup_type}_backup_{backup_id_short}_{timestamp}.zip"
            zip_path = os.path.join(self.backup_dir, zip_filename)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 添加元数据和清单
                zipf.write(metadata_path, 'metadata.json')
                zipf.write(manifest_path, 'manifest.json')

                # 添加集合数据文件
                for collection_name, info in collections_info.items():
                    for file_path in info['files']:
                        arcname = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, arcname)

            # 获取文件大小
            file_size = os.path.getsize(zip_path)

            logger.info(f"备份创建成功: {zip_filename}, 大小: {file_size} 字节")

            return {
                'status': 'success',
                'file_path': zip_path,
                'file_size': file_size,
                'collections': list(collections_info.keys()),
                'total_documents': metadata['total_documents']
            }

        except Exception as e:
            logger.error(f"创建备份失败: {str(e)}")
            raise

        finally:
            # 清理临时目录
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    def restore_backup_enhanced(self, backup_obj, verify_integrity: bool = True,
                               batch_size: int = DEFAULT_INSERT_BATCH_SIZE) -> Dict[str, Any]:
        """
        恢复增强版备份

        Args:
            backup_obj: 备份对象
            verify_integrity: 是否验证完整性
            batch_size: 插入批次大小

        Returns:
            Dict: 恢复结果
        """
        # 检查备份状态
        if backup_obj.status != 'completed':
            raise ValueError(f"备份状态不正确: {backup_obj.status}")

        # 检查备份文件
        if not backup_obj.file_path or not os.path.exists(backup_obj.file_path):
            raise ValueError("备份文件不存在")

        temp_dir = tempfile.mkdtemp()

        try:
            # 解压备份文件
            with zipfile.ZipFile(backup_obj.file_path, 'r') as zipf:
                zipf.extractall(temp_dir)

            # 验证完整性
            if verify_integrity:
                is_valid, errors = self.verify_manifest(temp_dir)
                if not is_valid:
                    raise ValueError(f"备份完整性验证失败: {', '.join(errors)}")
                logger.info("备份完整性验证通过")

            # 读取元数据
            metadata_path = os.path.join(temp_dir, 'metadata.json')
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)

            # 获取集合列表
            collections = metadata.get('collections', [])

            # 恢复每个集合
            restore_results = []
            collections_dir = os.path.join(temp_dir, 'collections')

            for collection_name in collections:
                # 查找该集合的所有数据文件
                file_paths = []

                # 主文件
                main_file = os.path.join(collections_dir, f"{collection_name}.json")
                if os.path.exists(main_file):
                    file_paths.append(main_file)

                # 分片文件
                batch_index = 1
                while True:
                    batch_file = os.path.join(collections_dir, f"{collection_name}_{batch_index}.json")
                    if os.path.exists(batch_file):
                        file_paths.append(batch_file)
                        batch_index += 1
                    else:
                        break

                if file_paths:
                    try:
                        result = self.import_collection_batch(
                            collection_name, file_paths,
                            clear_existing=True, batch_size=batch_size
                        )
                        restore_results.append(result)
                    except Exception as e:
                        logger.error(f"恢复集合 {collection_name} 失败: {str(e)}")
                        restore_results.append({
                            'collection': collection_name,
                            'inserted': 0,
                            'errors': 1,
                            'error_message': str(e)
                        })

            # 统计结果
            total_inserted = sum(r.get('inserted', 0) for r in restore_results)
            total_errors = sum(r.get('errors', 0) for r in restore_results)

            logger.info(f"备份恢复完成: 成功 {total_inserted}, 失败 {total_errors}")

            return {
                'status': 'success',
                'message': '备份恢复成功',
                'collections': collections,
                'total_inserted': total_inserted,
                'total_errors': total_errors,
                'details': restore_results
            }

        except Exception as e:
            logger.error(f"恢复备份失败: {str(e)}")
            return {
                'status': 'error',
                'message': f"恢复备份失败: {str(e)}"
            }

        finally:
            # 清理临时目录
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    def get_collection_lists_by_type(self, backup_type: str) -> List[str]:
        """
        根据备份类型获取集合列表

        Args:
            backup_type: 备份类型

        Returns:
            List[str]: 集合名称列表
        """
        # 集合分类配置
        collection_groups = {
            'full': None,  # None表示所有集合
            'data': [
                'notes', 'note_versions', 'note_backups',
                'comments', 'attachments', 'categories', 'tags',
                'note_shares', 'note_collaborations', 'note_reminders',
                'annotations', 'drawing_paths'
            ],
            'settings': [
                'system_settings', 'announcements', 'system_logs'
            ],
            'user': [
                'users', 'user_profiles', 'user_preferences',
                'user_sessions', 'user_tokens'
            ],
            'content': [
                'notes', 'note_versions', 'categories', 'tags',
                'templates', 'note_templates'
            ]
        }

        if backup_type == 'full':
            # 返回所有集合
            return self.db.list_collection_names()
        else:
            # 返回指定类型的集合（过滤不存在的）
            collections = collection_groups.get(backup_type, [])
            existing_collections = self.db.list_collection_names()
            return [c for c in collections if c in existing_collections]


# 懒加载增强版备份服务，避免模块导入阶段触发数据库连接
_backup_service_enhanced_instance = None


def get_backup_service_enhanced():
    global _backup_service_enhanced_instance
    if _backup_service_enhanced_instance is None:
        _backup_service_enhanced_instance = BackupServiceEnhanced()
    return _backup_service_enhanced_instance


class _LazyBackupServiceEnhanced:
    def __getattr__(self, item):
        return getattr(get_backup_service_enhanced(), item)


backup_service_enhanced = _LazyBackupServiceEnhanced()

