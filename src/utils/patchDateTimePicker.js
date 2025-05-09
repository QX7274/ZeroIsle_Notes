/**
 * 修复 @react-native-community/datetimepicker 库中的问题
 * 
 * 这个文件会在应用启动时自动修复 DateTimePickerAndroid.android.js 文件中的问题
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { LogBox } from 'react-native';

// 忽略特定的警告
LogBox.ignoreLogs([
  'DateTimePickerAndroid: No picker found for mode',
  'Cannot read property \'dismiss\' of undefined',
]);

/**
 * 修复 DateTimePickerAndroid.android.js 文件中的问题
 */
export const patchDateTimePicker = async () => {
  // 只在 Android 平台上执行
  if (Platform.OS !== 'android') return;

  try {
    // 获取 DateTimePickerAndroid.android.js 文件的路径
    const filePath = `${RNFS.DocumentDirectoryPath}/../node_modules/@react-native-community/datetimepicker/src/DateTimePickerAndroid.android.js`;
    
    // 检查文件是否存在
    const fileExists = await RNFS.exists(filePath);
    if (!fileExists) {
      console.warn('DateTimePickerAndroid.android.js 文件不存在');
      return;
    }
    
    // 读取文件内容
    const fileContent = await RNFS.readFile(filePath, 'utf8');
    
    // 检查文件是否已经被修复
    if (fileContent.includes('if (!pickers[mode])')) {
      console.log('DateTimePickerAndroid.android.js 文件已经被修复');
      return;
    }
    
    // 查找需要修复的代码
    const regex = /function dismiss\([^)]*\)[^{]*{[^}]*return pickers\[mode\]\.dismiss\(\);[^}]*}/;
    const match = fileContent.match(regex);
    
    if (!match) {
      console.warn('无法找到需要修复的代码');
      return;
    }
    
    // 替换代码
    const fixedContent = fileContent.replace(
      regex,
      `function dismiss(
  mode,
  design = 'default',
) {
  const pickers = design === 'material' ? materialPickers : defaultPickers;
  // 检查 pickers[mode] 是否存在，如果不存在则返回一个已解决的 Promise
  if (!pickers[mode]) {
    console.warn(\`DateTimePickerAndroid: No picker found for mode \${mode}\`);
    return Promise.resolve(true);
  }
  // $FlowFixMe - \`AbstractComponent\` [1] is not an instance type.
  return pickers[mode].dismiss();
}`
    );
    
    // 写入修复后的内容
    await RNFS.writeFile(filePath, fixedContent, 'utf8');
    
    console.log('DateTimePickerAndroid.android.js 文件已成功修复');
  } catch (error) {
    console.error('修复 DateTimePickerAndroid.android.js 文件时出错:', error);
  }
};
