import React from 'react';
import ReactECharts from 'echarts-for-react';
import PropTypes from 'prop-types';

/**
 * 饼图组件
 * @param {Array} data - 图表数据
 * @param {string} title - 图表标题
 * @param {string} subTitle - 图表副标题
 * @param {boolean} donut - 是否环形图
 * @param {Array} colors - 扇区颜色
 * @param {boolean} loading - 是否加载中
 * @param {string} height - 图表高度
 * @param {function} onClick - 点击事件回调
 */
const PieChart = ({ 
  data, 
  title, 
  subTitle, 
  donut, 
  colors, 
  loading, 
  height,
  onClick
}) => {
  // 处理数据格式
  const formattedData = data.map(item => {
    if (typeof item === 'object' && item.name && (item.value !== undefined)) {
      return item;
    }
    if (Array.isArray(item) && item.length >= 2) {
      return {
        name: item[0],
        value: item[1],
      };
    }
    return {
      name: `项目${data.indexOf(item) + 1}`,
      value: item,
    };
  });
  
  // 图表配置
  const option = {
    title: {
      text: title,
      subtext: subTitle,
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      data: formattedData.map(item => item.name),
    },
    series: [
      {
        name: title || '数据',
        type: 'pie',
        radius: donut ? ['50%', '70%'] : '50%',
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '14',
            fontWeight: 'bold',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
        data: formattedData,
      },
    ],
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

PieChart.propTypes = {
  data: PropTypes.array.isRequired,
  title: PropTypes.string,
  subTitle: PropTypes.string,
  donut: PropTypes.bool,
  colors: PropTypes.array,
  loading: PropTypes.bool,
  height: PropTypes.string,
  onClick: PropTypes.func,
};

PieChart.defaultProps = {
  donut: false,
  loading: false,
  height: '350px',
};

export default PieChart;
