import React, { useState, useEffect } from 'react';
import { Platform, LogBox, View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 忽略特定的警告
LogBox.ignoreLogs([
  'DateTimePickerAndroid: No picker found for mode',
  'Cannot read property \'dismiss\' of undefined',
]);

/**
 * 安全的日期时间选择器组件，避免使用可能导致问题的dismiss方法
 * 增强版本，包含错误处理和备用UI
 *
 * @param {Object} props 组件属性
 * @param {Date} props.value 当前选择的日期
 * @param {string} props.mode 选择器模式 ('date' 或 'time')
 * @param {boolean} props.is24Hour 是否使用24小时制
 * @param {string} props.display 显示模式
 * @param {function} props.onChange 值变化时的回调函数
 * @param {Date} props.minimumDate 最小可选日期
 * @param {Date} props.maximumDate 最大可选日期
 * @param {boolean} props.visible 是否显示选择器
 * @param {function} props.onClose 关闭选择器的回调函数
 */
const SafeDateTimePicker = ({
  value,
  mode = 'date',
  is24Hour = true,
  display = Platform.OS === 'ios' ? 'spinner' : 'default',
  onChange,
  minimumDate,
  maximumDate,
  visible = false,
  onClose,
  ...rest
}) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [dateTimePickerError, setDateTimePickerError] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || new Date());

  // 同步外部visible状态
  useEffect(() => {
    try {
      setInternalVisible(visible);

      // 如果原生选择器出错，则显示备用UI
      if (visible && dateTimePickerError) {
        setFallbackVisible(true);
      }
    } catch (error) {
      console.warn('SafeDateTimePicker useEffect error:', error);
      setDateTimePickerError(true);
      if (visible) {
        setFallbackVisible(true);
      }
    }
  }, [visible, dateTimePickerError]);

  // 处理日期变化
  const handleChange = (event, selectedDate) => {
    try {
      // 首先关闭选择器，无论发生什么都要确保选择器关闭
      setInternalVisible(false);

      // 使用setTimeout确保状态更新在UI渲染之前完成
      setTimeout(() => {
        try {
          if (onClose) {
            onClose();
          }

          // 如果有选择日期，则调用onChange回调
          if (selectedDate && onChange) {
            setSelectedValue(selectedDate);
            onChange(event, selectedDate);
          }
        } catch (innerError) {
          console.warn('SafeDateTimePicker handleChange inner error:', innerError);
          // 标记为错误状态，下次将使用备用UI
          setDateTimePickerError(true);
        }
      }, 0);
    } catch (error) {
      console.warn('SafeDateTimePicker handleChange error:', error);
      // 标记为错误状态，下次将使用备用UI
      setDateTimePickerError(true);
      // 确保选择器关闭
      setInternalVisible(false);

      // 使用setTimeout确保状态更新在UI渲染之前完成
      setTimeout(() => {
        try {
          if (onClose) {
            onClose();
          }
        } catch (closeError) {
          console.warn('SafeDateTimePicker onClose error:', closeError);
        }
      }, 0);
    }
  };

  // 处理备用UI的确认按钮
  const handleFallbackConfirm = () => {
    setFallbackVisible(false);
    setDateTimePickerError(false);
    setInternalVisible(false);
    if (onChange) {
      // 创建一个模拟的事件对象
      const event = { type: 'set', nativeEvent: { timestamp: selectedValue.getTime() } };
      onChange(event, selectedValue);
    }
    if (onClose) {
      onClose();
    }
  };

  // 处理备用UI的取消按钮
  const handleFallbackCancel = () => {
    setFallbackVisible(false);
    setDateTimePickerError(false);
    setInternalVisible(false);
    if (onClose) {
      onClose();
    }
  };

  // 如果不可见，则不渲染任何内容
  if (!internalVisible && !fallbackVisible) {
    return null;
  }

  // 如果需要使用备用UI
  if (dateTimePickerError || fallbackVisible) {
    return (
      <Modal
        transparent={true}
        visible={fallbackVisible}
        onRequestClose={handleFallbackCancel}
        animationType="fade"
        testID="modal.dateTimePickerFallback"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {mode === 'date' ? '选择日期' : mode === 'time' ? '选择时间' : '选择日期和时间'}
            </Text>

            <Text style={styles.dateDisplay}>
              {format(selectedValue, mode === 'date'
                ? 'yyyy年MM月dd日'
                : mode === 'time'
                  ? 'HH:mm'
                  : 'yyyy年MM月dd日 HH:mm',
                { locale: zhCN }
              )}
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleFallbackCancel}
                testID="action.dateTimePickerFallback.cancel"
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleFallbackConfirm}
                testID="action.dateTimePickerFallback.confirm"
              >
                <Text style={styles.confirmButtonText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // 尝试使用原生选择器
  try {
    // 在Android平台上，如果之前有错误，直接使用备用UI
    if (Platform.OS === 'android' && dateTimePickerError) {
      setFallbackVisible(true);
      return null;
    }

    // 根据平台渲染不同的选择器
    if (Platform.OS === 'ios') {
      return (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          is24Hour={is24Hour}
          display={display}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          {...rest}
        />
      );
    }

    // Android平台 - 使用try-catch包装组件
    try {
      return (
        <DateTimePicker
          testID="dateTimePicker"
          value={value || new Date()}
          mode={mode}
          is24Hour={is24Hour}
          display={display}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          positiveButton={{label: '确定'}}
          negativeButton={{label: '取消'}}
          {...rest}
        />
      );
    } catch (innerError) {
      console.error('渲染Android DateTimePicker时出错:', innerError);
      // 立即切换到备用UI
      setTimeout(() => {
        setDateTimePickerError(true);
        setFallbackVisible(true);
      }, 0);
      return null;
    }
  } catch (error) {
    console.error('渲染DateTimePicker时出错:', error);
    // 标记为错误状态，下次将使用备用UI
    setDateTimePickerError(true);
    // 显示备用UI
    setFallbackVisible(true);
    return null;
  }
};

// 样式
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  dateDisplay: {
    fontSize: 24,
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
  },
});

export default SafeDateTimePicker;
