import os

def fix_file(path, fixes):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for line_idx, new_content in fixes.items():
            # line_idx is 1-based, list is 0-based
            if line_idx - 1 < len(lines):
                # Preserve indentation
                old_line = lines[line_idx - 1]
                indent = len(old_line) - len(old_line.lstrip())
                lines[line_idx - 1] = ' ' * indent + new_content + '\n'
                print(f"Fixed line {line_idx} in {path}")
            else:
                print(f"Line {line_idx} out of range in {path}")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
            
    except Exception as e:
        print(f"Error fixing {path}: {e}")

# Fix transcription.py
transcription_fixes = {
    36: '"""转录视图集"""',
    47: '"""获取查询集"""',
    90: '"""说话人分离"""'
}
fix_file('backend/voice_recognition/views/transcription.py', transcription_fixes)

# Fix check_document_converter.py
converter_fixes = {
    13: '"""检查端口是否开放"""',
    24: '"""检查服务健康状态"""',
    88: '"""主函数"""'
}
fix_file('backend/check_document_converter.py', converter_fixes)
