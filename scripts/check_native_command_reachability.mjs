import { readFileSync } from 'fs';

// 从 JS 别名表与原生命令表做交叉核对：
// JS 侧 getSurfaceCommandNames 会按 [协议名, ...历史别名] 顺序找命令号，
// 只要有一个命中就能发出去。任一条协议命令在所有名字下都找不到，就是死接线。
//
// ⚠️ 关键前提（曾经把这里写错，导致「假 PASS」）：
// iOS 旧架构下，UIManager.getViewManagerConfig(name).Commands **不是** Manager 的
// constantsToExport，而是由 RN 的 RCTComponentData.commandsForViewMangerClass 从
// **RCT_EXPORT_METHOD** 列表生成的（见 React/Views/RCTComponentData.m:396-421、526）。
// 因此：
//   - iOS 侧必须解析 RCT_EXPORT_METHOD 的方法名；而 dispatchViewManagerCommand 走
//     moduleData.methods[index]，即这些方法的声明下标。
//   - Manager 里手写的 constantsToExport 中的 Commands 字典会被 RN 覆盖，**完全不生效**。
//   - receiveCommand:commandID:commandArgs: 不是 iOS 的协议（全仓只有 Android 有 receiveCommand），
//     在 iOS 上永远不会被调用。
// 本项目曾因此在 iOS 上「命令表看起来齐全、实际只有 5 条可达」。

const src = readFileSync('src/config/nativeCommandMap.js', 'utf8');
const start = src.indexOf('const LEGACY_ALIASES');
const block = src.slice(start, src.indexOf('export const TOOL_TYPES'));

const surfaces = {};
const segRe = /\[SURFACE_TYPES\.(\w+)\]\s*:\s*\{([\s\S]*?)\n  \},?/g;
let mm;
while ((mm = segRe.exec(block))) {
  const body = mm[2];
  const cmds = {};
  const cre = /(\w+):\s*\[([^\]]*)\]/g;
  let c;
  while ((c = cre.exec(body))) {
    cmds[c[1]] = c[2].split(',').map((s) => s.trim().replace(/['\"]/g, '')).filter(Boolean);
  }
  surfaces[mm[1]] = cmds;
}

/**
 * iOS：真正生效的命令名 = RCT_EXPORT_METHOD 的方法名（选择器第一段）。
 * 注意要排除 constantsToExport 里那份「看似是命令表、实为死代码」的字典。
 */
function iosNativeCommands(path) {
  const s = readFileSync(path, 'utf8');
  const out = {};
  const re = /RCT_EXPORT_METHOD\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let x;
  let idx = 0;
  while ((x = re.exec(s))) {
    out[x[1]] = idx;
    idx += 1;
  }
  return out;
}

/** Android：getCommandsMap() 里显式登记的命令号（Android 走 receiveCommand(Int)）。 */
function androidNativeCommands(path) {
  const s = readFileSync(path, 'utf8');
  const start = s.indexOf('getCommandsMap');
  const seg = s.slice(start, s.indexOf('receiveCommand', start));
  const out = {};
  const re = /\.put\("([A-Za-z]+)"\s*,\s*(\d+)\)/g;
  let x;
  while ((x = re.exec(seg))) out[x[1]] = Number(x[2]);
  return out;
}

const NATIVE_TABLES = [
  {
    label: '分页笔记',
    type: 'PAGED',
    ios: 'ios/NativePagedNoteView/NativePagedNoteViewManager.m',
    android: 'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteViewManager.java',
  },
  {
    label: '无限画布',
    type: 'INFINITE',
    ios: 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasViewManager.m',
    android: 'android/app/src/main/java/com/zeroisle_notes/nativeinfinite/NativeInfiniteCanvasViewManager.java',
  },
];

function check(label, type, table) {
  const cmds = surfaces[type] || {};
  const bad = [];
  const total = Object.keys(cmds).length;
  for (const [proto, aliases] of Object.entries(cmds)) {
    const names = [...new Set([proto, ...aliases])];
    const hit = names.find((n) => table[n] !== undefined);
    if (hit === undefined) bad.push('   ✗ ' + proto + ' 试过 [' + names.join(', ') + ']');
  }
  const okCount = total - bad.length;
  console.log('== ' + label + ' (' + type + '): ' + okCount + '/' + total + ' 条协议命令可达');
  bad.forEach((b) => console.log(b));
  return bad.length;
}

let fail = 0;
for (const surface of NATIVE_TABLES) {
  fail += check(surface.label + ' / iOS', surface.type, iosNativeCommands(surface.ios));
  fail += check(surface.label + ' / Android', surface.type, androidNativeCommands(surface.android));
}

console.log('');
console.log(fail === 0 ? 'RESULT: PASS — JS 协议命令在两端原生命中均可达' : 'RESULT: FAIL (' + fail + ' 条不可达)');
process.exit(fail === 0 ? 0 : 1);