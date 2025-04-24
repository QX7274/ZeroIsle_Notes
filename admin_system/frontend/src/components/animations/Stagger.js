import React from 'react';
import PropTypes from 'prop-types';

/**
 * 交错动画组件
 * @param {React.ReactNode} children - 子元素
 * @param {number} staggerDelay - 子元素之间的延迟时间（毫秒）
 * @param {string} animation - 动画类型（fadeIn, slideIn, etc.）
 * @param {number} duration - 动画持续时间（毫秒）
 * @param {number} baseDelay - 基础延迟时间（毫秒）
 */
const Stagger = ({ 
  children, 
  staggerDelay = 100, 
  animation = 'fadeIn', 
  duration = 500,
  baseDelay = 0
}) => {
  // 获取动画样式
  const getAnimationStyle = (index) => {
    const delay = baseDelay + (index * staggerDelay);
    
    switch (animation) {
      case 'fadeIn':
        return {
          opacity: 0,
          animation: `fadeIn ${duration}ms ease-out ${delay}ms forwards`,
        };
      case 'slideIn':
        return {
          transform: 'translateY(20px)',
          opacity: 0,
          animation: `slideIn ${duration}ms ease-out ${delay}ms forwards`,
        };
      case 'scaleIn':
        return {
          transform: 'scale(0.8)',
          opacity: 0,
          animation: `scaleIn ${duration}ms ease-out ${delay}ms forwards`,
        };
      default:
        return {};
    }
  };
  
  // 动画关键帧
  const keyframes = `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    
    @keyframes slideIn {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes scaleIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `;
  
  return (
    <>
      <style>{keyframes}</style>
      {React.Children.map(children, (child, index) => (
        <div style={getAnimationStyle(index)}>
          {child}
        </div>
      ))}
    </>
  );
};

Stagger.propTypes = {
  children: PropTypes.node.isRequired,
  staggerDelay: PropTypes.number,
  animation: PropTypes.oneOf(['fadeIn', 'slideIn', 'scaleIn']),
  duration: PropTypes.number,
  baseDelay: PropTypes.number,
};

export default Stagger;
