/**
 * Web Workers索引
 */
// 导出Worker路径
export const IMAGE_PROCESSOR_WORKER = './imageProcessor.js';

// 创建Worker的辅助函数
export function createWorker(workerPath) {
  try {
    return new Worker(workerPath);
  } catch (error) {
    console.error('Failed to create worker:', error);
    return null;
  }
}

export default {
  IMAGE_PROCESSOR_WORKER,
  createWorker,
};
