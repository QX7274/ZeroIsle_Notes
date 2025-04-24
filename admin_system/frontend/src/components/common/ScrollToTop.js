import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { UpOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

/**
 * 滚动到顶部组件
 * @param {number} visibilityHeight - 显示按钮的滚动高度
 * @param {number} duration - 滚动动画持续时间（毫秒）
 * @param {string} className - 自定义类名
 * @param {object} style - 自定义样式
 */
const ScrollToTop = ({ 
  visibilityHeight = 400, 
  duration = 500, 
  className = '', 
  style = {} 
}) => {
  const [visible, setVisible] = useState(false);
  
  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.pageYOffset > visibilityHeight);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [visibilityHeight]);
  
  // 滚动到顶部
  const scrollToTop = () => {
    const startTime = Date.now();
    const startPosition = window.pageYOffset;
    
    const scrollStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // 缓动函数
      
      window.scrollTo(0, startPosition * (1 - easeProgress));
      
      if (progress < 1) {
        requestAnimationFrame(scrollStep);
      }
    };
    
    requestAnimationFrame(scrollStep);
  };
  
  return (
    <div 
      className={`scroll-to-top ${visible ? 'visible' : ''} ${className}`}
      style={style}
      onClick={scrollToTop}
      aria-label="滚动到顶部"
      role="button"
      tabIndex={0}
    >
      <UpOutlined />
    </div>
  );
};

ScrollToTop.propTypes = {
  visibilityHeight: PropTypes.number,
  duration: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default ScrollToTop;
