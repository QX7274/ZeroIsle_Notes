import RNFS from 'react-native-fs';

/**
 * RNFS测试工具
 * 用于测试和验证RNFS文件读取方法
 */
class RNFSTest {
  constructor() {
    this.testResults = [];
  }

  /**
   * 测试RNFS方法可用性
   */
  async testRNFSAvailability() {
    console.log('=== RNFS方法可用性测试 ===');
    
    const methods = [
      'readFile',
      'read',
      'exists',
      'stat',
      'copyFile'
    ];
    
    for (const method of methods) {
      const isAvailable = typeof RNFS[method] === 'function';
      console.log(`${method}: ${isAvailable ? '可用' : '不可用'}`);
      
      this.testResults.push({
        test: `RNFS.${method}`,
        status: isAvailable ? 'PASS' : 'FAIL',
        details: { available: isAvailable }
      });
    }
  }

  /**
   * 测试RNFS.read方法
   */
  async testRNFSRead() {
    console.log('=== RNFS.read方法测试 ===');
    
    try {
      // 创建一个测试文件
      const testFilePath = `${RNFS.CachesDirectoryPath}/test_file.txt`;
      const testContent = 'Hello World! This is a test file for RNFS.read method.';
      
      // 写入测试文件
      await RNFS.writeFile(testFilePath, testContent, 'utf8');
      console.log('测试文件已创建:', testFilePath);
      
      // 测试RNFS.read方法
      if (typeof RNFS.read === 'function') {
        try {
          // 读取前5个字符
          const chunk = await RNFS.read(testFilePath, 5, 0, 'utf8');
          console.log('RNFS.read成功:', chunk);
          
          this.testResults.push({
            test: 'RNFS.read',
            status: 'PASS',
            details: { result: chunk }
          });
        } catch (readError) {
          console.error('RNFS.read失败:', readError.message);
          this.testResults.push({
            test: 'RNFS.read',
            status: 'FAIL',
            error: readError.message
          });
        }
      } else {
        console.warn('RNFS.read方法不可用');
        this.testResults.push({
          test: 'RNFS.read',
          status: 'FAIL',
          error: '方法不可用'
        });
      }
      
      // 清理测试文件
      try {
        await RNFS.unlink(testFilePath);
        console.log('测试文件已清理');
      } catch (cleanupError) {
        console.warn('清理测试文件失败:', cleanupError.message);
      }
      
    } catch (error) {
      console.error('RNFS.read测试失败:', error);
      this.testResults.push({
        test: 'RNFS.read',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  /**
   * 测试RNFS.readFile方法
   */
  async testRNFSReadFile() {
    console.log('=== RNFS.readFile方法测试 ===');
    
    try {
      // 创建一个测试文件
      const testFilePath = `${RNFS.CachesDirectoryPath}/test_file_readfile.txt`;
      const testContent = 'Hello World! This is a test file for RNFS.readFile method.';
      
      // 写入测试文件
      await RNFS.writeFile(testFilePath, testContent, 'utf8');
      console.log('测试文件已创建:', testFilePath);
      
      // 测试RNFS.readFile方法
      const content = await RNFS.readFile(testFilePath, 'utf8');
      console.log('RNFS.readFile成功:', content);
      
      this.testResults.push({
        test: 'RNFS.readFile',
        status: 'PASS',
        details: { result: content }
      });
      
      // 清理测试文件
      try {
        await RNFS.unlink(testFilePath);
        console.log('测试文件已清理');
      } catch (cleanupError) {
        console.warn('清理测试文件失败:', cleanupError.message);
      }
      
    } catch (error) {
      console.error('RNFS.readFile测试失败:', error);
      this.testResults.push({
        test: 'RNFS.readFile',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('开始RNFS测试...');
    
    await this.testRNFSAvailability();
    await this.testRNFSReadFile();
    await this.testRNFSRead();
    
    this.printTestSummary();
  }

  /**
   * 打印测试总结
   */
  printTestSummary() {
    console.log('\n=== RNFS测试总结 ===');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`总测试数: ${this.testResults.length}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    
    if (failed > 0) {
      console.log('\n失败的测试:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
    }
    
    console.log('\nRNFS测试完成！');
  }

  /**
   * 获取测试结果
   */
  getTestResults() {
    return this.testResults;
  }
}

export default new RNFSTest();
