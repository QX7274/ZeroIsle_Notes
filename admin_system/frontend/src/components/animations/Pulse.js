import React from 'react';
import PropTypes from 'prop-types';

/**
 * 脉冲动画组件 - 增强版
 * @param {React.ReactNode} children - 子元素
 * @param {number} duration - 动画持续时间（秒）
 * @param {number} scale - 缩放比例
 * @param {boolean} infinite - 是否无限循环
 * @param {string} color - 颜色（用于光晕效果）
 * @param {string} type - 动画类型（scale, shadow, glow, opacity）
 * @param {number} delay - 动画延迟时间（秒）
 */
const Pulse = ({
  children,
  duration = 2,
  scale = 1.05,
  infinite = true,
  color = 'rgba(67, 97, 238, 0.6)',
  type = 'scale',
  delay = 0
}) => {
  // 动画样式
  const getAnimationStyle = () => {
    const baseStyle = {
      animation: `pulse-${type} ${duration}s ease-in-out ${delay}s ${infinite ? 'infinite' : '1'}`,
      display: 'inline-block',
      willChange: type === 'scale' ? 'transform' : type === 'opacity' ? 'opacity' : 'box-shadow',
    };

    // 根据类型添加特定样式
    switch (type) {
      case 'shadow':
        return {
          ...baseStyle,
          borderRadius: '8px',
        };
      case 'glow':
        return {
          ...baseStyle,
          borderRadius: '8px',
          position: 'relative',
        };
      default:
        return baseStyle;
    }
  };

  // 动画关键帧
  const keyframes = `
    @keyframes pulse-scale {
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

    @keyframes pulse-shadow {
      0% {
        box-shadow: 0 0 0 0 ${color};
      }
      70% {
        box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
      }
    }

    @keyframes pulse-glow {
      0% {
        box-shadow: 0 0 5px ${color};
      }
      50% {
        box-shadow: 0 0 20px ${color};
      }
      100% {
        box-shadow: 0 0 5px ${color};
      }
    }

    @keyframes pulse-opacity {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
      100% {
        opacity: 1;
      }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div style={getAnimationStyle()}>
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
  color: PropTypes.string,
  type: PropTypes.oneOf(['scale', 'shadow', 'glow', 'opacity']),
  delay: PropTypes.number,
};

export default Pulse;
