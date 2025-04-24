// Token 相关
export const setToken = (token) => {
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const removeToken = () => {
  localStorage.removeItem('token');
};

// 用户信息相关
export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const removeUser = () => {
  localStorage.removeItem('user');
};

// 主题相关
export const setTheme = (theme) => {
  localStorage.setItem('theme', theme);
};

export const getTheme = () => {
  return localStorage.getItem('theme') || 'light';
};

// 语言相关
export const setLanguage = (language) => {
  localStorage.setItem('language', language);
};

export const getLanguage = () => {
  return localStorage.getItem('language') || 'zh-CN';
};

// 清除所有存储
export const clearAll = () => {
  localStorage.clear();
}; 