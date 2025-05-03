// 图像处理Worker
self.onmessage = async (e) => {
  const { uri } = e.data;
  
  try {
    // 获取图像数据
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // 转换为Base64
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    
    reader.onloadend = () => {
      const base64data = reader.result;
      // 移除前缀 "data:image/png;base64,"
      const imageData = base64data.split(',')[1];
      self.postMessage(imageData);
    };
    
    reader.onerror = (error) => {
      self.postMessage({ error: '图像处理失败' });
    };
  } catch (error) {
    self.postMessage({ error: error.message });
  }
}; 