export const buildFileInfo = ({ processedUri, name, stats, fileType }) => ({
  uri: processedUri,
  name: name || stats?.name || '未命名文件',
  size: stats?.size || 0,
  type: fileType,
  lastModified: stats?.mtime,
});
