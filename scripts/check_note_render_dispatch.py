#!/usr/bin/env python3
"""
「写入的 type」与「渲染分派的 type」一致性守护测试。

背景：分页/无限画布都把 text/image/shape 塞进 strokes 数组，
而渲染器只读 points 字段时，这些内容会「数据在、画面上没有」——
这正是之前「点了添加文本/图片什么都没发生」的根因。

本脚本静态核对：**所有会被写进 strokes 的 type，渲染分派里都必须有分支**。
新增一种内容类型却忘了在渲染器里处理，这里就会 FAIL。

用法：python3 scripts/check_note_render_dispatch.py    （PASS=0 / FAIL=1）
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TARGETS = [
    # (名称, 源码, 渲染分派所在方法)
    ('分页笔记', os.path.join(ROOT, 'ios/NativePagedNoteView/NativePagedNoteView.m'),
     '- (void)renderStrokeEntry:'),
    ('无限画布', os.path.join(ROOT, 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m'),
     '- (void)redrawStrokesOnOverlay {'),
]

# 隐式类型：没有 type 字段时按普通笔迹处理（渲染器无条件兜底画 points）
IMPLICIT_TYPES = {'stroke'}


def balanced(src, i):
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


def method_body(src, signature):
    idx = src.find(signature)
    if idx < 0:
        return None
    return balanced(src, idx)


def main():
    failures = []
    for label, path, dispatch_sig in TARGETS:
        src = open(path, encoding='utf-8', errors='replace').read()
        written = set(re.findall(r'@"type":\s*@"(\w+)"', src))
        body = method_body(src, dispatch_sig)
        if body is None:
            failures.append('%s: 找不到渲染分派方法 %s' % (label, dispatch_sig))
            continue
        dispatched = set(re.findall(r'isEqualToString:@"(\w+)"', body))

        missing = sorted(written - dispatched - IMPLICIT_TYPES)
        status = 'OK' if not missing else 'FAIL'
        print('  [%s] %s: 写入 type=%s' % (status, label, sorted(written)))
        print('         渲染分派=%s' % sorted(dispatched))
        if missing:
            print('         ✗ 写入了但渲染器未分派 -> %s（会重现「数据在、画面没有」）' % missing)
            failures.append('%s: 未分派的 type -> %s' % (label, missing))

    print()
    if failures:
        print('RESULT: FAIL')
        for f in failures:
            print('  - ' + f)
        return 1
    print('RESULT: PASS — 所有写入的 type 都有渲染分支')
    return 0


if __name__ == '__main__':
    sys.exit(main())
