/**
 * 主题色一致性守护。
 *
 * 锁定的真实问题：品牌色在四处各不相同，且互相矛盾 ——
 *   - src/styles/theme.js   : #4361EE（antd token，组件真正跟随的颜色）
 *   - src/config.js         : #4361EE
 *   - src/styles/global.css : #2F54EB（自定义 CSS 的 --primary-color）
 *   - src/styles/variables.less : #1890ff（antd v4 默认色，且该文件未被引用/编译）
 * 后果：antd 组件（按钮/链接/选中态）与自定义 CSS 区块（渐变/边框/悬停）颜色对不上，
 * 页面出现"两种蓝"，属于肉眼可见但构建与 lint 都不会报的问题。
 *
 * 本测试把"品牌色唯一"固化为断言，防止再次分叉。
 */

const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "..", "src");

// 品牌色的唯一真值（与 theme.js / config.js / global.css 三处保持一致）
const BRAND = "#4361EE";

function read(p) {
  return fs.readFileSync(p, "utf8");
}

describe("主题色一致性", () => {
  test("theme.js 与 config.js 的品牌色一致", () => {
    const theme = read(path.join(SRC, "styles", "theme.js"));
    const config = read(path.join(SRC, "config.js"));
    const themeMatch = theme.match(/colorPrimary:\s*'([#0-9A-Fa-f]+)'/);
    expect(themeMatch).toBeTruthy();
    expect(themeMatch[1].toUpperCase()).toBe(BRAND);

    const configMatch = config.match(/primaryColor:\s*'([#0-9A-Fa-f]+)'/);
    expect(configMatch).toBeTruthy();
    expect(configMatch[1].toUpperCase()).toBe(BRAND);
  });

  test("global.css 的 --primary-color 与 theme 一致", () => {
    const css = read(path.join(SRC, "styles", "global.css"));
    const m = css.match(/--primary-color:\s*(#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f])/);
    expect(m).toBeTruthy();
    expect(m[1].toUpperCase()).toBe(BRAND);
  });

  test("不存在已废弃的 antd v4 默认主色", () => {
    // #1890ff 是 antd v4 的默认主色；本项目用 antd v5 + 自定义品牌色，
    // 在**样式声明**里出现它说明有样式没跟随主题。
    //
    // 注意：global.css 中有注释解释这个历史问题，注释里含有该色值，
    // 因此必须先剥掉注释再检查，否则会误报（本测试第一版就误报过）。
    const stylesDir = path.join(SRC, "styles");
    const offenders = [];
    for (const f of fs.readdirSync(stylesDir)) {
      if (!f.endsWith(".css")) continue;
      const src = read(path.join(stylesDir, f)).replace(/\/\*[\s\S]*?\*\//g, "");
      if (/#1890ff/i.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  test("CSS 中的品牌色应使用变量而不是硬编码", () => {
    // 允许 global.css 定义变量本身，但不允许其它样式表硬编码品牌色。
    const stylesDir = path.join(SRC, "styles");
    const offenders = [];
    for (const f of fs.readdirSync(stylesDir)) {
      if (!f.endsWith(".css")) continue;
      if (f === "global.css") continue; // 该文件负责定义变量
      const src = read(path.join(stylesDir, f));
      if (new RegExp(BRAND, "i").test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
