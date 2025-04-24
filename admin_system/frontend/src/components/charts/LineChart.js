import React from 'react';
import ReactECharts from 'echarts-for-react';
import PropTypes from 'prop-types';

/**
 * 折线图组件
 * @param {Array} data - 图表数据
 * @param {Array} xAxis - X轴数据
 * @param {string} title - 图表标题
 * @param {string} subTitle - 图表副标题
 * @param {boolean} smooth - 是否平滑曲线
 * @param {boolean} area - 是否显示面积
 * @param {Array} colors - 线条颜色
 * @param {object} grid - 图表网格配置
 * @param {boolean} loading - 是否加载中
 * @param {string} height - 图表高度
 * @param {function} onClick - 点击事件回调
 */
const LineChart = ({ 
  data, 
  xAxis, 
  title, 
  subTitle, 
  smooth, 
  area, 
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
        type: 'line',
        data: item.data || item,
        smooth: smooth,
        areaStyle: area ? {} : null,
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: colors && colors[index] ? colors[index] : undefined,
        },
      }))
    : [{
        name: '数据',
        type: 'line',
        data: data,
        smooth: smooth,
        areaStyle: area ? {} : null,
        lineStyle: {
          width: 2,
        },
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
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
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
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxis,
      axisLine: {
        lineStyle: {
          color: '#ddd',
        },
      },
      axisLabel: {
        color: '#666',
      },
    },
    yAxis: {
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

LineChart.propTypes = {
  data: PropTypes.array.isRequired,
  xAxis: PropTypes.array.isRequired,
  title: PropTypes.string,
  subTitle: PropTypes.string,
  smooth: PropTypes.bool,
  area: PropTypes.bool,
  colors: PropTypes.array,
  grid: PropTypes.object,
  loading: PropTypes.bool,
  height: PropTypes.string,
  onClick: PropTypes.func,
};

LineChart.defaultProps = {
  smooth: true,
  area: false,
  loading: false,
  height: '350px',
  grid: {},
};

export default LineChart;
