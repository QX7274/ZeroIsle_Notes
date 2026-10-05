"""前端字段名与后端序列化器契约一致性守护。

锁定的真实缺陷（本轮实测发现，均为**已挂载页面**可见的故障）：
  - NoteList.js 的表格读取 author / category / tags / createdAt / updatedAt，
    而后端 NoteListSerializer 实际返回 username / category_name / tags_count /
    created_at / updated_at —— "作者/分类/标签/创建时间"四列长期空白，
    其中作者列按对象取 author.id 会直接抛 TypeError；
  - NoteDetail.js 读 note.author?.username 与 note.category?.name，
    而 Note 模型用的是 username 与 category_name，作者一栏恒为空；
  - 查询参数用 categoryId/tagId/startDate/endDate，后端只认 snake_case，
    筛选被静默忽略（点了没用，仍返回全部数据）；
  - getUserNotes 把分页对象当数组 setState，用户详情页笔记列表永远空行；
  - ReportList 读 response.results/count，而服务层统一解包后是 data/total。

这类问题构建、lint、后端测试全都通不过不了 —— 因为前端引用的字段名"合法"，
只是后端不返回它。必须用"前端读取的字段 ↔ 后端序列化器 fields"的比对来守。
"""

import os
import re

import pytest


BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_SRC = os.path.join(os.path.dirname(BACKEND), "frontend", "src")



def _strip_comments(js_text):
    """去掉 // 行注释与 /* ... */ 块注释。

    为什么必须去掉：本轮修复的代码里，注释会写明"原写法 note.author?.username"，
    若不去注释，守护测试会把**说明文字**当成违规代码误报（本测试第一版就误报了）。
    这与 tests/test_dashboard_api.py 里"先剥注释再检查"的做法一致。
    """
    text = re.sub(r"/\*[\s\S]*?\*/", "", js_text)
    lines = []
    for line in text.split("\n"):
        # 只处理整行注释，避免误伤 URL 里的 //
        if line.strip().startswith("//"):
            continue
        lines.append(line)
    return "\n".join(lines)

def _serializer_fields(serializer_name):
    """从 content/serializers.py 里取出某个序列化器的 fields 列表。"""
    path = os.path.join(BACKEND, "content", "serializers.py")
    text = open(path, encoding="utf-8").read()

    m = re.search(
        r"class " + serializer_name + r"\b[\s\S]*?class Meta:[\s\S]*?fields\s*=\s*("
        r"\[[^\]]*\]|\'__all__\')",
        text,
    )
    assert m, f"未找到序列化器 {serializer_name} 的 fields 声明"
    body = m.group(1)
    if "__all__" in body:
        return None
    return set(re.findall(r"[\'\"]([a-zA-Z_][\w]*)[\'\"]", body))


def test_note_list_columns_exist_in_serializer():
    """NoteList 表格的 dataIndex 必须是后端真实返回的字段。"""
    fields = _serializer_fields("NoteListSerializer")
    assert fields is not None, "NoteListSerializer 不应使用 __all__（需显式声明以便本测试生效）"

    page = open(
        os.path.join(FRONTEND_SRC, "pages", "NoteManagement", "NoteList.js"),
        encoding="utf-8",
    ).read()

    # 只检查主表格区域（避免把导出/统计用到的其它字段一起纳入）
    start = page.find("const columns = [")
    assert start > 0, "NoteList.js 未找到主表格 columns 定义（结构变化请同步更新本测试）"
    end = page.find("const ", start + 10)
    table_region = page[start:end] if end > start else page[start:]

    indexes = set(re.findall(r"dataIndex:\s*[\'\"]([a-zA-Z_][\w]*)[\'\"]", table_region))
    assert indexes, "未解析到任何 dataIndex（结构变化请同步更新本测试）"

    # 允许前端使用结果字段 total（分页）以及操作列的无 dataIndex 项
    unknown = {i for i in indexes if i not in fields and i != "action"}
    assert unknown == set(), (
        "NoteList 表格引用了后端 NoteListSerializer 不返回的字段（会显示空白或报错）：\n"
        f"  多余字段: {sorted(unknown)}\n"
        f"  后端实际提供: {sorted(fields)}"
    )


def test_note_list_no_object_access_on_string_fields():
    """username 是字符串，不能再按对象取 .id / .username。"""
    page = open(
        os.path.join(FRONTEND_SRC, "pages", "NoteManagement", "NoteList.js"),
        encoding="utf-8",
    ).read()
    code = _strip_comments(page)
    assert "author.id" not in code and "author.username" not in code, (
        "NoteList.js 仍在按对象访问 author.*；后端返回的是字符串 username，"
        "运行时会抛 TypeError（本轮已修复，勿回退）"
    )


def test_note_detail_uses_model_field_names():
    """NoteDetail 必须用 username / category_name，而不是 author / category.name。"""
    page = open(
        os.path.join(FRONTEND_SRC, "pages", "NoteManagement", "NoteDetail.js"),
        encoding="utf-8",
    ).read()
    code = _strip_comments(page)
    assert not re.search(r"note\.author[?.]", code), (
        "NoteDetail.js 仍在读 note.author.*；Note 模型提供的是 username（字符串）"
    )
    assert not re.search(r"note\.category\?\.name", code), (
        "NoteDetail.js 仍在读 note.category?.name；应为 category_name"
    )


def test_note_list_query_params_use_backend_names():
    """查询参数必须是后端认的 snake_case，否则筛选被静默忽略。"""
    page = open(
        os.path.join(FRONTEND_SRC, "pages", "NoteManagement", "NoteList.js"),
        encoding="utf-8",
    ).read()
    start = page.find("await getNotes({")
    assert start > 0, "未找到 getNotes 调用"
    end = page.find("});", start)
    call = page[start:end]

    for bad in ("categoryId:", "tagId:", "startDate:", "endDate:", "sortField:", "sortOrder:"):
        assert bad not in call, (
            f"getNotes 仍在传 {bad}（后端不识别该参数，筛选会失效）；"
            "应使用 category_id / tag_id / start_date / end_date / ordering"
        )
    for good in ("category_id", "tag_id", "start_date", "end_date", "ordering"):
        assert good in call, f"getNotes 缺少后端参数 {good}"


def test_list_services_unwrap_pagination():
    """列表类服务必须解包分页，否则调用方拿不到行数组。"""
    svc = open(
        os.path.join(FRONTEND_SRC, "services", "contentService.js"), encoding="utf-8"
    ).read()
    assert "const unwrapList" in svc, "contentService 缺少统一的 unwrapList 解包助手"
    for fn in ("getNotes", "getCategories", "getTags", "getReports"):
        m = re.search(r"export const " + fn + r"[\s\S]{0,400}?return ([^;]+);", svc)
        assert m, f"未找到 {fn} 的实现"
        assert "unwrapList" in m.group(1), (
            f"{fn} 未使用 unwrapList 解包，调用方会拿到分页对象而非数组"
        )


def test_backend_accepts_both_user_id_and_userId():
    """用户笔记筛选需同时接受两种写法，避免再次静默失效。"""
    views = open(
        os.path.join(BACKEND, "content", "views.py"), encoding="utf-8"
    ).read()
    assert "userId" in views, (
        "NoteViewSet 未兼容 userId 别名；前端历史写法会传 userId，筛选会失效"
    )
