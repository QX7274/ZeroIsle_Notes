import React, { useState } from 'react';
import { Table, Card, Button, Space, Tooltip, Dropdown, Menu } from 'antd';
import { ReloadOutlined, SettingOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

/**
 * 高级表格组件
 * @param {Array} columns - 表格列配置
 * @param {Array} dataSource - 表格数据
 * @param {object} pagination - 分页配置
 * @param {function} onChange - 表格变化回调
 * @param {boolean} loading - 是否加载中
 * @param {string} title - 表格标题
 * @param {React.ReactNode} toolbar - 工具栏
 * @param {React.ReactNode} extra - 额外的操作按钮
 * @param {object} rowSelection - 行选择配置
 * @param {boolean} bordered - 是否显示边框
 * @param {string} size - 表格大小
 * @param {function} onRefresh - 刷新回调
 * @param {boolean} fullscreen - 是否全屏
 * @param {function} onFullscreen - 全屏回调
 */
const ProTable = ({ 
  columns, 
  dataSource, 
  pagination, 
  onChange, 
  loading, 
  title, 
  toolbar, 
  extra, 
  rowSelection, 
  bordered, 
  size, 
  onRefresh,
  fullscreen,
  onFullscreen
}) => {
  // 列设置状态
  const [visibleColumns, setVisibleColumns] = useState(
    columns.map(column => ({
      ...column,
      visible: column.visible !== false,
    }))
  );
  
  // 处理列显示切换
  const handleColumnVisibleChange = (key, visible) => {
    const newVisibleColumns = visibleColumns.map(column => {
      if (column.key === key || column.dataIndex === key) {
        return { ...column, visible };
      }
      return column;
    });
    setVisibleColumns(newVisibleColumns);
  };
  
  // 列设置菜单
  const columnSettingMenu = (
    <Menu>
      {visibleColumns.map(column => (
        <Menu.Item key={column.key || column.dataIndex}>
          <Space>
            <input
              type="checkbox"
              checked={column.visible !== false}
              onChange={e => handleColumnVisibleChange(column.key || column.dataIndex, e.target.checked)}
            />
            {column.title}
          </Space>
        </Menu.Item>
      ))}
    </Menu>
  );
  
  // 过滤不可见的列
  const filteredColumns = visibleColumns.filter(column => column.visible !== false);
  
  return (
    <Card
      className="pro-table-card"
      title={title}
      extra={
        <Space>
          {toolbar}
          <Tooltip title="刷新">
            <Button 
              icon={<ReloadOutlined />} 
              onClick={onRefresh}
            />
          </Tooltip>
          <Tooltip title="列设置">
            <Dropdown overlay={columnSettingMenu} trigger={['click']}>
              <Button icon={<SettingOutlined />} />
            </Dropdown>
          </Tooltip>
          <Tooltip title={fullscreen ? '退出全屏' : '全屏'}>
            <Button 
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
              onClick={() => onFullscreen && onFullscreen(!fullscreen)}
            />
          </Tooltip>
          {extra}
        </Space>
      }
      bodyStyle={{ padding: 0 }}
    >
      <Table
        columns={filteredColumns}
        dataSource={dataSource}
        pagination={pagination}
        onChange={onChange}
        loading={loading}
        rowSelection={rowSelection}
        bordered={bordered}
        size={size}
      />
    </Card>
  );
};

ProTable.propTypes = {
  columns: PropTypes.array.isRequired,
  dataSource: PropTypes.array.isRequired,
  pagination: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
  onChange: PropTypes.func,
  loading: PropTypes.bool,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  toolbar: PropTypes.node,
  extra: PropTypes.node,
  rowSelection: PropTypes.object,
  bordered: PropTypes.bool,
  size: PropTypes.oneOf(['default', 'middle', 'small']),
  onRefresh: PropTypes.func,
  fullscreen: PropTypes.bool,
  onFullscreen: PropTypes.func,
};

ProTable.defaultProps = {
  pagination: {
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: total => `共 ${total} 条`,
    pageSize: 10,
  },
  loading: false,
  bordered: false,
  size: 'default',
  fullscreen: false,
};

export default ProTable;
