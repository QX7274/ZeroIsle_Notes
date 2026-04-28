"""
知识库管理服务
提供知识库的创建、权限、版本等管理功能
"""

import logging
import uuid
from django.utils import timezone
from typing import List, Dict, Optional

from knowledge_base.mongodb_models import (
    KnowledgeBase, KnowledgeBaseSnapshot, KnowledgeBaseMember
)
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge

logger = logging.getLogger(__name__)


class KnowledgeBaseManagementService:
    """
    知识库管理服务
    """
    
    def create_knowledge_base(self, user, name: str, description: str = '', 
                             kb_type: str = 'personal', **kwargs) -> KnowledgeBase:
        """
        创建新的知识库
        
        Args:
            user: 用户对象
            name: 知识库名称
            description: 知识库描述
            kb_type: 知识库类型 (personal, project, team, public)
            **kwargs: 其他可选参数
            
        Returns:
            KnowledgeBase: 创建的知识库对象
        """
        try:
            kb = KnowledgeBase(
                id=uuid.uuid4(),
                name=name,
                description=description,
                owner=user,
                type=kb_type,
                icon=kwargs.get('icon', ''),
                cover_image=kwargs.get('cover_image', ''),
                tags=kwargs.get('tags', []),
                is_public=kwargs.get('is_public', False),
                settings=kwargs.get('settings', {}),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            
            # 如果是团队知识库，添加创建者为管理员
            if kb_type in ['team', 'project']:
                kb.members = [user]
            
            kb.save()
            
            logger.info(f"创建知识库成功: {kb.name} (ID: {kb.id})")
            return kb
            
        except Exception as e:
            logger.error(f"创建知识库失败: {e}")
            raise
    
    def update_knowledge_base(self, kb_id: uuid.UUID, user, **kwargs) -> KnowledgeBase:
        """
        更新知识库信息
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            **kwargs: 要更新的字段
            
        Returns:
            KnowledgeBase: 更新后的知识库对象
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 权限检查
            if not self._check_permission(kb, user, 'edit'):
                raise PermissionError("没有权限编辑此知识库")
            
            # 更新字段
            for field in ['name', 'description', 'icon', 'cover_image', 'tags', 'is_public', 'settings']:
                if field in kwargs:
                    setattr(kb, field, kwargs[field])
            
            kb.updated_at = timezone.now()
            kb.save()
            
            logger.info(f"更新知识库成功: {kb.name}")
            return kb
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            raise
        except Exception as e:
            logger.error(f"更新知识库失败: {e}")
            raise
    
    def delete_knowledge_base(self, kb_id: uuid.UUID, user, hard_delete: bool = False) -> bool:
        """
        删除知识库
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            hard_delete: 是否硬删除（彻底删除）
            
        Returns:
            bool: 是否删除成功
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 权限检查 - 只有所有者可以删除
            if kb.owner != user:
                raise PermissionError("只有所有者可以删除知识库")
            
            if hard_delete:
                # 硬删除：删除所有相关数据
                # 删除知识库中的所有节点和边
                KnowledgeNode.objects.filter(
                    properties__knowledge_base_id=str(kb_id)
                ).delete()
                
                KnowledgeEdge.objects.filter(
                    properties__knowledge_base_id=str(kb_id)
                ).delete()
                
                # 删除快照
                KnowledgeBaseSnapshot.objects.filter(knowledge_base=kb).delete()
                
                # 删除知识库本身
                kb.delete()
                logger.info(f"硬删除知识库成功: {kb.name}")
            else:
                # 软删除：仅标记为已删除
                kb.is_deleted = True
                kb.updated_at = timezone.now()
                kb.save()
                logger.info(f"软删除知识库成功: {kb.name}")
            
            return True
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            return False
        except Exception as e:
            logger.error(f"删除知识库失败: {e}")
            raise
    
    def add_member(self, kb, adding_user, user_to_add_id, role, request=None) -> KnowledgeBase:
        """添加新成员到知识库"""
        from users.mongodb_models import User
        from common.services.audit_service import AuditService

        if not self._can_manage_members(kb, adding_user):
            raise PermissionError("没有权限管理成员")

        if any(str(m.user.id) == user_to_add_id for m in kb.members):
            raise ValueError("用户已经是该知识库的成员")

        user_to_add = User.objects.get(id=user_to_add_id)
        new_member = KnowledgeBaseMember(user=user_to_add, role=role)
        kb.members.append(new_member)
        kb.save()

        AuditService.log_action(adding_user, 'kb_member_added', kb, details={'added_user_id': user_to_add_id, 'role': role}, request=request)
        return kb

    def update_member_role(self, kb, updating_user, user_to_update_id, new_role, request=None) -> KnowledgeBase:
        """更新成员的角色"""
        from common.services.audit_service import AuditService

        if not self._can_manage_members(kb, updating_user):
            raise PermissionError("没有权限管理成员")

        member_to_update = next((m for m in kb.members if str(m.user.id) == user_to_update_id), None)
        if not member_to_update:
            raise ValueError("成员不存在")

        old_role = member_to_update.role
        member_to_update.role = new_role
        kb.save()

        AuditService.log_action(updating_user, 'kb_member_role_updated', kb, details={'updated_user_id': user_to_update_id, 'old_role': old_role, 'new_role': new_role}, request=request)
        return kb

    def remove_member(self, kb, removing_user, user_to_remove_id, request=None) -> KnowledgeBase:
        """移除知识库成员"""
        from common.services.audit_service import AuditService

        if not self._can_manage_members(kb, removing_user):
            raise PermissionError("没有权限管理成员")

        if str(kb.owner.id) == user_to_remove_id:
            raise ValueError("不能移除知识库所有者")

        original_member_count = len(kb.members)
        kb.members = [m for m in kb.members if str(m.user.id) != user_to_remove_id]

        if len(kb.members) == original_member_count:
            raise ValueError("成员不存在")

        kb.save()
        AuditService.log_action(removing_user, 'kb_member_removed', kb, details={'removed_user_id': user_to_remove_id}, request=request)
        return kb
    
    def batch_move_nodes(self, user, node_ids: List[uuid.UUID], target_kb_id: uuid.UUID, request=None) -> Dict:
        """批量移动节点到另一个知识库"""
        from common.services.audit_service import AuditService
        from knowledge_graph.mongodb_models import KnowledgeNode

        target_kb = KnowledgeBase.objects.get(id=target_kb_id)
        if not self._check_permission(target_kb, user, 'edit'):
            raise PermissionError("没有权限移动节点到目标知识库")

        updated_count = KnowledgeNode.objects.filter(id__in=node_ids, user=user).update(set__properties__knowledge_base_id=str(target_kb_id))

        details = {'node_ids': [str(nid) for nid in node_ids], 'target_kb_id': str(target_kb_id)}
        AuditService.log_action(user, 'kb_nodes_moved', target_kb, details=details, request=request)

        return {'success': True, 'updated_count': updated_count}

    def batch_archive_nodes(self, user, node_ids: List[uuid.UUID], request=None) -> Dict:
        """批量归档节点 (通过设置一个属性)"""
        from common.services.audit_service import AuditService
        from knowledge_graph.mongodb_models import KnowledgeNode

        nodes = KnowledgeNode.objects.filter(id__in=node_ids, user=user)
        if len(nodes) != len(node_ids):
            raise PermissionError("一个或多个节点不存在或您没有权限操作")

        updated_count = nodes.update(set__properties__is_archived=True)
        
        details = {'node_ids': [str(nid) for nid in node_ids]}
        AuditService.log_action(user, 'kb_nodes_archived', user, details=details, request=request)

        return {'success': True, 'updated_count': updated_count}

    def batch_delete_nodes(self, user, node_ids: List[uuid.UUID], request=None) -> Dict:
        """批量软删除节点"""
        from common.services.audit_service import AuditService
        from knowledge_graph.mongodb_models import KnowledgeNode

        nodes = KnowledgeNode.objects.filter(id__in=node_ids, user=user)
        if len(nodes) != len(node_ids):
            raise PermissionError("一个或多个节点不存在或您没有权限操作")

        updated_count = nodes.update(set__is_deleted=True)

        details = {'node_ids': [str(nid) for nid in node_ids]}
        AuditService.log_action(user, 'kb_nodes_deleted', user, details=details, request=request)

        return {'success': True, 'updated_count': updated_count}

    def create_snapshot(self, kb_id: uuid.UUID, user, name: str = '', 
                       description: str = '') -> KnowledgeBaseSnapshot:
        """
        创建知识库快照
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            name: 快照名称
            description: 快照描述
            
        Returns:
            KnowledgeBaseSnapshot: 创建的快照对象
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 权限检查
            if not self._check_permission(kb, user, 'create_snapshot'):
                raise PermissionError("没有权限创建快照")
            
            # 获取知识库的所有节点和边
            nodes = KnowledgeNode.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            )
            
            edges = KnowledgeEdge.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            )
            
            # 构建快照数据
            snapshot_data = {
                'nodes': [self._serialize_node(node) for node in nodes],
                'edges': [self._serialize_edge(edge) for edge in edges],
                'metadata': {
                    'kb_name': kb.name,
                    'kb_type': kb.type,
                    'kb_settings': kb.settings
                }
            }
            
            # 创建快照
            snapshot = KnowledgeBaseSnapshot(
                id=uuid.uuid4(),
                knowledge_base=kb,
                name=name or f"快照 {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                description=description,
                snapshot_data=snapshot_data,
                node_count=len(nodes),
                edge_count=len(edges),
                created_by=user,
                created_at=timezone.now()
            )
            snapshot.save()
            
            logger.info(f"创建快照成功: {snapshot.name}")
            return snapshot
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            raise
        except Exception as e:
            logger.error(f"创建快照失败: {e}")
            raise
    
    def _check_permission(self, kb: KnowledgeBase, user, action: str) -> bool:
        """检查用户权限"""
        # 所有者拥有所有权限
        if kb.owner == user:
            return True
        
        # 成员权限检查
        if user in kb.members:
            # 这里可以根据实际需求实现更细粒度的权限控制
            if action in ['view', 'read']:
                return True
            elif action in ['edit', 'create_snapshot']:
                return True  # 所有成员都可以编辑和创建快照
            elif action in ['manage_members', 'delete']:
                return False  # 只有所有者可以管理成员和删除
        
        # 公开知识库的查看权限
        if kb.is_public and action in ['view', 'read']:
            return True
        
        return False

    def _can_manage_members(self, kb: KnowledgeBase, user) -> bool:
        """检查用户是否有权限管理成员（所有者或管理员）"""
        if kb.owner.id == user.id:
            return True
        
        for member in kb.members:
            if member.user.id == user.id and member.role == 'admin':
                return True
        
        return False
    
    def _serialize_node(self, node: KnowledgeNode) -> Dict:
        """序列化节点数据"""
        return {
            'id': str(node.id),
            'title': node.title,
            'description': node.description,
            'type': node.type,
            'properties': node.properties,
            'position': node.position
        }
    
    def _serialize_edge(self, edge: KnowledgeEdge) -> Dict:
        """序列化边数据"""
        return {
            'id': str(edge.id),
            'source': str(edge.source.id),
            'target': str(edge.target.id),
            'type': edge.type,
            'label': edge.label,
            'properties': edge.properties
        }

