import logging
from django.utils import timezone
from datetime import timedelta
from urllib.parse import quote_plus
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from .models import NoteCategory, Tag, ContentReport, Note, Comment, Attachment

logger = logging.getLogger(__name__)

class ContentService:
    """内容服务类，用于处理内容数据的同步和访问"""

    def __init__(self, mongo_host=None, mongo_port=None, mongo_db=None, mongo_user=None, mongo_password=None):
        """初始化内容服务"""
        from django.conf import settings

        # 使用传入的参数或从设置中获取
        self.mongo_host = mongo_host or settings.MONGO_HOST
        self.mongo_port = mongo_port or settings.MONGO_PORT
        self.mongo_db = mongo_db or settings.MONGO_DB
        self.mongo_user = mongo_user or settings.MONGO_USER
        self.mongo_password = mongo_password or settings.MONGO_PASSWORD

        # 连接到MongoDB
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

        return MongoClient(mongo_uri)

    def sync_categories(self, incremental=True, last_sync_time=None):
        """同步分类数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取分类数据
            categories_collection = self.db["note_categories"]
            categories = list(categories_collection.find(query))

            # 处理分类数据
            processed_count = 0
            for category_data in categories:
                try:
                    # 检查分类是否已存在
                    category_id = str(category_data.get("_id"))
                    try:
                        category = NoteCategory.objects.get(id=category_id)
                        # 更新现有分类
                        self._update_category_from_data(category, category_data)
                    except NoteCategory.DoesNotExist:
                        # 创建新分类
                        self._create_category_from_data(category_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理分类数据时出错: {str(e)}")

            return {
                "total_categories": len(categories),
                "processed_categories": processed_count
            }

        except Exception as e:
            logger.error(f"同步分类数据时出错: {str(e)}")
            raise

    def _create_category_from_data(self, category_data):
        """从数据创建分类"""
        category = NoteCategory(
            id=str(category_data.get("_id")),
            name=category_data.get("name", ""),
            description=category_data.get("description", ""),
            created_at=category_data.get("created_at", timezone.now()),
            updated_at=category_data.get("updated_at", timezone.now())
        )
        category.save()
        return category

    def _update_category_from_data(self, category, category_data):
        """从数据更新分类"""
        category.name = category_data.get("name", category.name)
        category.description = category_data.get("description", category.description)
        category.updated_at = category_data.get("updated_at", timezone.now())
        category.save()
        return category

    def sync_tags(self, incremental=True, last_sync_time=None):
        """同步标签数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["created_at"] = {"$gt": last_sync_time}

            # 从主应用获取标签数据
            tags_collection = self.db["tags"]
            tags = list(tags_collection.find(query))

            # 处理标签数据
            processed_count = 0
            for tag_data in tags:
                try:
                    # 检查标签是否已存在
                    tag_id = str(tag_data.get("_id"))
                    try:
                        tag = Tag.objects.get(id=tag_id)
                        # 标签已存在，不需要更新
                    except Tag.DoesNotExist:
                        # 创建新标签
                        self._create_tag_from_data(tag_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理标签数据时出错: {str(e)}")

            return {
                "total_tags": len(tags),
                "processed_tags": processed_count
            }

        except Exception as e:
            logger.error(f"同步标签数据时出错: {str(e)}")
            raise

    def _create_tag_from_data(self, tag_data):
        """从数据创建标签"""
        tag = Tag(
            id=str(tag_data.get("_id")),
            name=tag_data.get("name", ""),
            created_at=tag_data.get("created_at", timezone.now())
        )
        tag.save()
        return tag

    def sync_reports(self, incremental=True, last_sync_time=None):
        """同步举报数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取举报数据
            reports_collection = self.db["content_reports"]
            reports = list(reports_collection.find(query))

            # 处理举报数据
            processed_count = 0
            for report_data in reports:
                try:
                    # 检查举报是否已存在
                    report_id = str(report_data.get("_id"))
                    try:
                        report = ContentReport.objects.get(id=report_id)
                        # 更新现有举报
                        self._update_report_from_data(report, report_data)
                    except ContentReport.DoesNotExist:
                        # 创建新举报
                        self._create_report_from_data(report_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理举报数据时出错: {str(e)}")

            return {
                "total_reports": len(reports),
                "processed_reports": processed_count
            }

        except Exception as e:
            logger.error(f"同步举报数据时出错: {str(e)}")
            raise

    def _create_report_from_data(self, report_data):
        """从数据创建举报"""
        report = ContentReport(
            id=str(report_data.get("_id")),
            content_id=report_data.get("content_id", ""),
            content_type=report_data.get("content_type", ""),
            reporter_id=report_data.get("reporter_id", ""),
            reason=report_data.get("reason", "other"),
            description=report_data.get("description", ""),
            status=report_data.get("status", "pending"),
            admin_comment=report_data.get("admin_comment", ""),
            created_at=report_data.get("created_at", timezone.now()),
            updated_at=report_data.get("updated_at", timezone.now())
        )
        report.save()
        return report

    def _update_report_from_data(self, report, report_data):
        """从数据更新举报"""
        report.content_id = report_data.get("content_id", report.content_id)
        report.content_type = report_data.get("content_type", report.content_type)
        report.reporter_id = report_data.get("reporter_id", report.reporter_id)
        report.reason = report_data.get("reason", report.reason)
        report.description = report_data.get("description", report.description)
        report.status = report_data.get("status", report.status)
        report.admin_comment = report_data.get("admin_comment", report.admin_comment)
        report.updated_at = report_data.get("updated_at", timezone.now())
        report.save()
        return report

    def update_report_in_main_app(self, report_id, report_data):
        """在主应用中更新举报数据"""
        try:
            reports_collection = self.db["content_reports"]
            result = reports_collection.update_one(
                {"_id": report_id},
                {"$set": report_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新举报数据时出错: {str(e)}")
            return False

    def get_content_stats(self):
        """获取内容统计信息"""
        try:
            # 从主应用数据库获取统计信息
            notes_collection = self.db["notes"]
            comments_collection = self.db["comments"]
            attachments_collection = self.db["attachments"]

            # 获取笔记统计
            total_notes = notes_collection.count_documents({})
            published_notes = notes_collection.count_documents({"status": "published"})
            draft_notes = notes_collection.count_documents({"status": "draft"})

            # 获取评论统计
            total_comments = comments_collection.count_documents({})

            # 获取附件统计
            total_attachments = attachments_collection.count_documents({})

            # 获取今日新增内容
            today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_notes = notes_collection.count_documents({"created_at": {"$gte": today}})
            today_comments = comments_collection.count_documents({"created_at": {"$gte": today}})

            return {
                "notes": {
                    "total": total_notes,
                    "published": published_notes,
                    "draft": draft_notes,
                    "today_new": today_notes
                },
                "comments": {
                    "total": total_comments,
                    "today_new": today_comments
                },
                "attachments": {
                    "total": total_attachments
                }
            }

        except Exception as e:
            logger.error(f"获取内容统计信息时出错: {str(e)}")
            # 如果无法从主应用获取，则使用本地数据
            return self._get_local_content_stats()

    def _get_local_content_stats(self):
        """从本地数据获取内容统计信息"""
        # 这里可以添加从本地数据库获取统计信息的逻辑
        # 由于我们没有在本地存储笔记和评论数据，所以这里返回空数据
        return {
            "notes": {
                "total": 0,
                "published": 0,
                "draft": 0,
                "today_new": 0
            },
            "comments": {
                "total": 0,
                "today_new": 0
            },
            "attachments": {
                "total": 0
            }
        }

    def get_notes(self, query=None, limit=10, skip=0, sort_by=None, sort_order=1):
        """获取笔记列表"""
        try:
            notes_collection = self.db["notes"]

            # 构建查询条件
            query = query or {}

            # 构建排序条件
            sort_options = {}
            if sort_by:
                sort_options[sort_by] = sort_order
            else:
                sort_options["created_at"] = -1  # 默认按创建时间降序排序

            # 执行查询
            notes = list(notes_collection.find(query).sort(list(sort_options.items())).skip(skip).limit(limit))

            # 获取总数
            total = notes_collection.count_documents(query)

            return {
                "notes": notes,
                "total": total
            }

        except Exception as e:
            logger.error(f"获取笔记列表时出错: {str(e)}")
            return {
                "notes": [],
                "total": 0
            }

    def get_note_detail(self, note_id):
        """获取笔记详情"""
        try:
            notes_collection = self.db["notes"]
            note = notes_collection.find_one({"_id": note_id})

            if not note:
                return None

            # 获取笔记的评论数量
            comments_collection = self.db["comments"]
            comments_count = comments_collection.count_documents({"note_id": note_id})

            # 获取笔记的附件数量
            attachments_collection = self.db["attachments"]
            attachments_count = attachments_collection.count_documents({"note_id": note_id})

            # 添加评论和附件数量到笔记数据中
            note["comments_count"] = comments_count
            note["attachments_count"] = attachments_count

            return note

        except Exception as e:
            logger.error(f"获取笔记详情时出错: {str(e)}")
            return None

    def get_comments(self, query=None, limit=10, skip=0, sort_by=None, sort_order=1):
        """获取评论列表"""
        try:
            comments_collection = self.db["comments"]

            # 构建查询条件
            query = query or {}

            # 构建排序条件
            sort_options = {}
            if sort_by:
                sort_options[sort_by] = sort_order
            else:
                sort_options["created_at"] = -1  # 默认按创建时间降序排序

            # 执行查询
            comments = list(comments_collection.find(query).sort(list(sort_options.items())).skip(skip).limit(limit))

            # 获取总数
            total = comments_collection.count_documents(query)

            return {
                "comments": comments,
                "total": total
            }

        except Exception as e:
            logger.error(f"获取评论列表时出错: {str(e)}")
            return {
                "comments": [],
                "total": 0
            }

    def delete_comment(self, comment_id):
        """删除评论"""
        try:
            comments_collection = self.db["comments"]
            result = comments_collection.delete_one({"_id": comment_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"删除评论时出错: {str(e)}")
            return False

    def get_attachments(self, query=None, limit=10, skip=0, sort_by=None, sort_order=1):
        """获取附件列表"""
        try:
            attachments_collection = self.db["attachments"]

            # 构建查询条件
            query = query or {}

            # 构建排序条件
            sort_options = {}
            if sort_by:
                sort_options[sort_by] = sort_order
            else:
                sort_options["created_at"] = -1  # 默认按创建时间降序排序

            # 执行查询
            attachments = list(attachments_collection.find(query).sort(list(sort_options.items())).skip(skip).limit(limit))

            # 获取总数
            total = attachments_collection.count_documents(query)

            return {
                "attachments": attachments,
                "total": total
            }

        except Exception as e:
            logger.error(f"获取附件列表时出错: {str(e)}")
            return {
                "attachments": [],
                "total": 0
            }

    def delete_attachment(self, attachment_id):
        """删除附件"""
        try:
            attachments_collection = self.db["attachments"]
            result = attachments_collection.delete_one({"_id": attachment_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"删除附件时出错: {str(e)}")
            return False

    def sync_notes(self, incremental=True, last_sync_time=None):
        """同步笔记数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取笔记数据
            notes_collection = self.db["notes"]
            notes = list(notes_collection.find(query))

            # 处理笔记数据
            processed_count = 0
            for note_data in notes:
                try:
                    # 检查笔记是否已存在
                    note_id = str(note_data.get("_id"))
                    try:
                        note = Note.objects.get(id=note_id)
                        # 更新现有笔记
                        self._update_note_from_data(note, note_data)
                    except Note.DoesNotExist:
                        # 创建新笔记
                        self._create_note_from_data(note_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理笔记数据时出错: {str(e)}")

            return {
                "total_notes": len(notes),
                "processed_notes": processed_count
            }

        except Exception as e:
            logger.error(f"同步笔记数据时出错: {str(e)}")
            raise

    def _create_note_from_data(self, note_data):
        """从数据创建笔记"""
        # 获取分类
        category = None
        category_id = note_data.get("category_id")
        if category_id:
            try:
                category = NoteCategory.objects.get(id=category_id)
            except NoteCategory.DoesNotExist:
                pass

        # 获取标签
        tags = []
        tag_ids = note_data.get("tag_ids", [])
        for tag_id in tag_ids:
            try:
                tag = Tag.objects.get(id=tag_id)
                tags.append(tag)
            except Tag.DoesNotExist:
                pass

        # 创建笔记
        note = Note(
            id=str(note_data.get("_id")),
            title=note_data.get("title", ""),
            content=note_data.get("content", ""),
            note_type=note_data.get("note_type", "text"),
            status=note_data.get("status", "draft"),
            user_id=note_data.get("user_id", ""),
            username=note_data.get("username", ""),
            category=category,
            is_public=note_data.get("is_public", False),
            is_pinned=note_data.get("is_pinned", False),
            is_favorite=note_data.get("is_favorite", False),
            view_count=note_data.get("view_count", 0),
            like_count=note_data.get("like_count", 0),
            comment_count=note_data.get("comment_count", 0),
            metadata=note_data.get("metadata", {}),
            created_at=note_data.get("created_at", timezone.now()),
            updated_at=note_data.get("updated_at", timezone.now())
        )
        note.save()

        # 添加标签
        if tags:
            note.tags = tags
            note.save()

        return note

    def _update_note_from_data(self, note, note_data):
        """从数据更新笔记"""
        # 更新基本信息
        note.title = note_data.get("title", note.title)
        note.content = note_data.get("content", note.content)
        note.note_type = note_data.get("note_type", note.note_type)
        note.status = note_data.get("status", note.status)
        note.user_id = note_data.get("user_id", note.user_id)
        note.username = note_data.get("username", note.username)
        note.is_public = note_data.get("is_public", note.is_public)
        note.is_pinned = note_data.get("is_pinned", note.is_pinned)
        note.is_favorite = note_data.get("is_favorite", note.is_favorite)
        note.view_count = note_data.get("view_count", note.view_count)
        note.like_count = note_data.get("like_count", note.like_count)
        note.comment_count = note_data.get("comment_count", note.comment_count)
        note.metadata = note_data.get("metadata", note.metadata)
        note.updated_at = note_data.get("updated_at", timezone.now())

        # 更新分类
        category_id = note_data.get("category_id")
        if category_id:
            try:
                category = NoteCategory.objects.get(id=category_id)
                note.category = category
            except NoteCategory.DoesNotExist:
                pass

        # 更新标签
        tag_ids = note_data.get("tag_ids", [])
        if tag_ids:
            tags = []
            for tag_id in tag_ids:
                try:
                    tag = Tag.objects.get(id=tag_id)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    pass
            note.tags = tags

        note.save()
        return note

    def update_note_in_main_app(self, note_id, note_data):
        """在主应用中更新笔记数据"""
        try:
            notes_collection = self.db["notes"]
            result = notes_collection.update_one(
                {"_id": note_id},
                {"$set": note_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新笔记数据时出错: {str(e)}")
            return False

    def delete_note_in_main_app(self, note_id):
        """在主应用中删除笔记"""
        try:
            notes_collection = self.db["notes"]
            result = notes_collection.delete_one({"_id": note_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"在主应用中删除笔记时出错: {str(e)}")
            return False

    def sync_comments(self, incremental=True, last_sync_time=None):
        """同步评论数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["updated_at"] = {"$gt": last_sync_time}

            # 从主应用获取评论数据
            comments_collection = self.db["comments"]
            comments = list(comments_collection.find(query))

            # 处理评论数据
            processed_count = 0
            for comment_data in comments:
                try:
                    # 检查评论是否已存在
                    comment_id = str(comment_data.get("_id"))
                    try:
                        comment = Comment.objects.get(id=comment_id)
                        # 更新现有评论
                        self._update_comment_from_data(comment, comment_data)
                    except Comment.DoesNotExist:
                        # 创建新评论
                        self._create_comment_from_data(comment_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理评论数据时出错: {str(e)}")

            return {
                "total_comments": len(comments),
                "processed_comments": processed_count
            }

        except Exception as e:
            logger.error(f"同步评论数据时出错: {str(e)}")
            raise

    def _create_comment_from_data(self, comment_data):
        """从数据创建评论"""
        # 获取笔记
        note = None
        note_id = comment_data.get("note_id")
        if note_id:
            try:
                note = Note.objects.get(id=note_id)
            except Note.DoesNotExist:
                # 如果笔记不存在，则从主应用获取笔记数据并创建
                try:
                    notes_collection = self.db["notes"]
                    note_data = notes_collection.find_one({"_id": note_id})
                    if note_data:
                        note = self._create_note_from_data(note_data)
                except Exception as e:
                    logger.error(f"获取笔记数据时出错: {str(e)}")

        if not note:
            logger.error(f"无法创建评论，笔记不存在: {note_id}")
            return None

        # 获取父评论
        parent_comment = None
        parent_comment_id = comment_data.get("parent_comment_id")
        if parent_comment_id:
            try:
                parent_comment = Comment.objects.get(id=parent_comment_id)
            except Comment.DoesNotExist:
                pass

        # 创建评论
        comment = Comment(
            id=str(comment_data.get("_id")),
            content=comment_data.get("content", ""),
            note=note,
            user_id=comment_data.get("user_id", ""),
            username=comment_data.get("username", ""),
            parent_comment=parent_comment,
            is_deleted=comment_data.get("is_deleted", False),
            like_count=comment_data.get("like_count", 0),
            created_at=comment_data.get("created_at", timezone.now()),
            updated_at=comment_data.get("updated_at", timezone.now())
        )
        comment.save()
        return comment

    def _update_comment_from_data(self, comment, comment_data):
        """从数据更新评论"""
        # 更新基本信息
        comment.content = comment_data.get("content", comment.content)
        comment.user_id = comment_data.get("user_id", comment.user_id)
        comment.username = comment_data.get("username", comment.username)
        comment.is_deleted = comment_data.get("is_deleted", comment.is_deleted)
        comment.like_count = comment_data.get("like_count", comment.like_count)
        comment.updated_at = comment_data.get("updated_at", timezone.now())

        # 更新笔记
        note_id = comment_data.get("note_id")
        if note_id and str(comment.note.id) != note_id:
            try:
                note = Note.objects.get(id=note_id)
                comment.note = note
            except Note.DoesNotExist:
                pass

        # 更新父评论
        parent_comment_id = comment_data.get("parent_comment_id")
        if parent_comment_id:
            try:
                parent_comment = Comment.objects.get(id=parent_comment_id)
                comment.parent_comment = parent_comment
            except Comment.DoesNotExist:
                pass

        comment.save()
        return comment

    def update_comment_in_main_app(self, comment_id, comment_data):
        """在主应用中更新评论数据"""
        try:
            comments_collection = self.db["comments"]
            result = comments_collection.update_one(
                {"_id": comment_id},
                {"$set": comment_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新评论数据时出错: {str(e)}")
            return False

    def delete_comment_in_main_app(self, comment_id):
        """在主应用中删除评论"""
        try:
            comments_collection = self.db["comments"]
            result = comments_collection.delete_one({"_id": comment_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"在主应用中删除评论时出错: {str(e)}")
            return False

    def sync_attachments(self, incremental=True, last_sync_time=None):
        """同步附件数据"""
        try:
            # 查询条件
            query = {}
            if incremental and last_sync_time:
                query["created_at"] = {"$gt": last_sync_time}

            # 从主应用获取附件数据
            attachments_collection = self.db["attachments"]
            attachments = list(attachments_collection.find(query))

            # 处理附件数据
            processed_count = 0
            for attachment_data in attachments:
                try:
                    # 检查附件是否已存在
                    attachment_id = str(attachment_data.get("_id"))
                    try:
                        attachment = Attachment.objects.get(id=attachment_id)
                        # 附件已存在，不需要更新
                    except Attachment.DoesNotExist:
                        # 创建新附件
                        self._create_attachment_from_data(attachment_data)

                    processed_count += 1
                except Exception as e:
                    logger.error(f"处理附件数据时出错: {str(e)}")

            return {
                "total_attachments": len(attachments),
                "processed_attachments": processed_count
            }

        except Exception as e:
            logger.error(f"同步附件数据时出错: {str(e)}")
            raise

    def _create_attachment_from_data(self, attachment_data):
        """从数据创建附件"""
        # 获取笔记
        note = None
        note_id = attachment_data.get("note_id")
        if note_id:
            try:
                note = Note.objects.get(id=note_id)
            except Note.DoesNotExist:
                pass

        # 创建附件
        attachment = Attachment(
            id=str(attachment_data.get("_id")),
            filename=attachment_data.get("filename", ""),
            file_path=attachment_data.get("file_path", ""),
            file_type=attachment_data.get("file_type", "other"),
            file_size=attachment_data.get("file_size", 0),
            mime_type=attachment_data.get("mime_type", ""),
            note=note,
            user_id=attachment_data.get("user_id", ""),
            created_at=attachment_data.get("created_at", timezone.now())
        )
        attachment.save()
        return attachment

    def update_attachment_in_main_app(self, attachment_id, attachment_data):
        """在主应用中更新附件数据"""
        try:
            attachments_collection = self.db["attachments"]
            result = attachments_collection.update_one(
                {"_id": attachment_id},
                {"$set": attachment_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"在主应用中更新附件数据时出错: {str(e)}")
            return False

    def delete_attachment_in_main_app(self, attachment_id):
        """在主应用中删除附件"""
        try:
            attachments_collection = self.db["attachments"]
            result = attachments_collection.delete_one({"_id": attachment_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"在主应用中删除附件时出错: {str(e)}")
            return False

# 懒加载内容服务，避免模块导入阶段触发数据库连接
_content_service_instance = None


def get_content_service():
    global _content_service_instance
    if _content_service_instance is None:
        _content_service_instance = ContentService()
    return _content_service_instance


class _LazyContentService:
    def __getattr__(self, item):
        return getattr(get_content_service(), item)


content_service = _LazyContentService()
