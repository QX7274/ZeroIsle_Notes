#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""收集项目文档信息的脚本"""

import os
import re
from pathlib import Path
from datetime import datetime

# 定义文档目录和文件模式
DOC_DIRS = [
    'docs', 'doc', 'documentation', 'design', 'specs', 'requirements',
    'rfc', 'proposal', 'notes', 'wiki', 'Info', 'optimization-docs',
    'module-status', '模块功能核查与优化记录', '模块功能-核查与优化记录',
    'archive', 'admin_system/docs'
]

DOC_FILES = [
    'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md'
]

def should_include(file_path):
    """判断文件是否应该包含在文档清单中"""
    path_str = str(file_path)
    
    # 检查是否在文档目录中
    for doc_dir in DOC_DIRS:
        if f'\\{doc_dir}\\' in path_str or f'/{doc_dir}/' in path_str:
            return True
        if path_str.endswith(f'\\{doc_dir}') or path_str.endswith(f'/{doc_dir}'):
            return True
    
    # 检查是否是特定文档文件
    if file_path.name in DOC_FILES:
        return True
    
    return False

def extract_title(file_path):
    """从文件中提取标题"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                # 查找第一个 markdown 标题
                match = re.match(r'^\s*#\s+(.+)$', line)
                if match:
                    return match.group(1).strip()
        # 如果没找到标题，返回文件名
        return file_path.stem
    except Exception as e:
        return file_path.stem

def collect_documents(root_dir):
    """收集所有文档文件信息"""
    root_path = Path(root_dir)
    documents = []
    
    # 遍历所有 .md 和 .markdown 文件
    for ext in ['*.md', '*.markdown']:
        for file_path in root_path.rglob(ext):
            # 跳过 node_modules 等目录
            if 'node_modules' in str(file_path):
                continue
            if '__pycache__' in str(file_path):
                continue
            
            if should_include(file_path):
                rel_path = file_path.relative_to(root_path)
                title = extract_title(file_path)
                modified = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                documents.append({
                    'path': str(rel_path),
                    'title': title,
                    'modified': modified.strftime('%Y-%m-%d %H:%M:%S'),
                    'size': file_path.stat().st_size
                })
    
    return sorted(documents, key=lambda x: x['path'])

def generate_markdown_table(documents):
    """生成 Markdown 表格"""
    lines = []
    lines.append('| 路径 | 标题 | 最后更新时间 | 大小(KB) | 类型 | 状态 |')
    lines.append('|------|------|--------------|----------|------|------|')
    
    for doc in documents:
        size_kb = doc['size'] / 1024
        lines.append(f"| {doc['path']} | {doc['title']} | {doc['modified']} | {size_kb:.1f} | | |")
    
    return '\n'.join(lines)

def main():
    root_dir = os.getcwd()
    print(f"正在扫描目录: {root_dir}")
    
    documents = collect_documents(root_dir)
    print(f"找到 {len(documents)} 个文档文件")
    
    # 生成表格
    table = generate_markdown_table(documents)
    
    # 保存到文件
    output_file = 'DOCUMENT_INVENTORY.md'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('# 项目文档清单\n\n')
        f.write(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n')
        f.write(f'**文档总数**: {len(documents)}\n\n')
        f.write('---\n\n')
        f.write(table)
        f.write('\n\n---\n\n')
        f.write('## 说明\n\n')
        f.write('- **类型**: 需求/设计/缺陷/计划/操作指南/历史/其他\n')
        f.write('- **状态**: ✅权威 / 📦归档 / 🔄合并 / ❌删除 / ⚠️待定\n')
    
    print(f"文档清单已保存到: {output_file}")
    
    # 同时输出到控制台
    print("\n" + table)

if __name__ == '__main__':
    main()

