#!/usr/bin/env node
/**
 * 校验 metro.config.js 的 blockList 是否真的能把 admin_system 等目录排除出打包。
 *
 * 为什么需要这个脚本：metro.config.js 无法在缺少 node_modules 的 worktree 里直接
 * require（它依赖 @react-native/metro-config / metro-resolver）。本脚本以只读方式
 * 解析该文件，复用其 excludedRoots 列表与 rootPattern 构造逻辑，对代表性路径断言。
 */
const fs = require("fs");
const path = require("path");

const metroSrc = fs.readFileSync(path.join(__dirname, "metro.config.js"), "utf8");
const m = metroSrc.match(/const excludedRoots = \[([\s\S]*?)\];/);
if (!m) { console.error("无法从 metro.config.js 解析 excludedRoots"); process.exit(2); }
const excludedRoots = m[1]
  .split("\n")
  .map((l) => l.trim().replace(/,$/, ""))
  .filter((l) => l && !l.startsWith("//"))
  .map((l) => l.replace(/^['"]|['"]$/g, ""))
  .filter(Boolean);

const escapeForRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const projectRootName = escapeForRegExp(path.basename(__dirname));
const rootPattern = (name) =>
  String.raw`.*[\\/]${projectRootName}[\\/]${escapeForRegExp(name)}(?:[\\/].*)?$`;
const blockList = new RegExp(excludedRoots.map(rootPattern).join("|"));

const root = __dirname;
const cases = [
  ["admin_system/frontend/src/App.js", true, "管理后台前端不得进入 App 包"],
  ["admin_system/backend/manage.py", true, "管理后台后端不得进入 App 包"],
  ["backend/notes/views/attachment.py", true, "主后端不被 Metro 扫描"],
  ["web/index.html", true, "官网不被 Metro 扫描"],
  ["docs/ARCHITECTURE.md", true, "文档不被 Metro 扫描"],
  ["src/App.js", false, "App 源码必须可被打包"],
  ["src/components/common/AllInOneToolbar.js", false, "组件必须可被打包"],
  ["node_modules/react/index.js", false, "依赖必须可被打包"],
];

let pass = 0;
const failures = [];
for (const [rel, expectBlocked, why] of cases) {
  const abs = path.join(root, rel);
  const blocked = blockList.test(abs);
  const ok = blocked === expectBlocked;
  if (ok) pass++;
  else failures.push(`${rel}: blocked=${blocked}, expected=${expectBlocked} (${why})`);
  console.log(`${ok ? "PASS" : "FAIL"}  blocked=${String(blocked).padEnd(5)} ${rel}`);
}
console.log(`\nexcludedRoots 共 ${excludedRoots.length} 项`);
console.log(`${pass}/${cases.length} 条断言通过`);
if (failures.length) { console.error("\n失败项:\n" + failures.join("\n")); process.exit(1); }
