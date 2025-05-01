// 主题配置
const theme = {
  token: {
    // 主色调 - 使用零屿笔记的品牌色
    colorPrimary: '#4361EE', // 现代蓝色作为主色调
    colorSuccess: '#4CC9F0', // 更新为更现代的蓝绿色
    colorWarning: '#FF9F1C', // 更新为更鲜艳的橙色
    colorError: '#F72585',   // 鲜艳的粉红色作为错误色
    colorInfo: '#4895EF',    // 浅蓝色作为信息色

    // 文本和背景
    colorTextBase: 'rgba(0, 0, 0, 0.85)',
    colorBgBase: '#FFFFFF',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)', // 次要文本颜色
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',  // 第三级文本颜色
    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)', // 第四级文本颜色

    // 字体设置
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      'Noto Sans SC', 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
      'Noto Color Emoji'`,

    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,

    // 圆角设置
    borderRadius: 10, // 增加圆角，使界面更现代
    borderRadiusSM: 6,
    borderRadiusLG: 16,
    borderRadiusXL: 24,

    // 其他全局设置
    wireframe: false,

    // 阴影设置 - 增强阴影效果，提升层次感
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 15px 40px 0 rgba(0, 0, 0, 0.06), 0 20px 60px 20px rgba(0, 0, 0, 0.04)',
    boxShadowSecondary: '0 6px 16px -3px rgba(0, 0, 0, 0.05), 0 8px 24px 0 rgba(0, 0, 0, 0.04)',

    // 过渡效果
    motion: true,
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',

    // 链接颜色
    colorLink: '#4361EE',
    colorLinkHover: '#738AFF',
    colorLinkActive: '#3A0CA3',

    // 边框颜色
    colorBorder: '#E2E8F0',
    colorBorderSecondary: '#F0F5FF',

    // 背景色
    colorBgLayout: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgSpotlight: '#FAFAFA',
  },
  components: {
    Layout: {
      bodyBackground: '#F5F7FA', // 柔和的背景色
      headerBackground: '#FFFFFF',
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBackground: '#FFFFFF', // 侧边栏使用白色背景
      lightSiderBg: '#FFFFFF',
      headerColor: 'rgba(0, 0, 0, 0.85)',
      headerShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', // 增强阴影效果
      lightSiderWidth: 260, // 增加侧边栏宽度
      siderCollapsedWidth: 80, // 折叠时的宽度
    },
    Menu: {
      itemHeight: 50, // 增加菜单项高度，提升可点击区域
      itemHoverColor: 'rgba(67, 97, 238, 0.08)', // 主色调的透明版本
      itemSelectedBg: '#F0F5FF', // 浅蓝色背景
      itemSelectedColor: '#4361EE', // 选中项文字颜色
      itemActiveBg: '#F0F5FF', // 激活项背景色
      horizontalItemSelectedColor: '#4361EE', // 水平菜单选中项颜色
      horizontalItemHoverColor: 'rgba(67, 97, 238, 0.08)', // 水平菜单悬停颜色
      fontSize: 15, // 菜单字体大小
      itemMarginInline: 16, // 增加菜单项内边距
      itemMarginBlock: 8, // 增加菜单项垂直间距
      itemBorderRadius: 10, // 菜单项圆角
      iconSize: 18, // 图标大小
      iconMarginInlineEnd: 16, // 图标右侧间距
      collapsedIconSize: 22, // 折叠时图标大小
      darkItemColor: 'rgba(255, 255, 255, 0.85)', // 暗色主题文字颜色
      darkItemHoverColor: '#fff', // 暗色主题悬停颜色
      darkItemSelectedBg: 'rgba(67, 97, 238, 0.2)', // 暗色主题选中背景
      darkItemSelectedColor: '#fff', // 暗色主题选中颜色
    },
    Card: {
      borderRadius: 16, // 增加卡片圆角，更现代化
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.05), 0 10px 30px rgba(0, 0, 0, 0.03)', // 更柔和的阴影
      headerBg: '#FFFFFF', // 卡片头部背景色
      headerFontSize: 18, // 增加卡片头部字体大小
      headerFontWeight: 600, // 增加卡片头部字体粗细，提高可读性
      headerPadding: '24px 28px', // 增加卡片头部内边距
      bodyPadding: '28px', // 增加卡片内容内边距
      colorBorderSecondary: '#F0F5FF', // 更新卡片边框颜色
      actionsBg: '#FAFAFA', // 卡片操作区背景色
      actionsLiMarginInline: 16, // 操作项间距
      tabsMarginBottom: 24, // 卡片内标签页底部间距
      metaMarginBottom: 16, // 元数据底部间距
      metaAvatarSize: 40, // 头像大小
      metaTitleFontSize: 16, // 标题字体大小
      colorMetaTitle: 'rgba(0, 0, 0, 0.85)', // 标题颜色
      colorMetaDescription: 'rgba(0, 0, 0, 0.45)', // 描述文字颜色
    },
    Table: {
      headerBg: '#FAFAFA',
      borderColor: '#F0F0F0',
      rowHoverBg: '#F5F7FA', // 更新为更柔和的悬停背景色
      headerColor: 'rgba(0, 0, 0, 0.85)', // 表头文字颜色
      headerFontWeight: 600, // 增加表头字体粗细
      headerFontSize: 14, // 表头字体大小
      rowSelectedBg: '#F0F5FF', // 选中行背景色
      borderRadius: 12, // 增加表格圆角
      fontSize: 14, // 表格内容字体大小
    },
    Button: {
      borderRadius: 10, // 增加按钮圆角
      primaryShadow: '0 6px 16px rgba(67, 97, 238, 0.25)', // 增强主按钮阴影
      defaultBg: '#FFFFFF', // 默认按钮背景色
      defaultBorderColor: '#E2E8F0', // 默认按钮边框颜色
      defaultColor: 'rgba(0, 0, 0, 0.85)', // 默认按钮文字颜色
      defaultShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', // 更新默认按钮阴影
      fontWeight: 500, // 按钮字体粗细
      paddingInline: 24, // 增加按钮水平内边距
      paddingBlock: 10, // 增加按钮垂直内边距
      onlyIconSize: 18, // 仅图标按钮的图标大小
      onlyIconSizeSM: 14, // 小型仅图标按钮的图标大小
      onlyIconSizeLG: 22, // 大型仅图标按钮的图标大小
      groupBorderColor: '#E2E8F0', // 按钮组边框颜色
      linkHoverBg: 'rgba(0, 0, 0, 0.02)', // 链接按钮悬停背景色
      textHoverBg: 'rgba(0, 0, 0, 0.02)', // 文本按钮悬停背景色
      dangerColor: '#F72585', // 危险按钮文字颜色
      dangerBg: '#FFF0F6', // 危险按钮背景色
      dangerBorderColor: '#FFADD2', // 危险按钮边框颜色
      dangerShadow: '0 6px 16px rgba(247, 37, 133, 0.2)', // 危险按钮阴影
    },
    Input: {
      borderRadius: 8, // 增加输入框圆角
      hoverBorderColor: '#738AFF', // 更新输入框悬停边框颜色
      activeBorderColor: '#4361EE', // 更新输入框激活边框颜色
      addonBg: '#FAFAFA', // 输入框附加组件背景色
      paddingBlock: 10, // 增加输入框垂直内边距
      paddingInline: 16, // 增加输入框水平内边距
    },
    Select: {
      borderRadius: 8, // 增加选择框圆角
      optionSelectedBg: '#F0F5FF', // 更新选项选中背景色
      optionSelectedColor: '#4361EE', // 更新选项选中文字颜色
      optionActiveBg: '#F5F7FA', // 更新选项激活背景色
      paddingBlock: 10, // 增加选择框垂直内边距
      optionPadding: '10px 16px', // 增加选项内边距
    },
    Tabs: {
      inkBarColor: '#4361EE', // 更新标签页指示器颜色
      tabBarGutter: 32, // 增加标签页间距
      tabBarMargin: '0 0 24px 0', // 增加标签页外边距
      tabBorderRadius: 8, // 增加标签页圆角
      tabHoverColor: '#738AFF', // 更新标签页悬停颜色
      tabActiveColor: '#4361EE', // 更新标签页激活颜色
      fontSize: 15, // 增加标签页字体大小
    },
    Pagination: {
      itemSize: 36, // 增加分页项大小
      itemActiveBg: '#4361EE', // 更新分页项激活背景色
      itemActiveColor: '#FFFFFF', // 分页项激活文字颜色
      itemBorderRadius: 8, // 增加分页项圆角
    },
    Modal: {
      borderRadius: 12, // 增加模态框圆角
      headerBg: '#FFFFFF', // 模态框头部背景色
      titleFontSize: 18, // 增加模态框标题字体大小
      titleFontWeight: 600, // 增加模态框标题字体粗细
      bodyPadding: '28px', // 增加模态框内容内边距
      footerPadding: '16px 24px', // 增加模态框底部内边距
    },
    Form: {
      labelFontSize: 15, // 增加表单标签字体大小
      labelColor: 'rgba(0, 0, 0, 0.85)', // 表单标签文字颜色
      itemMarginBottom: 28, // 增加表单项底部外边距
    },
    Drawer: {
      borderRadius: 12, // 增加抽屉圆角
      headerPadding: '20px 24px', // 增加抽屉头部内边距
      bodyPadding: '28px', // 增加抽屉内容内边距
      footerPadding: '16px 24px', // 增加抽屉底部内边距
      maskBg: 'rgba(0, 0, 0, 0.45)', // 抽屉遮罩背景色
    },
    Statistic: {
      titleFontSize: 16, // 增加统计标题字体大小
      contentFontSize: 32, // 增加统计内容字体大小
      contentFontWeight: 600, // 统计内容字体粗细
      titleColor: 'rgba(0, 0, 0, 0.65)', // 标题颜色
      fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
        'Noto Sans SC', sans-serif`, // 字体设置
    },
    Badge: {
      dotSize: 8, // 徽标点大小
      textFontWeight: 600, // 徽标文字字体粗细
      statusSize: 10, // 状态徽标大小
      colorBorderLite: '#E2E8F0', // 边框颜色
      colorSuccess: '#4CC9F0', // 成功状态颜色
      colorError: '#F72585', // 错误状态颜色
      colorWarning: '#FF9F1C', // 警告状态颜色
      colorProcessing: '#4361EE', // 进行中状态颜色
    },
    Avatar: {
      borderRadius: 10, // 头像圆角
      groupOverlapping: -8, // 头像组重叠距离
      groupBorderColor: '#FFFFFF', // 头像组边框颜色
      sizeLG: 48, // 大头像尺寸
      size: 40, // 默认头像尺寸
      sizeSM: 32, // 小头像尺寸
      sizeXS: 24, // 超小头像尺寸
      textFontSize: 16, // 文字头像字体大小
      textFontSizeLG: 20, // 大文字头像字体大小
      textFontSizeSM: 14, // 小文字头像字体大小
      textFontSizeXS: 12, // 超小文字头像字体大小
    },
    Tag: {
      borderRadius: 6, // 标签圆角
      defaultBg: '#F5F7FA', // 默认标签背景色
      defaultColor: 'rgba(0, 0, 0, 0.65)', // 默认标签文字颜色
      fontWeight: 500, // 标签字体粗细
      colorSuccess: '#4CC9F0', // 成功标签颜色
      colorSuccessBg: '#E6FFFB', // 成功标签背景色
      colorSuccessBorder: '#87E8DE', // 成功标签边框颜色
      colorError: '#F72585', // 错误标签颜色
      colorErrorBg: '#FFF0F6', // 错误标签背景色
      colorErrorBorder: '#FFADD2', // 错误标签边框颜色
      colorWarning: '#FF9F1C', // 警告标签颜色
      colorWarningBg: '#FFF7E6', // 警告标签背景色
      colorWarningBorder: '#FFD591', // 警告标签边框颜色
      colorInfo: '#4895EF', // 信息标签颜色
      colorInfoBg: '#E6F7FF', // 信息标签背景色
      colorInfoBorder: '#91D5FF', // 信息标签边框颜色
    },
  },
};

export default theme;
