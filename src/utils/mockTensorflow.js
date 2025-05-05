/**
 * TensorFlow.js 模拟模块
 * 提供不依赖 TensorFlow.js 的模拟功能
 */

// 模拟 TensorFlow.js 的 tensor 类
class MockTensor {
  constructor(values, shape) {
    this.values = values;
    this.shape = shape;
  }

  // 模拟 dispose 方法
  dispose() {
    // 不需要实际释放内存
    return true;
  }

  // 模拟 dataSync 方法
  dataSync() {
    return this.values;
  }

  // 模拟 expandDims 方法
  expandDims(axis) {
    return this;
  }

  // 模拟 div 方法
  div(scalar) {
    return this;
  }
}

// 模拟 TensorFlow.js 的 API
export const tf = {
  // 模拟 tensor 方法
  tensor: (values, shape) => new MockTensor(values, shape),
  
  // 模拟 tensor2d 方法
  tensor2d: (values, shape) => new MockTensor(values, shape),
  
  // 模拟 randomNormal 方法
  randomNormal: (shape) => {
    // 创建随机值数组
    const size = shape.reduce((a, b) => a * b, 1);
    const values = Array.from({ length: size }, () => Math.random());
    return new MockTensor(values, shape);
  },
  
  // 模拟 ready 方法
  ready: async () => true,
  
  // 模拟 setBackend 方法
  setBackend: async (backend) => true,
  
  // 模拟 getBackend 方法
  getBackend: () => 'cpu',
  
  // 模拟 image 模块
  image: {
    resizeBilinear: (tensor, shape) => tensor,
  },
};

// 初始化函数
export const initTensorFlow = async () => {
  console.log('模拟 TensorFlow.js 初始化');
  return true;
};

// 导出默认对象
export default {
  tf,
  initTensorFlow,
};
