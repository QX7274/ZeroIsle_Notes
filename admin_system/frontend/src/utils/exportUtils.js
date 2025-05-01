/**
 * 导出数据到CSV文件
 * @param {Array} data - 要导出的数据数组
 * @param {string} fileName - 导出的文件名（不含扩展名）
 */
export const exportToExcel = (data, fileName = 'export') => {
  try {
    // 如果数据为空，直接返回
    if (!data || data.length === 0) {
      console.error('导出数据为空');
      return;
    }

    // 获取所有列名
    const headers = Object.keys(data[0]);

    // 创建CSV内容
    let csvContent = headers.join(',') + '\n';

    // 添加数据行
    data.forEach(item => {
      const row = headers.map(header => {
        // 处理值中的逗号和引号
        const value = item[header] === null || item[header] === undefined ? '' : item[header].toString();
        const escapedValue = value.replace(/"/g, '""');
        return `"${escapedValue}"`;
      });
      csvContent += row.join(',') + '\n';
    });

    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // 创建下载链接
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // 设置下载属性
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';

    // 添加到文档并触发点击
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出CSV失败:', error);
    throw error;
  }
};

/**
 * 导出数据到CSV文件
 * @param {Array} data - 要导出的数据数组
 * @param {string} fileName - 导出的文件名（不含扩展名）
 */
export const exportToCSV = (data, fileName = 'export') => {
  return exportToExcel(data, fileName);
};

/**
 * 格式化日期时间
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化模式，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};
