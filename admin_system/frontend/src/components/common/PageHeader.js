import React from 'react';
import { Typography, Space, Button, Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

const { Title } = Typography;

/**
 * 页面标题组件
 * @param {string} title - 页面标题
 * @param {Array} breadcrumb - 面包屑导航项
 * @param {React.ReactNode} extra - 额外的操作按钮
 * @param {React.ReactNode} children - 子元素
 * @param {string} subTitle - 副标题
 * @param {boolean} backButton - 是否显示返回按钮
 * @param {function} onBack - 返回按钮点击事件
 */
const PageHeader = ({ 
  title, 
  breadcrumb, 
  extra, 
  children, 
  subTitle, 
  backButton, 
  onBack 
}) => {
  return (
    <div className="page-header-wrapper">
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb className="page-breadcrumb">
          {breadcrumb.map((item, index) => (
            <Breadcrumb.Item key={index}>
              {item.path ? <Link to={item.path}>{item.title}</Link> : item.title}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}
      
      <div className="page-header">
        <div className="page-header-left">
          {backButton && (
            <Button 
              type="link" 
              onClick={onBack} 
              style={{ marginRight: 8, padding: 0 }}
            >
              返回
            </Button>
          )}
          <Title level={2} className="page-title">{title}</Title>
          {subTitle && <div className="page-subtitle">{subTitle}</div>}
        </div>
        
        {extra && (
          <div className="page-header-extra">
            {Array.isArray(extra) ? (
              <Space>
                {extra.map((item, index) => (
                  <React.Fragment key={index}>{item}</React.Fragment>
                ))}
              </Space>
            ) : (
              extra
            )}
          </div>
        )}
      </div>
      
      {children && <div className="page-header-content">{children}</div>}
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  breadcrumb: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      path: PropTypes.string,
    })
  ),
  extra: PropTypes.oneOfType([PropTypes.node, PropTypes.arrayOf(PropTypes.node)]),
  children: PropTypes.node,
  subTitle: PropTypes.string,
  backButton: PropTypes.bool,
  onBack: PropTypes.func,
};

PageHeader.defaultProps = {
  breadcrumb: [],
  backButton: false,
  onBack: () => window.history.back(),
};

export default PageHeader;
