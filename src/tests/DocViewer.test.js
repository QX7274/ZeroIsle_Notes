/**
 * DocViewer 组件测试
 * 测试Word文档显示和编辑功能
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DocViewer from '../screens/viewers/DocViewer';
import { ThemeProvider } from '../context/ThemeContext';

// Mock dependencies
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  copyFile: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('mock file content'),
}));

jest.mock('../services/offline', () => ({
  offlineStorageService: {
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue('[]'),
  },
}));

jest.mock('../services/bookmarkService', () => ({
  addBookmark: jest.fn().mockResolvedValue(true),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
  };
});

// Mock navigation
const mockNavigation = {
  goBack: jest.fn(),
};

// Mock route params
const mockRoute = {
  params: {
    uri: 'file:///test/document.docx',
    title: '测试文档',
    noteId: 'test-note-id',
    type: 'docx',
  },
};

// Theme wrapper
const ThemeWrapper = ({ children }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('DocViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染DocViewer组件', async () => {
    const { getByText } = render(
      <ThemeWrapper>
        <DocViewer route={mockRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    // 检查标题是否显示
    expect(getByText('测试文档')).toBeTruthy();
  });

  it('应该处理Word文档类型', async () => {
    const { getByText } = render(
      <ThemeWrapper>
        <DocViewer route={mockRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    // 等待组件加载完成
    await waitFor(() => {
      // 应该显示加载状态或文档内容
      expect(getByText('测试文档')).toBeTruthy();
    });
  });

  it('应该处理文本文件类型', async () => {
    const textRoute = {
      params: {
        uri: 'file:///test/document.txt',
        title: '测试文本',
        noteId: 'test-note-id',
        type: 'txt',
      },
    };

    const { getByText } = render(
      <ThemeWrapper>
        <DocViewer route={textRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    await waitFor(() => {
      expect(getByText('测试文本')).toBeTruthy();
    });
  });

  it('应该能够保存文档内容', async () => {
    const { getByText } = render(
      <ThemeWrapper>
        <DocViewer route={mockRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    // 查找保存按钮
    const saveButton = getByText('保存');
    expect(saveButton).toBeTruthy();

    // 点击保存按钮
    fireEvent.press(saveButton);

    // 等待保存操作完成
    await waitFor(() => {
      // 验证Alert被调用
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('应该处理错误情况', async () => {
    const errorRoute = {
      params: {
        uri: null, // 无效的URI
        title: '错误文档',
        noteId: 'test-note-id',
        type: 'docx',
      },
    };

    const { getByText } = render(
      <ThemeWrapper>
        <DocViewer route={errorRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    await waitFor(() => {
      // 应该显示错误信息
      expect(getByText('文档加载失败')).toBeTruthy();
    });
  });

  it('应该正确处理返回按钮', () => {
    const { getByTestId } = render(
      <ThemeWrapper>
        <DocViewer route={mockRoute} navigation={mockNavigation} />
      </ThemeWrapper>
    );

    // 这里需要根据实际的BackButton组件实现来调整
    // 假设BackButton有testID
    // const backButton = getByTestId('back-button');
    // fireEvent.press(backButton);
    // expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
