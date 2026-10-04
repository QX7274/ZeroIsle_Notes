/**
 * 导航死链守护：侧边栏菜单里的每个路径都必须有对应路由。
 *
 * 锁定的真实缺陷：
 *   侧边栏"用户列表"指向 /users/list、"笔记列表"指向 /notes/list，
 *   但 UserManagement/NoteManagement 当时只注册了 path="/"（即 /users、/notes），
 *   点击这两个菜单项会落到 NotFound —— 属于用户可见的功能缺失，
 *   而构建、lint、后端测试都不会发现它。
 *
 * 做法：静态解析菜单 key 与各 index.js 的 Route path，
 * 拼成完整路径后比对。不依赖运行时渲染，因此可在 CI 直接跑。
 *
 * 实现注意：本文件刻意用 RegExp 构造函数而不是正则字面量，
 * 因为需要匹配 path="..." 这类文本时，正则字面量里的斜杠序列
 * 会与注释终止符冲突，导致 Babel 解析失败（已踩过）。
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, "..", "..", "src");
const LAYOUT = path.join(SRC, "components", "Layout", "AdminLayout.js");

/** 顶层路由前缀 -> 其 index.js 文件 */
const NESTED = {
  "/users": path.join(SRC, "pages", "UserManagement", "index.js"),
  "/notes": path.join(SRC, "pages", "NoteManagement", "index.js"),
  "/logs": path.join(SRC, "pages", "LogManagement", "index.js"),
  "/analytics": path.join(SRC, "pages", "Analytics", "index.js"),
  "/settings": path.join(SRC, "pages", "SystemSettings", "index.js"),
};

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/** 从菜单里取出所有形如 key: "xxx" 的路径 */
function menuKeys() {
  const src = read(LAYOUT);
  const keys = new Set();
  const re = new RegExp("key:\\s*[\"'](/[^\"']*)[\"']", "g");
  let m;
  while ((m = re.exec(src))) keys.add(m[1]);
  return keys;
}

/** 收集顶层与嵌套路由，拼成完整路径集合 */
function allRoutes() {
  const routes = new Set();

  // 顶层路由：App.js 中的 path="..."
  const app = read(path.join(SRC, "App.js"));
  const topRe = new RegExp("path=\"([^\"]+)\"", "g");
  let m;
  while ((m = topRe.exec(app))) {
    let p = m[1];
    if (p === "/") continue;
    if (p.endsWith("/*")) p = p.slice(0, -2);
    routes.add(p);
  }

  // 嵌套路由：prefix + 子 path
  for (const [prefix, file] of Object.entries(NESTED)) {
    if (!fs.existsSync(file)) continue;
    const src = read(file);
    const re = new RegExp("path=\"([^\"]+)\"", "g");
    let mm;
    while ((mm = re.exec(src))) {
      const sub = mm[1];
      if (sub.indexOf("/detail/") === 0 || sub.indexOf("/edit/") === 0) {
        continue; // 带参数的详情页，菜单不会直接指向
      }
      const full = sub === "/" ? prefix : prefix + sub;
      routes.add(full);
    }
  }
  return routes;
}

describe("侧边栏菜单与路由一致性", () => {
  const keys = menuKeys();
  const routes = allRoutes();

  test("确实解析到了菜单项与路由（前提检查，避免断言空转）", () => {
    expect(keys.size).toBeGreaterThanOrEqual(15);
    expect(routes.size).toBeGreaterThanOrEqual(15);
  });

  test("每个菜单路径都有对应路由（不允许死链）", () => {
    const dead = [...keys].filter((k) => !routes.has(k));
    expect(dead).toEqual([]);
  });
});
