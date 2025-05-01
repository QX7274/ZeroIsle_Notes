import React from 'react';
import { Typography, Space, Button, Breadcrumb, Divider } from 'antd';
import { Link } from 'react-router-dom';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
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
    <div className="page-header-wrapper" style={{
      marginBottom: '24px',
      animation: 'fadeIn 0.5s ease-out',
    }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          className="page-breadcrumb"
          style={{
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          <Breadcrumb.Item>
            <Link to="/">
              <HomeOutlined style={{ marginRight: '4px' }} />
              首页
            </Link>
          </Breadcrumb.Item>
          {breadcrumb.map((item, index) => (
            <Breadcrumb.Item key={index}>
              {item.path ? <Link to={item.path}>{item.title}</Link> : item.title}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}

      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px 0',
      }}>
        <div className="page-header-left" style={{
          display: 'flex',
          alignItems: 'center',
        }}>
          {backButton && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{
                marginRight: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                color: '#4361EE',
              }}
            >
              返回
            </Button>
          )}
          {typeof title === 'string' ? (
            <Title
              level={2}
              className="page-title"
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.85)',
              }}
            >
              {title}
            </Title>
          ) : (
            title
          )}
          {subTitle && (
            <div className="page-subtitle" style={{
              marginLeft: '16px',
              color: 'rgba(0, 0, 0, 0.45)',
              fontSize: '14px',
              fontWeight: 'normal',
            }}>
              {subTitle}
            </div>
          )}
        </div>

        {extra && (
          <div className="page-header-extra">
            {Array.isArray(extra) ? (
              <Space size="middle">
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

      {children && (
        <>
          <Divider style={{ margin: '0 0 24px 0', borderColor: 'rgba(0, 0, 0, 0.06)' }} />
          <div className="page-header-content" style={{
            marginBottom: '24px',
          }}>
            {children}
          </div>
        </>
      )}
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
