/**
 * 时间格式化工具函数
 */

/**
 * 格式化相对时间 - 类似朋友圈的时间显示
 * @param {string|Date} dateTime - 时间
 * @returns {string} 格式化后的时间字符串
 */
export const formatRelativeTime = (dateTime) => {
  const now = new Date();
  const date = new Date(dateTime);
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // 刚刚
  if (diffSeconds < 60) {
    return '刚刚';
  }

  // 分钟前
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  // 小时前
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  // 昨天
  if (diffDays === 1) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  // 前天
  if (diffDays === 2) {
    return `前天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  // 本周内
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekdays[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  // 本年内
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  // 跨年
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

/**
 * 格式化完整时间
 * @param {string|Date} dateTime - 时间
 * @returns {string} 格式化后的时间字符串
 */
export const formatFullTime = (dateTime) => {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 格式化日期（不含时间）
 * @param {string|Date} dateTime - 时间
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (dateTime) => {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * 格式化时间（不含日期）
 * @param {string|Date} dateTime - 时间
 * @returns {string} 格式化后的时间字符串
 */
export const formatTime = (dateTime) => {
  const date = new Date(dateTime);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
};

/**
 * 判断是否为今天
 * @param {string|Date} dateTime - 时间
 * @returns {boolean} 是否为今天
 */
export const isToday = (dateTime) => {
  const today = new Date();
  const date = new Date(dateTime);

  return today.getFullYear() === date.getFullYear() &&
         today.getMonth() === date.getMonth() &&
         today.getDate() === date.getDate();
};

/**
 * 判断是否为本周
 * @param {string|Date} dateTime - 时间
 * @returns {boolean} 是否为本周
 */
export const isThisWeek = (dateTime) => {
  const now = new Date();
  const date = new Date(dateTime);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays < 7;
};

/**
 * 获取友好的时间描述
 * @param {string|Date} dateTime - 时间
 * @returns {string} 友好的时间描述
 */
export const getFriendlyTimeDescription = (dateTime) => {
  const now = new Date();
  const date = new Date(dateTime);
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (isToday(dateTime)) {
    if (diffHours < 6) {
      return '今天早些时候';
    } else if (diffHours < 12) {
      return '今天上午';
    } else if (diffHours < 18) {
      return '今天下午';
    } else {
      return '今天晚上';
    }
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return '昨天';
  } else if (diffDays === 2) {
    return '前天';
  } else if (diffDays < 7) {
    return '本周';
  } else if (diffDays < 30) {
    return '本月';
  } else if (diffDays < 365) {
    return '今年';
  } else {
    return '很久以前';
  }
};
