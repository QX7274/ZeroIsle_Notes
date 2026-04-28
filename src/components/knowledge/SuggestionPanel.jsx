import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Space, Tag, message, Tooltip } from 'antd';
import { BulbOutlined, CheckCircleOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import { suggestEdges, acceptSuggestions, ignoreSuggestions } from '../../adapters/knowledgeGraphAdapter';

/**
 * 候选边建议面板
 * props:
 * - nodeId: 目标节点ID（必填）
 * - topK: 建议数量（默认10）
 * - onAccepted: (result) => void 接受后回调
 * - onIgnored: (result) => void 忽略后回调
 */
export const SuggestionPanel = ({ nodeId, topK = 10, onAccepted, onIgnored }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchSuggestions = async () => {
    if (!nodeId) {return;}
    try {
      setLoading(true);
      const list = await suggestEdges(nodeId, topK);
      setData(list.map((item, idx) => ({ key: `${item.source}-${item.target}-${idx}`, ...item })));
      setSelectedRowKeys([]);
    } catch (e) {
      message.error(`获取候选边失败：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, topK]);

  const columns = useMemo(() => ([
    {
      title: '源节点',
      dataIndex: 'source',
      key: 'source',
      width: 220,
      ellipsis: true,
    },
    {
      title: '目标节点',
      dataIndex: 'target',
      key: 'target',
      width: 220,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t) => <Tag color="blue">{t || 'related'}</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
      render: (v) => <Tag color={v >= 0.7 ? 'green' : v >= 0.4 ? 'gold' : 'red'}>{(v * 100).toFixed(1)}%</Tag>,
    },
  ]), []);

  const expandedRowRender = (record) => {
    const evidence = record.evidence || [];
    return (
      <div>
        <div style={{ marginBottom: 8 }}>证据</div>
        {evidence.length === 0 ? (
          <div>无证据</div>
        ) : (
          <Space wrap>
            {evidence.map((ev, i) => (
              <Tooltip key={i} title={ev.detail || ''}>
                <Tag color="purple">{ev.type} · {ev.score}</Tag>
              </Tooltip>
            ))}
          </Space>
        )}
      </div>
    );
  };

  const onAccept = async () => {
    try {
      if (selectedRowKeys.length === 0) {return message.info('请先选择候选边');}
      const edges = data.filter(d => selectedRowKeys.includes(d.key)).map(d => ({
        source: d.source,
        target: d.target,
        type: d.type,
        confidence: d.confidence,
        evidence: d.evidence || [],
      }));
      setLoading(true);
      const res = await acceptSuggestions(edges);
      message.success(`已采纳 ${res.accepted} 条`);
      onAccepted?.(res);
      fetchSuggestions();
    } catch (e) {
      message.error(`采纳失败：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onIgnore = async () => {
    try {
      if (selectedRowKeys.length === 0) {return message.info('请先选择候选边');}
      const edges = data.filter(d => selectedRowKeys.includes(d.key)).map(d => ({
        source: d.source,
        target: d.target,
        type: d.type,
      }));
      setLoading(true);
      const res = await ignoreSuggestions(edges);
      message.success(`已忽略 ${res.ignored} 条`);
      onIgnored?.(res);
      fetchSuggestions();
    } catch (e) {
      message.error(`忽略失败：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={<Space><BulbOutlined /> 候选边建议</Space>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchSuggestions} loading={loading}>刷新</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={onAccept} disabled={selectedRowKeys.length === 0}>
            批量采纳
          </Button>
          <Button danger icon={<StopOutlined />} onClick={onIgnore} disabled={selectedRowKeys.length === 0}>
            批量忽略
          </Button>
        </Space>
      }
    >
      <Table
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        columns={columns}
        dataSource={data}
        loading={loading}
        size="middle"
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default SuggestionPanel;

