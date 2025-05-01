import React from 'react';
import PropTypes from 'prop-types';

/**
 * 交错动画组件 - 增强版
 * @param {React.ReactNode} children - 子元素
 * @param {number} staggerDelay - 子元素之间的延迟时间（毫秒）
 * @param {string} animation - 动画类型（fadeIn, slideIn, scaleIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, zoomIn, bounceIn）
 * @param {number} duration - 动画持续时间（毫秒）
 * @param {number} baseDelay - 基础延迟时间（毫秒）
 * @param {string} easing - 缓动函数
 * @param {number} distance - 移动距离（像素）
 * @param {boolean} once - 是否只执行一次
 */
const Stagger = ({
  children,
  staggerDelay = 100,
  animation = 'fadeIn',
  duration = 500,
  baseDelay = 0,
  easing = 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  distance = 30,
  once = true
}) => {
  // 获取动画样式
  const getAnimationStyle = (index) => {
    const delay = baseDelay + (index * staggerDelay);

    switch (animation) {
      case 'fadeIn':
        return {
          opacity: 0,
          animation: `fadeIn ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity',
        };
      case 'fadeInUp':
        return {
          transform: `translateY(${distance}px)`,
          opacity: 0,
          animation: `fadeInUp ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'fadeInDown':
        return {
          transform: `translateY(-${distance}px)`,
          opacity: 0,
          animation: `fadeInDown ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'fadeInLeft':
        return {
          transform: `translateX(-${distance}px)`,
          opacity: 0,
          animation: `fadeInLeft ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'fadeInRight':
        return {
          transform: `translateX(${distance}px)`,
          opacity: 0,
          animation: `fadeInRight ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'slideIn':
        return {
          transform: `translateY(${distance}px)`,
          opacity: 0,
          animation: `slideIn ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'scaleIn':
        return {
          transform: 'scale(0.9)',
          opacity: 0,
          animation: `scaleIn ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'zoomIn':
        return {
          transform: 'scale(0.5)',
          opacity: 0,
          animation: `zoomIn ${duration}ms ${easing} ${delay}ms forwards`,
          willChange: 'opacity, transform',
        };
      case 'bounceIn':
        return {
          transform: 'scale(0.3)',
          opacity: 0,
          animation: `bounceIn ${duration}ms cubic-bezier(0.215, 0.610, 0.355, 1.000) ${delay}ms forwards`,
          willChange: 'opacity, transform',
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

    @keyframes fadeInUp {
      from {
        transform: translateY(${distance}px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes fadeInDown {
      from {
        transform: translateY(-${distance}px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes fadeInLeft {
      from {
        transform: translateX(-${distance}px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes fadeInRight {
      from {
        transform: translateX(${distance}px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideIn {
      from {
        transform: translateY(${distance}px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes zoomIn {
      from {
        transform: scale(0.5);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes bounceIn {
      0% {
        transform: scale(0.3);
        opacity: 0;
      }
      20% {
        transform: scale(1.1);
      }
      40% {
        transform: scale(0.9);
        opacity: 1;
      }
      60% {
        transform: scale(1.03);
      }
      80% {
        transform: scale(0.97);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      {React.Children.map(children, (child, index) => (
        <div
          style={{
            ...getAnimationStyle(index),
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {child}
        </div>
      ))}
    </>
  );
};

Stagger.propTypes = {
  children: PropTypes.node.isRequired,
  staggerDelay: PropTypes.number,
  animation: PropTypes.oneOf([
    'fadeIn',
    'fadeInUp',
    'fadeInDown',
    'fadeInLeft',
    'fadeInRight',
    'slideIn',
    'scaleIn',
    'zoomIn',
    'bounceIn'
  ]),
  duration: PropTypes.number,
  baseDelay: PropTypes.number,
  easing: PropTypes.string,
  distance: PropTypes.number,
  once: PropTypes.bool,
};

export default Stagger;
