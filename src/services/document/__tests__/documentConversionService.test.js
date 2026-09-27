import RNFS from 'react-native-fs';
import networkErrorService from '../../networkErrorService';
import documentConversionService from '../documentConversionService';

describe('DocumentConversionService.convertToPDFTraditional', () => {
  let uploadSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    RNFS.exists.mockResolvedValue(true);
    RNFS.stat.mockResolvedValue({ size: 1024 });
    uploadSpy = jest.spyOn(documentConversionService, 'convertViaUpload');
  });

  afterEach(() => {
    uploadSpy.mockRestore();
  });

  test('delegates supported uploads and reports completion', async () => {
    const progress = jest.fn();
    uploadSpy.mockResolvedValue({
      success: true,
      pdf_base64: 'pdf-data',
      file_info: { original_name: 'report.docx', file_type: 'docx' },
      timestamp: '2026-07-16T00:00:00.000Z',
    });

    const result = await documentConversionService.convertToPDFTraditional(
      '/tmp/report.docx',
      { onProgress: progress }
    );

    expect(uploadSpy).toHaveBeenCalledWith(
      '/tmp/report.docx',
      'report.docx',
      'docx',
      progress,
      null
    );
    expect(result).toMatchObject({
      success: true,
      pdfBase64: 'pdf-data',
      originalFile: '/tmp/report.docx',
    });
    expect(progress).toHaveBeenNthCalledWith(1, {
      stage: 'preparing',
      progress: 10,
      message: '正在准备文件...',
    });
    expect(progress).toHaveBeenLastCalledWith({
      stage: 'complete',
      progress: 100,
      message: '转换完成！',
    });
  });

  test('preserves a missing-file error and reports it to the error service', async () => {
    RNFS.exists.mockResolvedValue(false);
    const errorHandler = jest.spyOn(
      networkErrorService,
      'handleDocumentConversionError'
    ).mockImplementation(() => {});

    await expect(
      documentConversionService.convertToPDFTraditional('/tmp/missing.docx')
    ).rejects.toThrow('文件不存在: /tmp/missing.docx');

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: '文件不存在: /tmp/missing.docx' }),
      expect.objectContaining({ context: '文档转换' })
    );
    errorHandler.mockRestore();
  });
});
