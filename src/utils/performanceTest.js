/**
 * 性能测试工具
 * 用于测试PPT导入过程中的UI响应性
 */

class PerformanceTest {
  constructor() {
    this.testResults = [];
    this.isRunning = false;
  }

  /**
   * 测试UI响应性
   * @param {string} testName - 测试名称
   * @param {Function} testFunction - 要测试的函数
   * @param {number} duration - 测试持续时间（毫秒）
   */
  async testUIResponsiveness(testName, testFunction, duration = 5000) {
    console.log(`开始UI响应性测试: ${testName}`);
    
    const startTime = Date.now();
    let frameCount = 0;
    let blockedFrames = 0;
    let maxBlockTime = 0;
    
    // 监控帧率
    const frameMonitor = setInterval(() => {
      const frameStart = Date.now();
      
      // 使用requestAnimationFrame监控帧率
      requestAnimationFrame(() => {
        const frameEnd = Date.now();
        const frameTime = frameEnd - frameStart;
        
        frameCount++;
        
        // 如果帧时间超过16.67ms（60fps），认为是阻塞
        if (frameTime > 16.67) {
          blockedFrames++;
          maxBlockTime = Math.max(maxBlockTime, frameTime);
        }
      });
    }, 16); // 每16ms检查一次（60fps）

    try {
      // 执行测试函数
      await testFunction();
      
      // 等待测试完成
      await new Promise(resolve => setTimeout(resolve, duration));
      
    } finally {
      clearInterval(frameMonitor);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const fps = Math.round((frameCount / totalTime) * 1000);
      const blockPercentage = Math.round((blockedFrames / frameCount) * 100);
      
      const result = {
        testName,
        totalTime,
        frameCount,
        blockedFrames,
        fps,
        blockPercentage,
        maxBlockTime,
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(result);
      
      console.log(`UI响应性测试结果 - ${testName}:`, {
        '总时间': `${totalTime}ms`,
        '帧数': frameCount,
        '阻塞帧数': blockedFrames,
        '平均FPS': fps,
        '阻塞百分比': `${blockPercentage}%`,
        '最大阻塞时间': `${maxBlockTime}ms`
      });
      
      return result;
    }
  }

  /**
   * 测试文件处理性能
   * @param {string} filePath - 文件路径
   * @param {number} fileSize - 文件大小
   */
  async testFileProcessingPerformance(filePath, fileSize) {
    const testName = `文件处理性能测试 - ${Math.round(fileSize / 1024 / 1024)}MB`;
    console.log(`开始${testName}`);
    
    const startTime = Date.now();
    let memoryUsage = [];
    
    // 监控内存使用
    const memoryMonitor = setInterval(() => {
      if (global.performance && global.performance.memory) {
        memoryUsage.push({
          used: global.performance.memory.usedJSHeapSize,
          total: global.performance.memory.totalJSHeapSize,
          timestamp: Date.now() - startTime
        });
      }
    }, 100);
    
    try {
      // 模拟文件处理
      const RNFS = require('react-native-fs');
      
      // 检查文件是否存在
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error('测试文件不存在');
      }
      
      // 读取文件统计信息
      const stats = await RNFS.stat(filePath);
      
      // 分块读取文件（模拟非阻塞处理）
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(stats.size / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const length = Math.min(chunkSize, stats.size - start);
        
        // 读取块
        await RNFS.read(filePath, length, start, 'base64');
        
        // 让出控制权
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
    } finally {
      clearInterval(memoryMonitor);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const result = {
        testName,
        filePath,
        fileSize,
        totalTime,
        memoryUsage,
        throughput: Math.round((fileSize / totalTime) * 1000), // bytes per second
        timestamp: new Date().toISOString()
      };
      
      this.testResults.push(result);
      
      console.log(`文件处理性能测试结果:`, {
        '文件大小': `${Math.round(fileSize / 1024 / 1024)}MB`,
        '处理时间': `${totalTime}ms`,
        '吞吐量': `${Math.round(result.throughput / 1024 / 1024)}MB/s`,
        '内存峰值': memoryUsage.length > 0 ? 
          `${Math.round(Math.max(...memoryUsage.map(m => m.used)) / 1024 / 1024)}MB` : 
          '未知'
      });
      
      return result;
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    if (this.testResults.length === 0) {
      console.log('没有测试结果可生成报告');
      return null;
    }
    
    const report = {
      summary: {
        totalTests: this.testResults.length,
        generatedAt: new Date().toISOString()
      },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };
    
    console.log('性能测试报告:', report);
    return report;
  }

  /**
   * 生成性能优化建议
   */
  generateRecommendations() {
    const recommendations = [];
    
    // 分析UI响应性测试结果
    const uiTests = this.testResults.filter(r => r.blockPercentage !== undefined);
    if (uiTests.length > 0) {
      const avgBlockPercentage = uiTests.reduce((sum, test) => sum + test.blockPercentage, 0) / uiTests.length;
      
      if (avgBlockPercentage > 20) {
        recommendations.push('UI阻塞严重，建议增加更多的异步处理和控制权让出');
      } else if (avgBlockPercentage > 10) {
        recommendations.push('UI有轻微阻塞，建议优化文件处理流程');
      } else {
        recommendations.push('UI响应性良好');
      }
    }
    
    // 分析文件处理性能
    const fileTests = this.testResults.filter(r => r.throughput !== undefined);
    if (fileTests.length > 0) {
      const avgThroughput = fileTests.reduce((sum, test) => sum + test.throughput, 0) / fileTests.length;
      const throughputMBps = avgThroughput / 1024 / 1024;
      
      if (throughputMBps < 10) {
        recommendations.push('文件处理速度较慢，建议优化I/O操作');
      } else if (throughputMBps < 50) {
        recommendations.push('文件处理速度中等，可考虑进一步优化');
      } else {
        recommendations.push('文件处理速度良好');
      }
    }
    
    return recommendations;
  }

  /**
   * 清除测试结果
   */
  clearResults() {
    this.testResults = [];
    console.log('测试结果已清除');
  }
}

// 创建单例实例
const performanceTest = new PerformanceTest();

export default performanceTest;
