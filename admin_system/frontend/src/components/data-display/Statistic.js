import React from 'react';
import { Statistic as AntStatistic, Card, Tooltip } from 'antd';
import { InfoCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { FadeIn } from '../animations';

/**
 * 统计数值组件
 * @param {string} title - 标题
 * @param {number|string} value - 数值
 * @param {React.ReactNode} prefix - 前缀
 * @param {React.ReactNode} suffix - 后缀
 * @param {string} tooltip - 提示信息
 * @param {number} precision - 精度
 * @param {boolean} loading - 是否加载中
 * @param {string} color - 颜色
 * @param {number|string} trend - 趋势值
 * @param {boolean} card - 是否使用卡片包裹
 * @param {boolean} animation - 是否有动画
 * @param {number} animationDuration - 动画持续时间（毫秒）
 * @param {number} animationDelay - 动画延迟时间（毫秒）
 */
const Statistic = ({ 
  title, 
  value, 
  prefix, 
  suffix, 
  tooltip, 
  precision = 0, 
  loading = false, 
  color,
  trend,
  card = false,
  animation = false,
  animationDuration = 500,
  animationDelay = 0
}) => {
  // 获取趋势图标和颜色
  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    
    const trendValue = parseFloat(trend);
    if (isNaN(trendValue)) return null;
    
    if (trendValue > 0) {
      return <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 8 }} />;
    } else if (trendValue < 0) {
      return <ArrowDownOutlined style={{ color: '#f5222d', marginLeft: 8 }} />;
    }
    
    return null;
  };
  
  // 统计组件
  const statisticComponent = (
    <AntStatistic
      title={
        tooltip ? (
          <span>
            {title}
            <Tooltip title={tooltip}>
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#8c8c8c' }} />
            </Tooltip>
          </span>
        ) : (
          title
        )
      }
      value={value}
      precision={precision}
      loading={loading}
      prefix={prefix}
      suffix={
        <>
          {suffix}
          {getTrendIcon()}
          {trend !== undefined && trend !== null && (
            <span style={{ 
              color: parseFloat(trend) > 0 ? '#52c41a' : parseFloat(trend) < 0 ? '#f5222d' : 'inherit',
              marginLeft: 4,
              fontSize: '0.8em'
            }}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </>
      }
      valueStyle={{ color }}
    />
  );
  
  // 包装组件
  const wrappedComponent = card ? (
    <Card>
      {statisticComponent}
    </Card>
  ) : (
    statisticComponent
  );
  
  // 添加动画
  if (animation) {
    return (
      <FadeIn duration={animationDuration} delay={animationDelay}>
        {wrappedComponent}
      </FadeIn>
    );
  }
  
  return wrappedComponent;
};

Statistic.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  tooltip: PropTypes.string,
  precision: PropTypes.number,
  loading: PropTypes.bool,
  color: PropTypes.string,
  trend: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  card: PropTypes.bool,
  animation: PropTypes.bool,
  animationDuration: PropTypes.number,
  animationDelay: PropTypes.number,
};

export default Statistic;
