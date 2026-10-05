#!/usr/bin/env python3
"""
跨端「文本/图片」字段往返守护测试。

背景：iOS 与 Android 的分页笔记都把 text/image 塞进 strokes 数组，
而旧导出逻辑只序列化 points 字段，导致文本与图片在保存/重开后静默消失；
跨端导入时字段名不一致也会丢位置或丢内容。

本脚本不依赖任何构建，直接用源码做静态字段对齐：
  1) iOS paged  : export 每个 type 分支写入的字段 ⊇ import 读取的字段（往返无损）
  2) iOS infinite: 同上
  3) Android paged 导出的字段 ⊆ iOS paged import 能读取的字段（跨端兼容）

任一条件不满足即返回非 0，可用于 CI。
"""
import re
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IOS_PAGED = os.path.join(ROOT, 'ios/NativePagedNoteView/NativePagedNoteView.m')
IOS_INF = os.path.join(ROOT, 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m')
AND_PAGED = os.path.join(ROOT, 'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteView.java')


def balanced(src, i):
    """从 i 开始做花括号配对，返回 { ... } 文本"""
    while i < len(src) and src[i] != '{':
        i += 1
    depth, j = 0, i
    while j < len(src):
        if src[j] == '{':
            depth += 1
        elif src[j] == '}':
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    return src[i:]


def fn_body(src, signature):
    """只取真正的函数定义（跳过 @interface 里的声明）"""
    pat = re.compile(re.escape(signature) + r'[^;{]*\n\s*\{')
    m = pat.search(src)
    if not m:
        raise AssertionError('未找到函数定义: ' + signature)
    return balanced(src, src.index('{', m.start()))


def branch(fn, marker):
    k = fn.find(marker)
    return balanced(fn, k + len(marker)) if k >= 0 else None


def written_keys(block):
    """分支内写入的字段名：@{...} 字面量 + entry[@"k"] = ... 赋值"""
    out = set()
    for m in re.finditer(r'@\{', block):
        seg = balanced(block, m.start())
        out |= set(re.findall(r'@\"([A-Za-z][A-Za-z0-9_]*)\"\s*:', seg))
    out |= set(re.findall(r'\[\s*@\"([A-Za-z][A-Za-z0-9_]*)\"\s*\]\s*=', block))
    return out


def read_keys(block):
    return set(re.findall(r'\[\s*@\"([A-Za-z][A-Za-z0-9_]*)\"\s*\]', block)) | \
           set(re.findall(r'@\"([A-Za-z][A-Za-z0-9_]*)\"\s*:', block))


def check_view(label, src, export_sig, import_sig, failures):
    exp = fn_body(src, export_sig)
    imp = fn_body(src, import_sig)
    for kind in ('text', 'image'):
        marker = 'isEqualToString:@"%s"' % kind
        e, i = branch(exp, marker), branch(imp, marker)
        if e is None or i is None:
            failures.append('%s: 缺少 %s 的 export/import 分支' % (label, kind))
            continue
        dropped = sorted(written_keys(e) - read_keys(i))
        status = 'OK' if not dropped else 'FAIL'
        print('  [%s] %s %s: export %d 字段, 往返丢失 %s' %
              (status, label, kind.upper(), len(written_keys(e)), dropped or '无'))
        if dropped:
            failures.append('%s %s: 这些字段导出后不会被导回 -> %s' % (label, kind, dropped))


def check_android_to_ios(failures):
    """Android 导出字段必须都能被 iOS paged import 读取"""
    and_src = open(AND_PAGED, encoding='utf-8', errors='replace').read()
    ios_src = open(IOS_PAGED, encoding='utf-8', errors='replace').read()
    imp = fn_body(ios_src, '- (NSDictionary *)importedEntryFromJSON:')

    def android_export_fields(type_literal):
        """取 Android 导出分支里某个 type 的 strokeObj.put 字段。

        不能按 'if (stroke instanceof TextStrokeData)' 定位：该表达式在
        绘制代码里也出现（第 1 次出现是 drawTextStroke），必须锚定
        **导出专用**的 strokeObj.put("type", "text")，再从那里向后取一段。

        取到下一个 strokeObj.put("type", ...) 为止，避免把相邻分支的字段
        算进来（相邻分支会产生假失败）。
        """
        anchor = 'strokeObj.put("type", "%s")' % type_literal
        a = and_src.find(anchor)
        if a < 0:
            return None
        nxt = and_src.find('strokeObj.put("type",', a + len(anchor))
        seg = and_src[a:nxt] if nxt > 0 else and_src[a:a + 3000]
        return set(re.findall(r'strokeObj\.put\("([A-Za-z0-9_]+)"', seg))

    pairs = [
        # (kind, Android 导出 type 字面量, iOS 对应 import 分支)
        ('text', 'text', branch(imp, 'isEqualToString:@"text"')),
        ('image', 'image', branch(imp, 'isEqualToString:@"image"')),
    ]
    for kind, type_literal, ios_block in pairs:
        a = android_export_fields(type_literal)
        if a is None or ios_block is None:
            failures.append('Android %s: 无法定位导出/导入分支' % kind)
            continue
        missing = sorted(a - read_keys(ios_block))
        status = 'OK' if not missing else 'FAIL'
        print('  [%s] Android->iOS %s: Android 写 %s, iOS 未读取 %s' %
              (status, kind.upper(), sorted(a), missing or '无'))
        if missing:
            failures.append('Android %s 的字段 iOS 读不到 -> %s' % (kind, missing))


def main():
    failures = []
    print('== iOS 分页笔记 往返 ==')
    check_view('paged', open(IOS_PAGED, encoding='utf-8', errors='replace').read(),
               '- (NSDictionary *)exportedEntryFromStroke:',
               '- (NSDictionary *)importedEntryFromJSON:', failures)
    print('== iOS 无限画布 往返 ==')
    check_view('infinite', open(IOS_INF, encoding='utf-8', errors='replace').read(),
               '- (NSDictionary *)exportedEntryFromEntry:',
               '- (NSDictionary *)importedEntryFromJSON:', failures)
    print('== Android 导出 -> iOS 导入 跨端兼容 ==')
    check_android_to_ios(failures)

    print()
    if failures:
        print('RESULT: FAIL')
        for f in failures:
            print('  - ' + f)
        return 1
    print('RESULT: PASS — 文本/图片字段往返无损，且 Android 导出可被 iOS 完整还原')
    return 0


if __name__ == '__main__':
    sys.exit(main())
