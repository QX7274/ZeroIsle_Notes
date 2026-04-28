#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""归档历史文档脚本"""

import os
import shutil
from pathlib import Path
from datetime import datetime

# 需要归档的根目录文档列表
DOCS_TO_ARCHIVE = [
    'AI功能完成度总结.md',
    'AI功能实现检查报告.md',
    'CHANGES_SUMMARY.md',
    'CODE_EXAMPLES.md',
    'DELIVERABLES_SUMMARY.md',
    'DETAILED_IMPLEMENTATION_GUIDE.md',
    'DETAILED_IMPLEMENTATION_PLAN.md',
    'DOCUMENT_INVENTORY_AND_IMPLEMENTATION_PLAN.md',
    'EXECUTION_REPORT.md',
    'EXECUTION_SUMMARY.md',
    'FINAL_SUMMARY.md',
    'FIXES_IMPLEMENTATION_REPORT.md',
    'FIXES_SUMMARY.md',
    'IMPLEMENTATION_GUIDE.md',
    'IMPLEMENTATION_REPORT.md',
    'LATEST_CHANGES_SUMMARY.md',
    'LATEST_FIXES_SUMMARY.md',
    'MODIFICATIONS_SUMMARY.md',
    'NAVIGATION_FIX_SUMMARY.md',
    'PLAN_COMPLETION_REPORT.md',
    'PROGRESS_TRACKER.md',
    'PROJECT_ANALYSIS.md',
    'PROJECT_SUMMARY.md',
    'QUICK_FIX_REFERENCE.md',
    'QUICK_REFERENCE.md',
    'QUICK_REFERENCE_UI_FIXES.md',
    'README_UI_FIXES.md',
    'TECH_STACK_ANALYSIS.md',
    'TESTING_GUIDE.md',
    'UI_IMPROVEMENT_INDEX.md',
    'UI_IMPROVEMENT_PLAN.md',
    'UI_IMPROVEMENT_QUICK_REFERENCE.md',
    'UI_OPTIMIZATION_IMPLEMENTATION_REPORT.md',
    'VERIFICATION_CHECKLIST.md',
    'VERIFICATION_REPORT.md',
]

def archive_documents(root_dir, archive_dir, dry_run=True):
    """
    归档历史文档
    
    Args:
        root_dir: 项目根目录
        archive_dir: 归档目标目录
        dry_run: 是否为模拟运行（不实际移动文件）
    """
    root_path = Path(root_dir)
    archive_path = Path(archive_dir)
    
    # 确保归档目录存在
    archive_path.mkdir(parents=True, exist_ok=True)
    
    archived_count = 0
    not_found_count = 0
    
    print(f"{'[模拟运行]' if dry_run else '[实际执行]'} 开始归档文档...")
    print(f"源目录: {root_path}")
    print(f"目标目录: {archive_path}")
    print("-" * 60)
    
    for doc_name in DOCS_TO_ARCHIVE:
        source_file = root_path / doc_name
        target_file = archive_path / doc_name
        
        if source_file.exists():
            if dry_run:
                print(f"[将移动] {doc_name}")
            else:
                try:
                    shutil.move(str(source_file), str(target_file))
                    print(f"[已移动] {doc_name}")
                except Exception as e:
                    print(f"[错误] 移动 {doc_name} 失败: {e}")
                    continue
            archived_count += 1
        else:
            print(f"[未找到] {doc_name}")
            not_found_count += 1
    
    print("-" * 60)
    print(f"归档完成:")
    print(f"  - 已归档: {archived_count} 个文件")
    print(f"  - 未找到: {not_found_count} 个文件")
    
    # 生成归档说明文件
    if not dry_run:
        readme_path = archive_path / 'README.md'
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(f"# 历史文档归档 (2025-12)\n\n")
            f.write(f"**归档时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"**归档原因**: 项目文档整理，清理根目录\n\n")
            f.write(f"**归档文件数**: {archived_count}\n\n")
            f.write(f"## 归档文件列表\n\n")
            for doc_name in sorted(DOCS_TO_ARCHIVE):
                if (archive_path / doc_name).exists():
                    f.write(f"- {doc_name}\n")
            f.write(f"\n---\n\n")
            f.write(f"如需查看这些文档，请直接在本目录中查找。\n")
            f.write(f"新的权威文档请参考根目录的 DOCUMENTATION_INDEX.md\n")
        print(f"\n已创建归档说明: {readme_path}")

def main():
    import sys
    
    root_dir = os.getcwd()
    archive_dir = os.path.join(root_dir, 'archive', 'historical-reports', '2025-12')
    
    # 检查是否为实际执行模式
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] == '--execute':
        dry_run = False
        confirm = input("确认要执行归档操作吗？(yes/no): ")
        if confirm.lower() != 'yes':
            print("操作已取消")
            return
    
    archive_documents(root_dir, archive_dir, dry_run)
    
    if dry_run:
        print("\n这是模拟运行。要实际执行，请运行: python archive_historical_docs.py --execute")

if __name__ == '__main__':
    main()

