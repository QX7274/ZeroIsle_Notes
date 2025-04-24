import React from 'react';
import { Tag, Badge } from 'antd';
import PropTypes from 'prop-types';

/**
 * 状态标签组件
 * @param {string} status - 状态值
 * @param {object} statusMap - 状态映射
 * @param {boolean} showDot - 是否显示状态点
 * @param {string} type - 显示类型 (tag/badge)
 */
const StatusTag = ({ status, statusMap, showDot, type }) => {
  // 默认状态映射
  const defaultStatusMap = {
    active: { text: '活跃', color: 'success' },
    inactive: { text: '禁用', color: 'error' },
    pending: { text: '待处理', color: 'warning' },
    processing: { text: '处理中', color: 'processing' },
    success: { text: '成功', color: 'success' },
    error: { text: '失败', color: 'error' },
    warning: { text: '警告', color: 'warning' },
    default: { text: '默认', color: 'default' },
    published: { text: '已发布', color: 'success' },
    draft: { text: '草稿', color: 'warning' },
    deleted: { text: '已删除', color: 'error' },
  };
  
  // 合并状态映射
  const mergedStatusMap = { ...defaultStatusMap, ...statusMap };
  
  // 获取状态配置
  const getStatusConfig = () => {
    return mergedStatusMap[status] || { text: status, color: 'default' };
  };
  
  const { text, color } = getStatusConfig();
  
  // 根据类型渲染不同的组件
  if (type === 'badge') {
    return (
      <Badge
        status={color}
        text={text}
      />
    );
  }
  
  return (
    <Tag color={color}>
      {showDot && <Badge status={color} style={{ marginRight: 8 }} />}
      {text}
    </Tag>
  );
};

StatusTag.propTypes = {
  status: PropTypes.string.isRequired,
  statusMap: PropTypes.object,
  showDot: PropTypes.bool,
  type: PropTypes.oneOf(['tag', 'badge']),
};

StatusTag.defaultProps = {
  statusMap: {},
  showDot: false,
  type: 'tag',
};

export default StatusTag;
