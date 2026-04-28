/**
 * PPT文档查看器
 * 直接路由到PDF查看器，支持PPT转PDF后查看
 */

import React from 'react';
import PDFViewerNative from './PDFViewerNative';

/**
 * PPT文档查看器组件
 * 直接使用PDF查看器，支持PPT转PDF后查看
 */
const PPTViewer = (props) => {
  // 传递fileType参数，标识这是PPT文档
  const enhancedProps = {
    ...props,
    route: {
      ...props.route,
      params: {
        ...props.route.params,
        fileType: 'ppt',
      },
    },
  };

  return <PDFViewerNative {...enhancedProps} />;
};

export default PPTViewer;
