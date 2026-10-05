#!/usr/bin/env bash
#
# 坐标模型守护测试入口。
#
# 用法：  bash scripts/check_note_coordinate_model.sh
#         echo $?     # 0 = PASS, 非 0 = FAIL（可直接接 CI）
#
# 为什么要单独一个 wrapper：校验文件是 .m（Objective-C），
# 需要正确的 clang 链接参数才能在 macOS 上直接跑。把参数固定在这里，
# 避免每个人手敲一遍、或敲错 framework 后误以为「测试通过」。
#
# 注意：本测试校验的是 **坐标公式的不变式**，源码里真正的实现是
# ios/NativePagedNoteView/NativePagedNoteView.m 的 screenToWorld: / worldToScreen:。
# 改那两处时，必须同步改 scripts/check_note_coordinate_model.m 里的同名函数，
# 否则测试会变成「校验一个已经不存在的模型」。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/check_note_coordinate_model.m"
BINARY="${TMPDIR:-/tmp}/check_note_coordinate_model"

if [[ ! -f "$SOURCE" ]]; then
  echo "FAIL: 找不到 $SOURCE" >&2
  exit 2
fi

# 用宿主 clang（macOS）编译：本测试只依赖 Foundation/CoreGraphics，
# 与 iOS SDK 无关，因此不需要模拟器即可执行。
if ! clang -fobjc-arc "$SOURCE" -o "$BINARY" -framework Foundation -framework CoreGraphics; then
  echo "FAIL: 编译失败（$SOURCE）" >&2
  exit 2
fi

"$BINARY"
