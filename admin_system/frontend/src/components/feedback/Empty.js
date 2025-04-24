import React from 'react';
import { Empty as AntEmpty, Button } from 'antd';
import PropTypes from 'prop-types';

/**
 * 空状态组件
 * @param {string} description - 描述文本
 * @param {React.ReactNode} image - 自定义图片
 * @param {React.ReactNode} extra - 额外内容
 * @param {function} onAction - 操作按钮点击事件
 * @param {string} actionText - 操作按钮文本
 * @param {boolean} showAction - 是否显示操作按钮
 */
const Empty = ({ 
  description = '暂无数据', 
  image = '/images/empty.svg', 
  extra, 
  onAction, 
  actionText = '添加数据', 
  showAction = false 
}) => {
  return (
    <AntEmpty
      image={image}
      imageStyle={{
        height: 100,
      }}
      description={description}
    >
      {showAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
      {extra}
    </AntEmpty>
  );
};

Empty.propTypes = {
  description: PropTypes.string,
  image: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  extra: PropTypes.node,
  onAction: PropTypes.func,
  actionText: PropTypes.string,
  showAction: PropTypes.bool,
};

export default Empty;
