import React from 'react';
import { Card, Statistic, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

/**
 * 统计卡片组件 - 增强版
 * @param {string} title - 卡片标题
 * @param {number|string} value - 统计值
 * @param {React.ReactNode} icon - 图标
 * @param {string} suffix - 后缀
 * @param {React.ReactNode} prefix - 前缀
 * @param {string} tooltip - 提示信息
 * @param {string} color - 卡片颜色
 * @param {function} onClick - 点击事件
 * @param {string} valueStyle - 值的样式
 * @param {boolean} loading - 是否加载中
 * @param {string} backgroundColor - 背景颜色
 * @param {string} gradientColor - 渐变背景颜色
 * @param {string} borderRadius - 边框圆角
 * @param {string} boxShadow - 阴影效果
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
  loading,
  backgroundColor,
  gradientColor,
  borderRadius,
  boxShadow
}) => {
  // 生成渐变背景
  const generateGradient = () => {
    if (gradientColor) {
      return `linear-gradient(135deg, ${backgroundColor || '#fff'}, ${gradientColor})`;
    }
    return backgroundColor || '#fff';
  };

  const cardStyle = {
    cursor: onClick ? 'pointer' : 'default',
    borderLeft: color ? `4px solid ${color}` : undefined,
    height: '100%',
    background: generateGradient(),
    borderRadius: borderRadius || '12px',
    boxShadow: boxShadow || '0 4px 16px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    border: '1px solid rgba(0, 0, 0, 0.03)',
  };

  const defaultValueStyle = {
    color: color || undefined,
    fontSize: '28px',
    fontWeight: 600,
    ...valueStyle,
  };

  return (
    <Card
      className="stat-card"
      style={cardStyle}
      onClick={onClick}
      loading={loading}
      hoverable
    >
      <div className="stat-card-title" style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px',
        fontSize: '16px',
        fontWeight: 500,
        color: 'rgba(0, 0, 0, 0.75)'
      }}>
        {prefix && <span style={{
          marginRight: '8px',
          fontSize: '20px',
          color: color || '#4361EE',
          display: 'flex',
          alignItems: 'center'
        }}>{prefix}</span>}
        {title}
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoCircleOutlined style={{
              marginLeft: 8,
              color: 'rgba(0, 0, 0, 0.45)',
              fontSize: '14px'
            }} />
          </Tooltip>
        )}
      </div>
      <Statistic
        value={value}
        suffix={suffix}
        valueStyle={defaultValueStyle}
      />
      {icon && <div className="stat-card-icon" style={{
        position: 'absolute',
        right: '24px',
        top: '24px',
        fontSize: '48px',
        opacity: 0.1,
        color: color || '#4361EE'
      }}>{icon}</div>}
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
  backgroundColor: PropTypes.string,
  gradientColor: PropTypes.string,
  borderRadius: PropTypes.string,
  boxShadow: PropTypes.string,
};

StatCard.defaultProps = {
  valueStyle: {},
  loading: false,
  backgroundColor: '#fff',
  gradientColor: null,
  borderRadius: '12px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
};

export default StatCard;
