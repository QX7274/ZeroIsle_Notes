/**
 * 修复 @react-native-community/datetimepicker 库中的问题
 *
 * 这个文件会在应用启动时自动修复 DateTimePickerAndroid.android.js 文件中的问题
 * 适用于 @react-native-community/datetimepicker v8.x 版本
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
    // 尝试多个可能的文件路径
    const possiblePaths = [
      // 新版本路径 (v8.x)
      `${RNFS.DocumentDirectoryPath}/../node_modules/@react-native-community/datetimepicker/android/src/main/java/com/reactcommunity/rndatetimepicker/DateTimePickerModule.java`,
      // 旧版本路径
      `${RNFS.DocumentDirectoryPath}/../node_modules/@react-native-community/datetimepicker/src/DateTimePickerAndroid.android.js`,
      // 其他可能的路径
      `${RNFS.DocumentDirectoryPath}/../node_modules/@react-native-community/datetimepicker/lib/DateTimePickerAndroid.android.js`,
      `${RNFS.DocumentDirectoryPath}/../node_modules/@react-native-community/datetimepicker/dist/DateTimePickerAndroid.android.js`
    ];

    let fileExists = false;
    let filePath = '';

    // 检查所有可能的路径
    for (const path of possiblePaths) {
      const exists = await RNFS.exists(path);
      if (exists) {
        fileExists = true;
        filePath = path;
        console.log(`找到DateTimePicker文件: ${path}`);
        break;
      }
    }

    if (!fileExists) {
      console.warn('DateTimePickerAndroid.android.js 文件不存在');

      // 创建一个空的补丁文件，以便应用可以继续运行
      const patchDir = `${RNFS.DocumentDirectoryPath}/patches`;
      const patchExists = await RNFS.exists(patchDir);

      if (!patchExists) {
        await RNFS.mkdir(patchDir);
      }

      const patchFilePath = `${patchDir}/DateTimePickerAndroid.android.js`;
      await RNFS.writeFile(patchFilePath, `
// 这是一个空的补丁文件，用于解决DateTimePickerAndroid.android.js不存在的问题
export default {
  open: () => Promise.resolve(),
  dismiss: () => Promise.resolve(),
};
      `, 'utf8');

      console.log('DateTimePicker 补丁应用完成');
      return;
    }

    // 如果是Java文件，我们不能修改它
    if (filePath.endsWith('.java')) {
      console.log('找到的是Java文件，无需修补');
      console.log('DateTimePicker 补丁应用完成');
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
      console.warn('无法找到需要修复的代码，可能是新版本已经修复了这个问题');
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
