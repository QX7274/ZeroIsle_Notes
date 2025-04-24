import React from 'react';
import PropTypes from 'prop-types';

/**
 * 脉冲动画组件
 * @param {React.ReactNode} children - 子元素
 * @param {number} duration - 动画持续时间（秒）
 * @param {number} scale - 缩放比例
 * @param {boolean} infinite - 是否无限循环
 */
const Pulse = ({ 
  children, 
  duration = 2, 
  scale = 1.05, 
  infinite = true 
}) => {
  // 动画样式
  const pulseStyle = {
    animation: `pulse ${duration}s ease-in-out ${infinite ? 'infinite' : '1'}`,
  };
  
  // 动画关键帧
  const keyframes = `
    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(${scale});
      }
      100% {
        transform: scale(1);
      }
    }
  `;
  
  return (
    <>
      <style>{keyframes}</style>
      <div style={pulseStyle}>
        {children}
      </div>
    </>
  );
};

Pulse.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.number,
  scale: PropTypes.number,
  infinite: PropTypes.bool,
};

export default Pulse;
