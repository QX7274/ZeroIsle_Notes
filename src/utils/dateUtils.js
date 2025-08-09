/**
 * 日期工具函数
 */

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化模板
 * @returns {string} - 格式化后的日期字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm') => {
  // 处理无效日期
  if (!date) return '未知日期';

  try {
    // 尝试创建日期对象
    let d;
    if (typeof date === 'string') {
      // 处理可能的无效日期字符串
      if (date === 'Invalid Date' || date.toLowerCase() === 'invalid date') {
        return '无效日期';
      }

      // 尝试解析日期字符串
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'object' && date.reference === 'circular') {
      // 处理循环引用
      return '未知日期';
    } else {
      // 尝试转换其他类型
      d = new Date(date);
    }

    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      return '无效日期';
    }

    // 提取日期组件
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    // 格式化日期
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  } catch (error) {
    console.warn('日期格式化失败:', error, { date });
    return '日期错误';
  }
};

/**
 * 格式化相对时间
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} - 相对时间字符串
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now - d;

  // 小于1分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // 小于1天
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // 小于7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  // 大于7天，返回具体日期
  return formatDate(date, 'YYYY-MM-DD');
};

/**
 * 获取日期范围
 * @param {string} range - 日期范围：today, week, month, year
 * @returns {Object} - 开始日期和结束日期
 */
export const getDateRange = (range) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      // 获取本周一
      const day = start.getDay() || 7; // 周日为0，转换为7
      start.setDate(start.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      // 获取本周日
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // 获取月末
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      break;
  }

  return {
    start,
    end,
  };
};

/**
 * 判断两个日期是否是同一天
 * @param {Date|string} date1 - 日期1
 * @param {Date|string} date2 - 日期2
 * @returns {boolean} - 是否是同一天
 */
export const isSameDay = (date1, date2) => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export default {
  formatDate,
  formatRelativeTime,
  getDateRange,
  isSameDay,
};
