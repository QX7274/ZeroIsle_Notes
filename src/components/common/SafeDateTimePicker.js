import React, { useState, useEffect } from 'react';
import { Platform, LogBox } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// 忽略特定的警告
LogBox.ignoreLogs([
  'DateTimePickerAndroid: No picker found for mode',
  'Cannot read property \'dismiss\' of undefined',
]);

/**
 * 安全的日期时间选择器组件，避免使用可能导致问题的dismiss方法
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

  // 同步外部visible状态
  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  // 处理日期变化
  const handleChange = (event, selectedDate) => {
    try {
      // 首先关闭选择器
      setInternalVisible(false);
      if (onClose) {
        onClose();
      }

      // 如果有选择日期，则调用onChange回调
      if (selectedDate && onChange) {
        onChange(event, selectedDate);
      }
    } catch (error) {
      console.warn('SafeDateTimePicker handleChange error:', error);
      // 确保选择器关闭
      setInternalVisible(false);
      if (onClose) {
        onClose();
      }
    }
  };

  // 如果不可见，则不渲染任何内容
  if (!internalVisible) {
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

  // Android平台
  return (
    <DateTimePicker
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
};

export default SafeDateTimePicker;
