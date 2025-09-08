/**
 * Word文档查看器
 * 直接路由到PDF查看器，支持Word转PDF后查看
 * 保留了纯前端实现的备份版本 (DocViewer_Frontend.js)
 */

import React from 'react';
import PDFViewer from './PDFViewer';

/**
 * Word文档查看器组件
 * 直接使用PDF查看器，支持Word转PDF后查看
 */
const DocViewer = (props) => {
  // 传递fileType参数，标识这是Word文档
  const enhancedProps = {
    ...props,
    route: {
      ...props.route,
      params: {
        ...props.route.params,
        fileType: 'word'
      }
    }
  };

  return <PDFViewer {...enhancedProps} />;
};

export default DocViewer;