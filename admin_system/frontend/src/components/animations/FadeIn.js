import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * 淡入动画组件
 * @param {React.ReactNode} children - 子元素
 * @param {number} duration - 动画持续时间（毫秒）
 * @param {number} delay - 动画延迟时间（毫秒）
 * @param {string} direction - 动画方向（up, down, left, right）
 * @param {number} distance - 动画距离（像素）
 * @param {boolean} once - 是否只执行一次
 */
const FadeIn = ({ 
  children, 
  duration = 500, 
  delay = 0, 
  direction = 'up', 
  distance = 20,
  once = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      // 如果元素可见
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        // 如果只执行一次，则取消观察
        if (once) {
          observer.unobserve(domRef.current);
        }
      } else if (!once) {
        // 如果不是只执行一次，则当元素不可见时重置状态
        setIsVisible(false);
      }
    });
    
    observer.observe(domRef.current);
    
    return () => {
      if (domRef.current) {
        observer.unobserve(domRef.current);
      }
    };
  }, [once]);
  
  // 根据方向设置初始位置
  const getTransform = () => {
    switch (direction) {
      case 'up':
        return `translateY(${distance}px)`;
      case 'down':
        return `translateY(-${distance}px)`;
      case 'left':
        return `translateX(${distance}px)`;
      case 'right':
        return `translateX(-${distance}px)`;
      default:
        return 'none';
    }
  };
  
  // 动画样式
  const animationStyle = {
    opacity: 0,
    transform: getTransform(),
    transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
  };
  
  // 可见时的样式
  const visibleStyle = {
    opacity: 1,
    transform: 'none',
  };
  
  return (
    <div
      ref={domRef}
      style={{
        ...animationStyle,
        ...(isVisible ? visibleStyle : {}),
      }}
    >
      {children}
    </div>
  );
};

FadeIn.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.number,
  delay: PropTypes.number,
  direction: PropTypes.oneOf(['up', 'down', 'left', 'right']),
  distance: PropTypes.number,
  once: PropTypes.bool,
};

export default FadeIn;
