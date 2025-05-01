import React from 'react';
import { Area } from '@ant-design/charts';
import { Spin } from 'antd';
import PropTypes from 'prop-types';

/**
 * 面积图组件
 * @param {Array} data - 数据
 * @param {Array} xAxis - X轴数据
 * @param {string} title - 图表标题
 * @param {boolean} smooth - 是否平滑曲线
 * @param {boolean} isStack - 是否堆叠
 * @param {Array} colors - 颜色数组
 * @param {boolean} loading - 是否加载中
 */
const AreaChart = ({ 
  data, 
  xAxis, 
  title, 
  smooth = false, 
  isStack = false, 
  colors = ['#1890ff'], 
  loading = false 
}) => {
  // 配置
  const config = {
    data: data.map((item) => {
      return item.data.map((value, index) => {
        return {
          name: item.name,
          value,
          date: xAxis[index],
        };
      });
    }).flat(),
    xField: 'date',
    yField: 'value',
    seriesField: 'name',
    smooth,
    color: colors,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    areaStyle: {
      fillOpacity: 0.6,
    },
    line: {
      size: 2,
    },
    point: {
      size: 4,
      shape: 'circle',
      style: {
        fill: 'white',
        stroke: colors[0],
        lineWidth: 2,
      },
    },
    tooltip: {
      showMarkers: true,
    },
    yAxis: {
      label: {
        formatter: (v) => {
          return v;
        },
      },
    },
    legend: {
      position: 'top-right',
    },
    meta: {
      value: {
        alias: '数值',
      },
      date: {
        alias: '日期',
      },
    },
  };

  // 如果是堆叠面积图
  if (isStack) {
    config.isStack = true;
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
      {title && <h4 style={{ marginBottom: 16 }}>{title}</h4>}
      <Area {...config} />
    </div>
  );
};

AreaChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      data: PropTypes.arrayOf(PropTypes.number).isRequired,
    })
  ).isRequired,
  xAxis: PropTypes.arrayOf(PropTypes.string).isRequired,
  title: PropTypes.string,
  smooth: PropTypes.bool,
  isStack: PropTypes.bool,
  colors: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool,
};

export default AreaChart;
