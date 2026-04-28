/**
 * 笔记工具栏服务
 * 提供笔记编辑器工具栏相关功能
 */

// 不再使用 logService

/**
 * 笔记工具栏服务
 */
class NoteToolbarService {
  constructor() {
    this.initialized = false;
    this.toolbarConfig = {
      // 默认工具栏配置
      defaultTools: [
        { id: 'bold', label: '粗体', icon: 'format-bold' },
        { id: 'italic', label: '斜体', icon: 'format-italic' },
        { id: 'underline', label: '下划线', icon: 'format-underlined' },
        { id: 'strikethrough', label: '删除线', icon: 'format-strikethrough' },
        { id: 'heading', label: '标题', icon: 'title' },
        { id: 'bullet-list', label: '无序列表', icon: 'format-list-bulleted' },
        { id: 'numbered-list', label: '有序列表', icon: 'format-list-numbered' },
        { id: 'checklist', label: '任务列表', icon: 'checklist' },
        { id: 'code', label: '代码', icon: 'code' },
        { id: 'quote', label: '引用', icon: 'format-quote' },
        { id: 'link', label: '链接', icon: 'link' },
        { id: 'image', label: '图片', icon: 'image' },
        { id: 'table', label: '表格', icon: 'grid-on' },
        { id: 'divider', label: '分割线', icon: 'horizontal-rule' },
      ],
      // 常用工具（显示在主工具栏）
      commonTools: ['bold', 'italic', 'bullet-list', 'numbered-list', 'image', 'code'],
      // 格式化工具
      formattingTools: ['bold', 'italic', 'underline', 'strikethrough', 'heading'],
      // 列表工具
      listTools: ['bullet-list', 'numbered-list', 'checklist'],
      // 插入工具
      insertTools: ['link', 'image', 'table', 'code', 'quote', 'divider'],
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      // 加载用户自定义工具栏配置
      await this.loadUserConfig();

      this.initialized = true;
      console.info('笔记工具栏服务初始化成功');
    } catch (error) {
      console.error('笔记工具栏服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 加载用户自定义工具栏配置
   */
  async loadUserConfig() {
    try {
      // 这里可以从存储中加载用户自定义配置
      // 暂时使用默认配置
    } catch (error) {
      console.error('加载用户工具栏配置失败', error);
      // 使用默认配置
    }
  }

  /**
   * 获取工具栏配置
   * @returns {Object} 工具栏配置
   */
  async getToolbarConfig() {
    await this.initialize();
    return this.toolbarConfig;
  }

  /**
   * 获取默认工具列表
   * @returns {Array} 默认工具列表
   */
  async getDefaultTools() {
    await this.initialize();
    return this.toolbarConfig.defaultTools;
  }

  /**
   * 获取常用工具列表
   * @returns {Array} 常用工具列表
   */
  async getCommonTools() {
    await this.initialize();
    const commonToolIds = this.toolbarConfig.commonTools;
    return this.toolbarConfig.defaultTools.filter(tool => commonToolIds.includes(tool.id));
  }

  /**
   * 获取格式化工具列表
   * @returns {Array} 格式化工具列表
   */
  async getFormattingTools() {
    await this.initialize();
    const formattingToolIds = this.toolbarConfig.formattingTools;
    return this.toolbarConfig.defaultTools.filter(tool => formattingToolIds.includes(tool.id));
  }

  /**
   * 获取列表工具列表
   * @returns {Array} 列表工具列表
   */
  async getListTools() {
    await this.initialize();
    const listToolIds = this.toolbarConfig.listTools;
    return this.toolbarConfig.defaultTools.filter(tool => listToolIds.includes(tool.id));
  }

  /**
   * 获取插入工具列表
   * @returns {Array} 插入工具列表
   */
  async getInsertTools() {
    await this.initialize();
    const insertToolIds = this.toolbarConfig.insertTools;
    return this.toolbarConfig.defaultTools.filter(tool => insertToolIds.includes(tool.id));
  }

  /**
   * 更新工具栏配置
   * @param {Object} config 新配置
   * @returns {Promise<boolean>} 是否成功
   */
  async updateToolbarConfig(config) {
    try {
      await this.initialize();

      // 合并配置
      this.toolbarConfig = {
        ...this.toolbarConfig,
        ...config,
      };

      // 保存配置
      // 这里可以添加保存到存储的逻辑

      return true;
    } catch (error) {
      console.error('更新工具栏配置失败', error);
      throw error;
    }
  }

  /**
   * 重置工具栏配置为默认值
   * @returns {Promise<boolean>} 是否成功
   */
  async resetToolbarConfig() {
    try {
      // 重置为构造函数中的默认配置
      this.toolbarConfig = {
        defaultTools: [
          { id: 'bold', label: '粗体', icon: 'format-bold' },
          { id: 'italic', label: '斜体', icon: 'format-italic' },
          { id: 'underline', label: '下划线', icon: 'format-underlined' },
          { id: 'strikethrough', label: '删除线', icon: 'format-strikethrough' },
          { id: 'heading', label: '标题', icon: 'title' },
          { id: 'bullet-list', label: '无序列表', icon: 'format-list-bulleted' },
          { id: 'numbered-list', label: '有序列表', icon: 'format-list-numbered' },
          { id: 'checklist', label: '任务列表', icon: 'checklist' },
          { id: 'code', label: '代码', icon: 'code' },
          { id: 'quote', label: '引用', icon: 'format-quote' },
          { id: 'link', label: '链接', icon: 'link' },
          { id: 'image', label: '图片', icon: 'image' },
          { id: 'table', label: '表格', icon: 'grid-on' },
          { id: 'divider', label: '分割线', icon: 'horizontal-rule' },
        ],
        commonTools: ['bold', 'italic', 'bullet-list', 'numbered-list', 'image', 'code'],
        formattingTools: ['bold', 'italic', 'underline', 'strikethrough', 'heading'],
        listTools: ['bullet-list', 'numbered-list', 'checklist'],
        insertTools: ['link', 'image', 'table', 'code', 'quote', 'divider'],
      };

      // 保存配置
      // 这里可以添加保存到存储的逻辑

      return true;
    } catch (error) {
      console.error('重置工具栏配置失败', error);
      throw error;
    }
  }

  /**
   * 获取工具操作处理函数
   * @param {string} toolId 工具ID
   * @returns {Function} 处理函数
   */
  getToolHandler(toolId) {
    // 返回工具对应的处理函数
    switch (toolId) {
      case 'bold':
        return this.handleBold;
      case 'italic':
        return this.handleItalic;
      case 'underline':
        return this.handleUnderline;
      case 'strikethrough':
        return this.handleStrikethrough;
      case 'heading':
        return this.handleHeading;
      case 'bullet-list':
        return this.handleBulletList;
      case 'numbered-list':
        return this.handleNumberedList;
      case 'checklist':
        return this.handleChecklist;
      case 'code':
        return this.handleCode;
      case 'quote':
        return this.handleQuote;
      case 'link':
        return this.handleLink;
      case 'image':
        return this.handleImage;
      case 'table':
        return this.handleTable;
      case 'divider':
        return this.handleDivider;
      default:
        return null;
    }
  }

  // 工具处理函数
  handleBold(text, selection) {
    return { before: '**', after: '**', placeholder: '粗体文本' };
  }

  handleItalic(text, selection) {
    return { before: '*', after: '*', placeholder: '斜体文本' };
  }

  handleUnderline(text, selection) {
    return { before: '<u>', after: '</u>', placeholder: '下划线文本' };
  }

  handleStrikethrough(text, selection) {
    return { before: '~~', after: '~~', placeholder: '删除线文本' };
  }

  handleHeading(text, selection, level = 2) {
    const prefix = '#'.repeat(level) + ' ';
    return { before: prefix, after: '', placeholder: '标题', newLine: true };
  }

  handleBulletList(text, selection) {
    return { before: '- ', after: '', placeholder: '列表项', newLine: true };
  }

  handleNumberedList(text, selection) {
    return { before: '1. ', after: '', placeholder: '列表项', newLine: true };
  }

  handleChecklist(text, selection) {
    return { before: '- [ ] ', after: '', placeholder: '任务项', newLine: true };
  }

  handleCode(text, selection) {
    return { before: '```\n', after: '\n```', placeholder: '代码', newLine: true };
  }

  handleQuote(text, selection) {
    return { before: '> ', after: '', placeholder: '引用文本', newLine: true };
  }

  handleLink(text, selection) {
    return { before: '[', after: '](url)', placeholder: '链接文本' };
  }

  handleImage(text, selection) {
    return { before: '![', after: '](url)', placeholder: '图片描述' };
  }

  handleTable(text, selection) {
    return {
      before: '| 标题1 | 标题2 | 标题3 |\n| --- | --- | --- |\n| 内容1 | 内容2 | 内容3 |\n',
      after: '',
      placeholder: '',
      newLine: true,
    };
  }

  handleDivider(text, selection) {
    return { before: '---\n', after: '', placeholder: '', newLine: true };
  }
}

const noteToolbarService = new NoteToolbarService();

module.exports = noteToolbarService;
module.exports.default = noteToolbarService;
module.exports.noteToolbarService = noteToolbarService;
module.exports.NoteToolbarService = NoteToolbarService;
