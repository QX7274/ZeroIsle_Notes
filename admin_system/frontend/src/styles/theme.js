// 主题配置
const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    
    colorTextBase: 'rgba(0, 0, 0, 0.85)',
    colorBgBase: '#ffffff',
    
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
      'Noto Color Emoji'`,
    
    fontSize: 14,
    borderRadius: 4,
    
    wireframe: false,
  },
  components: {
    Layout: {
      bodyBackground: '#f0f2f5',
      headerBackground: '#001529',
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBackground: '#001529',
    },
    Menu: {
      itemHeight: 40,
      itemHoverColor: 'rgba(255, 255, 255, 0.1)',
      itemSelectedBg: '#1890ff',
    },
    Card: {
      borderRadius: 4,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    },
    Table: {
      headerBg: '#fafafa',
      borderColor: '#f0f0f0',
      rowHoverBg: '#f5f5f5',
    },
    Button: {
      borderRadius: 4,
      primaryShadow: '0 2px 0 rgba(24, 144, 255, 0.1)',
    },
    Input: {
      borderRadius: 4,
    },
    Select: {
      borderRadius: 4,
    },
  },
};

export default theme;
