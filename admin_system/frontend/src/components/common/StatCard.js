import React from 'react';
import { Card, Statistic, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

/**
 * 统计卡片组件
 * @param {string} title - 卡片标题
 * @param {number|string} value - 统计值
 * @param {React.ReactNode} icon - 图标
 * @param {string} suffix - 后缀
 * @param {string} prefix - 前缀
 * @param {string} tooltip - 提示信息
 * @param {string} color - 卡片颜色
 * @param {function} onClick - 点击事件
 * @param {string} valueStyle - 值的样式
 * @param {boolean} loading - 是否加载中
 */
const StatCard = ({ 
  title, 
  value, 
  icon, 
  suffix, 
  prefix, 
  tooltip, 
  color, 
  onClick, 
  valueStyle, 
  loading 
}) => {
  const cardStyle = {
    cursor: onClick ? 'pointer' : 'default',
    borderLeft: color ? `4px solid ${color}` : undefined,
    height: '100%',
  };
  
  const defaultValueStyle = {
    color: color || undefined,
    ...valueStyle,
  };
  
  return (
    <Card 
      className="stat-card" 
      style={cardStyle} 
      onClick={onClick}
      loading={loading}
    >
      <div className="stat-card-title">
        {title}
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#8c8c8c' }} />
          </Tooltip>
        )}
      </div>
      <Statistic 
        value={value} 
        suffix={suffix} 
        prefix={prefix}
        valueStyle={defaultValueStyle}
      />
      {icon && <div className="stat-card-icon">{icon}</div>}
    </Card>
  );
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  icon: PropTypes.node,
  suffix: PropTypes.node,
  prefix: PropTypes.node,
  tooltip: PropTypes.string,
  color: PropTypes.string,
  onClick: PropTypes.func,
  valueStyle: PropTypes.object,
  loading: PropTypes.bool,
};

StatCard.defaultProps = {
  valueStyle: {},
  loading: false,
};

export default StatCard;
