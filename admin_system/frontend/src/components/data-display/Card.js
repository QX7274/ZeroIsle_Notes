import React from 'react';
import { Card as AntCard } from 'antd';
import PropTypes from 'prop-types';
import { FadeIn } from '../animations';

/**
 * 卡片组件
 * @param {string} title - 卡片标题
 * @param {React.ReactNode} extra - 额外内容
 * @param {React.ReactNode} children - 子元素
 * @param {boolean} loading - 是否加载中
 * @param {boolean} hoverable - 是否可悬停
 * @param {string} className - 自定义类名
 * @param {object} style - 自定义样式
 * @param {boolean} bordered - 是否有边框
 * @param {boolean} animation - 是否有动画
 * @param {number} animationDuration - 动画持续时间（毫秒）
 * @param {number} animationDelay - 动画延迟时间（毫秒）
 */
const Card = ({ 
  title, 
  extra, 
  children, 
  loading = false, 
  hoverable = false, 
  className = '', 
  style = {}, 
  bordered = true,
  animation = false,
  animationDuration = 500,
  animationDelay = 0
}) => {
  const card = (
    <AntCard
      title={title}
      extra={extra}
      loading={loading}
      hoverable={hoverable}
      className={`custom-card ${className}`}
      style={style}
      bordered={bordered}
    >
      {children}
    </AntCard>
  );
  
  if (animation) {
    return (
      <FadeIn duration={animationDuration} delay={animationDelay}>
        {card}
      </FadeIn>
    );
  }
  
  return card;
};

Card.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  extra: PropTypes.node,
  children: PropTypes.node,
  loading: PropTypes.bool,
  hoverable: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  bordered: PropTypes.bool,
  animation: PropTypes.bool,
  animationDuration: PropTypes.number,
  animationDelay: PropTypes.number,
};

export default Card;
