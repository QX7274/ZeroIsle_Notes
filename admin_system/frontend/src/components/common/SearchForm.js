import React from 'react';
import { Form, Button, Card, Row, Col, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

/**
 * 搜索表单组件
 * @param {Array} fields - 表单字段配置
 * @param {function} onSearch - 搜索回调
 * @param {function} onReset - 重置回调
 * @param {object} initialValues - 初始值
 * @param {boolean} loading - 是否加载中
 * @param {React.ReactNode} extra - 额外的操作按钮
 * @param {boolean} collapsed - 是否折叠
 * @param {function} onCollapse - 折叠回调
 */
const SearchForm = ({ 
  fields, 
  onSearch, 
  onReset, 
  initialValues, 
  loading, 
  extra, 
  collapsed, 
  onCollapse 
}) => {
  const [form] = Form.useForm();
  
  // 处理搜索
  const handleSearch = () => {
    const values = form.getFieldsValue();
    onSearch && onSearch(values);
  };
  
  // 处理重置
  const handleReset = () => {
    form.resetFields();
    onReset && onReset();
  };
  
  // 计算每个字段的Col宽度
  const getColSpan = () => {
    const count = fields.length;
    if (count <= 3) return 8;
    if (count === 4) return 6;
    return 6;
  };
  
  return (
    <Card className="search-form-card">
      <Form
        form={form}
        layout="horizontal"
        initialValues={initialValues}
        onFinish={handleSearch}
      >
        <Row gutter={16}>
          {fields.map((field, index) => (
            <Col 
              key={field.name || index} 
              xs={24} 
              sm={12} 
              md={getColSpan()} 
              style={{ 
                display: collapsed && index >= 3 ? 'none' : 'block',
                marginBottom: 16
              }}
            >
              <Form.Item 
                name={field.name} 
                label={field.label}
                rules={field.rules}
              >
                {field.component}
              </Form.Item>
            </Col>
          ))}
          
          <Col xs={24} sm={12} md={getColSpan()} style={{ marginBottom: 16, textAlign: 'right' }}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
                loading={loading}
              >
                搜索
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleReset}
              >
                重置
              </Button>
              {fields.length > 3 && (
                <Button 
                  type="link" 
                  onClick={() => onCollapse && onCollapse(!collapsed)}
                >
                  {collapsed ? '展开' : '收起'}
                </Button>
              )}
              {extra}
            </Space>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

SearchForm.propTypes = {
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      component: PropTypes.node.isRequired,
      rules: PropTypes.array,
    })
  ).isRequired,
  onSearch: PropTypes.func.isRequired,
  onReset: PropTypes.func,
  initialValues: PropTypes.object,
  loading: PropTypes.bool,
  extra: PropTypes.node,
  collapsed: PropTypes.bool,
  onCollapse: PropTypes.func,
};

SearchForm.defaultProps = {
  initialValues: {},
  loading: false,
  collapsed: false,
};

export default SearchForm;
