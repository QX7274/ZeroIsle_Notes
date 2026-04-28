import React, { useState, useEffect } from 'react';
import { Progress, Card, Statistic, Table, Button, Space, message, Spin } from 'antd';
import { ReloadOutlined, StopOutlined, DownloadOutlined } from '@ant-design/icons';
import { getTaskStatus } from '../../adapters/knowledgeGraphAdapter';
import './BuildProgressPanel.css';

export const BuildProgressPanel = ({ taskId, onComplete }) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    // 立即获取一次状态
    fetchTaskStatus();

    // 设置定时器
    const id = setInterval(() => {
      fetchTaskStatus();
    }, 1000);

    setIntervalId(id);

    return () => {
      if (id) {clearInterval(id);}
    };
  }, [taskId]);

  const fetchTaskStatus = async () => {
    try {
      setLoading(true);
      const response = await getTaskStatus(taskId);
      setTask(response);

      // 任务完成时清除定时器
      if (response.status === 'success' || response.status === 'failed') {
        if (intervalId) {clearInterval(intervalId);}
        onComplete?.(response);
      }
    } catch (error) {
      message.error('获取任务状态失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!task) {
    return <Spin tip="加载任务信息..." />;
  }

  const stats = task.stats || {};
  const errors = task.errors || [];

  const statusColor = {
    pending: '#faad14',
    running: '#1890ff',
    success: '#52c41a',
    failed: '#f5222d',
    partial: '#faad14',
  };

  const statusText = {
    pending: '待处理',
    running: '运行中',
    success: '成功',
    failed: '失败',
    partial: '部分成功',
  };

  return (
    <div className="build-progress-panel">
      <Card
        title="构建进度"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTaskStatus}
              loading={loading}
            >
              刷新
            </Button>
            {errors.length > 0 && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => {
                  const csv = errors.map(e => `${e.line},${e.msg}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'errors.csv';
                  a.click();
                }}
              >
                下载错误
              </Button>
            )}
          </Space>
        }
      >
        {/* 进度条 */}
        <div className="progress-section">
          <Progress
            percent={task.progress}
            status={task.status === 'failed' ? 'exception' : 'active'}
            strokeColor={statusColor[task.status]}
          />
          <p className="status-text">
            状态: <span style={{ color: statusColor[task.status], fontWeight: 'bold' }}>
              {statusText[task.status]}
            </span>
          </p>
        </div>

        {/* 统计卡 */}
        <div className="statistics-grid">
          <Statistic
            title="已添加节点"
            value={stats.nodes_added || 0}
            valueStyle={{ color: '#1890ff' }}
          />
          <Statistic
            title="已添加边"
            value={stats.edges_added || 0}
            valueStyle={{ color: '#52c41a' }}
          />
          <Statistic
            title="跳过"
            value={stats.skipped || 0}
            valueStyle={{ color: '#faad14' }}
          />
          <Statistic
            title="冲突"
            value={stats.conflicts || 0}
            valueStyle={{ color: '#f5222d' }}
          />
        </div>

        {/* 错误明细 */}
        {errors.length > 0 && (
          <Card title={`错误明细 (${errors.length})`} type="inner" style={{ marginTop: 24 }}>
            <Table
              dataSource={errors}
              columns={[
                {
                  title: '行号',
                  dataIndex: 'line',
                  key: 'line',
                  width: 80,
                },
                {
                  title: '错误信息',
                  dataIndex: 'msg',
                  key: 'msg',
                  ellipsis: true,
                },
                {
                  title: '时间',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 180,
                  render: (text) => text ? new Date(text).toLocaleString() : '-',
                },
              ]}
              pagination={{ pageSize: 10 }}
              size="small"
              rowKey={(record, index) => index}
            />
          </Card>
        )}
      </Card>
    </div>
  );
};

