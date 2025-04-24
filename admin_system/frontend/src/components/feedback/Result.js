import React from 'react';
import { Result as AntResult, Button } from 'antd';
import PropTypes from 'prop-types';
import { FadeIn } from '../animations';

/**
 * 结果页组件
 * @param {string} status - 结果状态（success, error, info, warning, 404, 403, 500）
 * @param {string} title - 标题
 * @param {string} subTitle - 副标题
 * @param {React.ReactNode} extra - 额外内容
 * @param {function} onBack - 返回按钮点击事件
 * @param {string} backText - 返回按钮文本
 * @param {boolean} showBack - 是否显示返回按钮
 * @param {React.ReactNode} icon - 自定义图标
 * @param {React.ReactNode} children - 子元素
 */
const Result = ({ 
  status = 'info', 
  title, 
  subTitle, 
  extra, 
  onBack, 
  backText = '返回', 
  showBack = true,
  icon,
  children
}) => {
  // 自定义图标
  const customIcon = {
    success: '/images/success.svg',
    error: '/images/error.svg',
    info: null,
    warning: null,
    404: null,
    403: null,
    500: null,
  };
  
  // 获取图标
  const getIcon = () => {
    if (icon) return icon;
    if (customIcon[status]) {
      return <img src={customIcon[status]} alt={status} style={{ width: 80, height: 80 }} />;
    }
    return null;
  };
  
  return (
    <FadeIn>
      <AntResult
        status={status}
        title={title}
        subTitle={subTitle}
        icon={getIcon()}
        extra={
          <>
            {extra}
            {showBack && (
              <Button type="primary" onClick={onBack || (() => window.history.back())}>
                {backText}
              </Button>
            )}
          </>
        }
      >
        {children}
      </AntResult>
    </FadeIn>
  );
};

Result.propTypes = {
  status: PropTypes.oneOf(['success', 'error', 'info', 'warning', '404', '403', '500']),
  title: PropTypes.string,
  subTitle: PropTypes.string,
  extra: PropTypes.node,
  onBack: PropTypes.func,
  backText: PropTypes.string,
  showBack: PropTypes.bool,
  icon: PropTypes.node,
  children: PropTypes.node,
};

export default Result;
