import React from 'react';
import { Spin, Typography } from 'antd';
import PropTypes from 'prop-types';

const { Text } = Typography;

/**
 * 加载中组件
 * @param {string} tip - 提示文本
 * @param {string} size - 加载图标大小
 * @param {number} height - 容器高度
 * @param {string} className - 自定义类名
 * @param {object} style - 自定义样式
 */
const Loading = ({ 
  tip = '加载中...', 
  size = 'large', 
  height = 400, 
  className = '', 
  style = {} 
}) => {
  return (
    <div 
      className={`loading-container ${className}`}
      style={{ height: `${height}px`, ...style }}
    >
      <Spin size={size} />
      {tip && <Text type="secondary" style={{ marginTop: 16 }}>{tip}</Text>}
    </div>
  );
};

Loading.propTypes = {
  tip: PropTypes.string,
  size: PropTypes.oneOf(['small', 'default', 'large']),
  height: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default Loading;
