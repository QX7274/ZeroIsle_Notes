import { readFileSync } from 'fs';

// 从 JS 别名表与原生 Commands 表做交叉核对：
// JS 侧 getSurfaceCommandNames 会按 [协议名, ...历史别名] 顺序找命令号，
// 只要有一个命中就能发出去。任一条协议命令在所有名字下都找不到，就是死接线。

const src = readFileSync('src/config/nativeCommandMap.js', 'utf8');
const start = src.indexOf('const LEGACY_ALIASES');
const block = src.slice(start, src.indexOf('export const TOOL_TYPES'));

const surfaces = {};
const segRe = /\[SURFACE_TYPES\.(\w+)\]:\s*\{([\s\S]*?)\n  \},?/g;
let mm;
while ((mm = segRe.exec(block))) {
  const name = mm[1];
  const body = mm[2];
  const cmds = {};
  const cre = /(\w+):\s*\[([^\]]*)\]/g;
  let c;
  while ((c = cre.exec(body))) {
    cmds[c[1]] = c[2].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  surfaces[name] = cmds;
}

function nativeCommands(path) {
  const s = readFileSync(path, 'utf8');
  const seg = s.slice(s.indexOf('constantsToExport'));
  const out = {};
  const re = /@"([A-Za-z]+)":\s*@(\d+)/g;
  let x;
  while ((x = re.exec(seg))) out[x[1]] = Number(x[2]);
  return out;
}

const paged = nativeCommands('ios/NativePagedNoteView/NativePagedNoteViewManager.m');
const infinite = nativeCommands('ios/NativeInfiniteCanvasView/NativeInfiniteCanvasViewManager.m');

function check(label, type, table) {
  const cmds = surfaces[type] || {};
  const bad = [];
  let total = 0;
  for (const [proto, aliases] of Object.entries(cmds)) {
    total++;
    const names = [...new Set([proto, ...aliases])];
    const hit = names.find((n) => table[n] !== undefined);
    if (hit === undefined) bad.push(proto + ' 试过 [' + names.join(', ') + ']');
  }
  console.log('== ' + label + ' (' + type + '): ' + total + ' 条协议命令');
  if (bad.length === 0) {
    console.log('   全部可解析到命令号 ✅');
  } else {
    bad.forEach((b) => console.log('   ✗ ' + b));
  }
  return bad.length;
}

let fail = 0;
fail += check('分页笔记', 'PAGED', paged);
fail += check('无限画布', 'INFINITE', infinite);

console.log('');
console.log(fail === 0 ? 'RESULT: PASS — JS 协议命令在原生命令表里全部可达' : 'RESULT: FAIL (' + fail + ' 条不可达)');
process.exit(fail === 0 ? 0 : 1);
