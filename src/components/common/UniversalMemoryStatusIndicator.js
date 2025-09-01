import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import universalMemoryAllocator from '../../utils/universalMemoryAllocator';

/**
 * 通用内存状态指示器
 * 显示通用内存分配器的状态和内存使用情况
 */
const UniversalMemoryStatusIndicator = ({ style }) => {
  const [memoryStatus, setMemoryStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // 定期更新内存状态
    const updateMemoryStatus = () => {
      const status = universalMemoryAllocator.getMemoryStatus();
      setMemoryStatus(status);
    };

    updateMemoryStatus();
    const interval = setInterval(updateMemoryStatus, 2000); // 每2秒更新一次

    return () => clearInterval(interval);
  }, []);

  const handleMemoryWarning = () => {
    universalMemoryAllocator.showMemoryWarning();
  };

  const handleCleanupMemory = async () => {
    Alert.alert(
      '清理内存',
      '确定要清理所有分配的内存吗？这可能会影响当前的处理任务。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await universalMemoryAllocator.cleanupAllMemory();
              const status = universalMemoryAllocator.getMemoryStatus();
              setMemoryStatus(status);
            } catch (error) {
              console.error('内存清理失败:', error);
            }
          }
        }
      ]
    );
  };

  const handleShowSupportedTypes = () => {
    const supportedTypes = universalMemoryAllocator.getSupportedFileTypes();
    const typeGroups = {
      '文档类型': ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'],
      '图片类型': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
      '视频类型': ['mp4', 'avi', 'mov', 'mkv'],
      '音频类型': ['mp3', 'wav', 'm4a', 'ogg'],
      '文本类型': ['txt', 'md', 'json', 'xml'],
      '代码类型': ['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css']
    };

    let message = '支持的文件类型:\n\n';
    Object.entries(typeGroups).forEach(([group, types]) => {
      const supportedInGroup = types.filter(type => supportedTypes.includes(type));
      if (supportedInGroup.length > 0) {
        message += `${group}: ${supportedInGroup.join(', ')}\n`;
      }
    });

    Alert.alert('支持的文件类型', message, [{ text: '确定', style: 'default' }]);
  };

  if (!memoryStatus) {
    return null;
  }

  const { totalAllocatedGB, maxMemoryGB, availableGB, allocatedChunks } = memoryStatus;
  const usagePercentage = (totalAllocatedGB / maxMemoryGB) * 100;

  // 根据内存使用情况决定颜色
  let statusColor = '#4CAF50'; // 绿色 - 正常
  let statusIcon = 'checkmark-circle';
  
  if (usagePercentage > 80) {
    statusColor = '#FF5722'; // 红色 - 危险
    statusIcon = 'warning';
  } else if (usagePercentage > 60) {
    statusColor = '#FF9800'; // 橙色 - 警告
    statusIcon = 'alert-circle';
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.statusBar}
        onPress={() => setIsExpanded(!isExpanded)}
        onLongPress={handleMemoryWarning}
      >
        <Icon name={statusIcon} size={16} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          通用内存: {totalAllocatedGB.toFixed(1)}GB / {maxMemoryGB}GB
        </Text>
        <Icon 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color="#666" 
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>已分配内存:</Text>
            <Text style={styles.detailValue}>{totalAllocatedGB.toFixed(2)}GB</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>可用内存:</Text>
            <Text style={styles.detailValue}>{availableGB.toFixed(2)}GB</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>内存块:</Text>
            <Text style={styles.detailValue}>{allocatedChunks}</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${usagePercentage}%`,
                    backgroundColor: statusColor
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{usagePercentage.toFixed(1)}%</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: statusColor }]}
              onPress={handleCleanupMemory}
            >
              <Icon name="trash-outline" size={14} color="white" />
              <Text style={styles.actionButtonText}>清理内存</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
              onPress={handleShowSupportedTypes}
            >
              <Icon name="document-outline" size={14} color="white" />
              <Text style={styles.actionButtonText}>支持类型</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 8,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#666',
    minWidth: 30,
    textAlign: 'right',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default UniversalMemoryStatusIndicator;

