import React from 'react';
import ReactECharts from 'echarts-for-react';
import PropTypes from 'prop-types';

/**
 * 柱状图组件
 * @param {Array} data - 图表数据
 * @param {Array} xAxis - X轴数据
 * @param {string} title - 图表标题
 * @param {string} subTitle - 图表副标题
 * @param {boolean} horizontal - 是否水平方向
 * @param {Array} colors - 柱状颜色
 * @param {object} grid - 图表网格配置
 * @param {boolean} loading - 是否加载中
 * @param {string} height - 图表高度
 * @param {function} onClick - 点击事件回调
 */
const BarChart = ({ 
  data, 
  xAxis, 
  title, 
  subTitle, 
  horizontal, 
  colors, 
  grid, 
  loading, 
  height,
  onClick
}) => {
  // 处理数据格式
  const series = Array.isArray(data[0]) 
    ? data.map((item, index) => ({
        name: item.name || `系列${index + 1}`,
        type: 'bar',
        data: item.data || item,
        itemStyle: {
          color: colors && colors[index] ? colors[index] : undefined,
        },
        barMaxWidth: 40,
      }))
    : [{
        name: '数据',
        type: 'bar',
        data: data,
        barMaxWidth: 40,
      }];
  
  // 图表配置
  const option = {
    title: {
      text: title,
      subtext: subTitle,
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      data: series.map(item => item.name),
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: title ? '15%' : '10%',
      containLabel: true,
      ...grid,
    },
    [horizontal ? 'yAxis' : 'xAxis']: {
      type: 'category',
      data: xAxis,
      axisLine: {
        lineStyle: {
          color: '#ddd',
        },
      },
      axisLabel: {
        color: '#666',
        rotate: horizontal ? 0 : xAxis.length > 12 ? 45 : 0,
      },
    },
    [horizontal ? 'xAxis' : 'yAxis']: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#666',
      },
      splitLine: {
        lineStyle: {
          color: '#eee',
        },
      },
    },
    series: series,
    color: colors,
  };
  
  // 事件处理
  const onEvents = {
    click: onClick,
  };
  
  return (
    <ReactECharts
      option={option}
      style={{ height: height }}
      showLoading={loading}
      onEvents={onClick ? onEvents : undefined}
    />
  );
};

BarChart.propTypes = {
  data: PropTypes.array.isRequired,
  xAxis: PropTypes.array.isRequired,
  title: PropTypes.string,
  subTitle: PropTypes.string,
  horizontal: PropTypes.bool,
  colors: PropTypes.array,
  grid: PropTypes.object,
  loading: PropTypes.bool,
  height: PropTypes.string,
  onClick: PropTypes.func,
};

BarChart.defaultProps = {
  horizontal: false,
  loading: false,
  height: '350px',
  grid: {},
};

export default BarChart;
