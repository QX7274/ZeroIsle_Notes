#!/usr/bin/env node
/**
 * 跨平台 Android 取证脚本（macOS / Linux / Windows 模拟器或真机）。
 *
 * 与 scripts/android/capture_android_round.py 的区别：
 * - 不依赖 .local/android-mcp-server 与 AdbDeviceManager
 * - 直接调用 adb，产出 UI XML + PNG，并可按键名（testID）点击
 *
 * 用法：
 *   node scripts/android/capture_emulator_round.js --round round66_reminder_add
 *   node scripts/android/capture_emulator_round.js --round round66_step1 --tap testID:action.reminder.add
 *   node scripts/android/capture_emulator_round.js --round round66_step2 --assert state.reminder.actionBar,action.reminder.create
 *
 * 选项：
 *   --serial <id>      目标设备（默认取 adb devices 中第一台 device）
 *   --round <name>     证据文件名前缀（必填）
 *   --outdir <dir>     证据目录（默认 .local/android-evidence）
 *   --tap <target>     点击目标：testID:<id> | text:<文本> | x,y
 *   --assert <ids>     逗号分隔的 testID 列表，缺失时退出码为 2
 *   --wait <ms>        采集前等待时间（默认 1200）
 *   --no-screenshot    只采集 UI XML
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
  const args = { outdir: '.local/android-evidence', wait: 1200, screenshot: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) { continue; }
    const key = token.slice(2);
    if (key === 'no-screenshot') { args.screenshot = false; continue; }
    const value = argv[i + 1];
    args[key] = value;
    i += 1;
  }
  return args;
}

function resolveAdb() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const candidate = sdkRoot && path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (candidate && fs.existsSync(candidate)) { return candidate; }
  return 'adb';
}

const ADB = resolveAdb();

function adb(serial, ...rest) {
  const prefix = serial ? ['-s', serial] : [];
  return execFileSync(ADB, [...prefix, ...rest], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function listDevices() {
  const output = execFileSync(ADB, ['devices'], { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.endsWith('\tdevice'))
    .map(line => line.split('\t')[0]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureUiXml(serial) {
  const remote = '/sdcard/zeroisle_ui_dump.xml';
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      adb(serial, 'shell', 'rm', '-f', remote);
      // 页面切换/动画期间 uiautomator 可能拿不到 idle 状态而不产出文件，这里重试。
      adb(serial, 'shell', 'uiautomator', 'dump', remote);
      const xml = adb(serial, 'shell', 'cat', remote);
      if (xml && xml.includes('<hierarchy')) {
        return xml;
      }
      lastError = new Error('uiautomator dump 未产出有效 XML');
    } catch (error) {
      lastError = error;
    }
    await sleep(1500);
  }
  throw lastError || new Error('uiautomator dump 失败');
}

function captureScreenshot(serial, targetPath) {
  const buffer = execFileSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(targetPath, buffer);
  return buffer.length;
}

function parseNodes(xml) {
  const nodes = [];
  const nodePattern = /<node\b([^>]*)\/?>/g;
  let match = nodePattern.exec(xml);
  while (match) {
    const attrs = match[1];
    const read = name => {
      const attrMatch = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return attrMatch ? attrMatch[1] : '';
    };
    const bounds = read('bounds');
    const boundsMatch = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    nodes.push({
      resourceId: read('resource-id'),
      text: read('text'),
      contentDesc: read('content-desc'),
      bounds,
      center: boundsMatch
        ? {
          x: Math.round((Number(boundsMatch[1]) + Number(boundsMatch[3])) / 2),
          y: Math.round((Number(boundsMatch[2]) + Number(boundsMatch[4])) / 2),
        }
        : null,
    });
    match = nodePattern.exec(xml);
  }
  return nodes;
}

function findNode(nodes, target) {
  if (target.startsWith('testID:')) {
    const id = target.slice('testID:'.length);
    return nodes.find(node => node.resourceId === id || node.resourceId.endsWith(`:id/${id}`));
  }
  if (target.startsWith('text:')) {
    const text = target.slice('text:'.length);
    return nodes.find(node => node.text === text) || nodes.find(node => node.text.includes(text));
  }
  const [x, y] = target.split(',').map(Number);
  return { center: { x, y } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.round) {
    console.error('缺少 --round');
    process.exit(1);
  }

  const devices = listDevices();
  const serial = args.serial || devices[0];
  if (!serial) {
    console.error('未发现在线设备（adb devices 为空）');
    process.exit(1);
  }

  if (args.wait) { await sleep(Number(args.wait)); }

  let xml = await captureUiXml(serial);
  let nodes = parseNodes(xml);

  if (args.tap) {
    const target = findNode(nodes, args.tap);
    if (!target || !target.center) {
      console.error(`点击目标未命中: ${args.tap}`);
      process.exit(2);
    }
    adb(serial, 'shell', 'input', 'tap', String(target.center.x), String(target.center.y));
    console.log(`tap ${args.tap} -> ${target.center.x},${target.center.y}`);
    await sleep(Number(args.wait));
    xml = await captureUiXml(serial);
    nodes = parseNodes(xml);
  }

  const outdir = path.resolve(args.outdir || '.local/android-evidence');
  fs.mkdirSync(outdir, { recursive: true });
  const xmlPath = path.join(outdir, `${args.round}.xml`);
  fs.writeFileSync(xmlPath, xml, 'utf8');
  console.log(`UI XML -> ${xmlPath}`);

  if (args.screenshot !== false) {
    const pngPath = path.join(outdir, `${args.round}.png`);
    const bytes = captureScreenshot(serial, pngPath);
    console.log(`截图 -> ${pngPath} (${bytes} bytes)`);
  }

  const ids = nodes.map(node => node.resourceId).filter(Boolean);
  console.log(`设备: ${serial} (${os.platform()})`);
  console.log(`可见 testID/resource-id (${ids.length}):`);
  console.log(ids.join('\n'));

  if (args.assert) {
    const expected = String(args.assert).split(',').map(value => value.trim()).filter(Boolean);
    const missing = expected.filter(id => !ids.some(value => value === id || value.endsWith(`:id/${id}`)));
    if (missing.length > 0) {
      console.error(`缺失锚点: ${missing.join(', ')}`);
      process.exit(2);
    }
    console.log(`锚点校验通过: ${expected.join(', ')}`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
