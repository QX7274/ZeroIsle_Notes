"""
代码安全工具
提供代码安全检查和防护功能
"""

import re
import logging

logger = logging.getLogger('backend')

# 危险模式列表
DANGEROUS_PATTERNS = {
    'python': [
        # 系统命令执行
        r'os\.system\s*\(',
        r'subprocess\.(?:call|Popen|run|check_output|check_call)\s*\(',
        r'exec\s*\(',
        r'eval\s*\(',
        # 文件操作
        r'open\s*\(.+?[\'"]w[\'"]',
        r'(?:os|io)\.(?:unlink|remove)',
        # 网络操作
        r'urllib\.request\.urlopen',
        r'requests\.(?:get|post|put|delete)',
        r'socket\.',
        # 数据库操作
        r'sqlite3\.',
        r'psycopg2\.',
        r'pymysql\.',
        r'pymongo\.',
        # 其他危险操作
        r'shutil\.(?:rmtree|move|copy)',
        r'sys\.exit',
        r'os\.(?:environ|getenv|putenv)',
        r'__import__\s*\('
    ],
    'javascript': [
        # 系统命令执行
        r'require\s*\(\s*[\'"]child_process[\'"]\s*\)',
        r'exec\s*\(',
        r'spawn\s*\(',
        r'eval\s*\(',
        # 文件操作
        r'require\s*\(\s*[\'"]fs[\'"]\s*\)',
        r'fs\.(?:writeFile|unlink|rmdir|mkdir)',
        # 网络操作
        r'require\s*\(\s*[\'"]http[s]?[\'"]\s*\)',
        r'fetch\s*\(',
        r'XMLHttpRequest',
        # 其他危险操作
        r'process\.exit',
        r'process\.env',
        r'document\.(?:write|cookie)',
        r'localStorage\.',
        r'sessionStorage\.',
        r'window\.open'
    ],
    'java': [
        # 系统命令执行
        r'Runtime\.getRuntime\(\)\.exec',
        r'ProcessBuilder',
        # 文件操作
        r'new\s+File\s*\(',
        r'FileOutputStream',
        r'FileWriter',
        # 网络操作
        r'Socket\s*\(',
        r'URL\s*\(',
        r'HttpURLConnection',
        # 反射和类加载
        r'Class\.forName',
        r'ClassLoader',
        r'Method\.invoke',
        # 其他危险操作
        r'System\.exit',
        r'System\.getenv',
        r'System\.setProperty'
    ],
    'cpp': [
        # 系统命令执行
        r'system\s*\(',
        r'popen\s*\(',
        r'exec[lv][pe]?\s*\(',
        # 文件操作
        r'fopen\s*\(',
        r'ofstream',
        r'remove\s*\(',
        # 内存操作
        r'malloc\s*\(',
        r'free\s*\(',
        r'realloc\s*\(',
        # 其他危险操作
        r'strcpy\s*\(',
        r'strcat\s*\(',
        r'gets\s*\(',
        r'scanf\s*\('
    ]
}

# 默认安全规则
DEFAULT_SECURITY_RULES = {
    'allow_system_commands': False,
    'allow_file_operations': False,
    'allow_network_operations': False,
    'allow_database_operations': False,
    'allow_dangerous_functions': False
}

def check_code_security(code, language, security_rules=None):
    """
    检查代码安全性
    
    Args:
        code: 代码内容
        language: 编程语言
        security_rules: 安全规则
        
    Returns:
        dict: 安全检查结果
    """
    language = language.lower()
    security_rules = security_rules or DEFAULT_SECURITY_RULES
    
    # 获取语言的危险模式
    patterns = DANGEROUS_PATTERNS.get(language, [])
    if not patterns:
        return {
            'is_safe': True,
            'warnings': [],
            'language': language
        }
    
    # 检查危险模式
    warnings = []
    for pattern in patterns:
        matches = re.finditer(pattern, code)
        for match in matches:
            # 获取匹配的行号
            line_num = code[:match.start()].count('\n') + 1
            
            # 获取匹配的代码片段
            line_start = code.rfind('\n', 0, match.start()) + 1
            line_end = code.find('\n', match.end())
            if line_end == -1:
                line_end = len(code)
            code_snippet = code[line_start:line_end].strip()
            
            # 确定警告类型
            warning_type = 'dangerous_function'
            if 'system' in pattern or 'exec' in pattern or 'eval' in pattern:
                warning_type = 'system_command'
            elif 'file' in pattern.lower() or 'open' in pattern or 'write' in pattern:
                warning_type = 'file_operation'
            elif 'http' in pattern or 'url' in pattern or 'socket' in pattern:
                warning_type = 'network_operation'
            elif 'sql' in pattern or 'db' in pattern or 'mongo' in pattern:
                warning_type = 'database_operation'
            
            # 检查是否允许该类型的操作
            is_allowed = False
            if warning_type == 'system_command' and security_rules.get('allow_system_commands'):
                is_allowed = True
            elif warning_type == 'file_operation' and security_rules.get('allow_file_operations'):
                is_allowed = True
            elif warning_type == 'network_operation' and security_rules.get('allow_network_operations'):
                is_allowed = True
            elif warning_type == 'database_operation' and security_rules.get('allow_database_operations'):
                is_allowed = True
            elif warning_type == 'dangerous_function' and security_rules.get('allow_dangerous_functions'):
                is_allowed = True
            
            if not is_allowed:
                warnings.append({
                    'line': line_num,
                    'code': code_snippet,
                    'message': f"检测到潜在的危险操作: {match.group(0)}",
                    'type': warning_type,
                    'severity': 'high'
                })
    
    return {
        'is_safe': len(warnings) == 0,
        'warnings': warnings,
        'language': language
    }

def sanitize_code(code, language, security_rules=None):
    """
    净化代码，移除危险操作
    
    Args:
        code: 代码内容
        language: 编程语言
        security_rules: 安全规则
        
    Returns:
        str: 净化后的代码
    """
    language = language.lower()
    security_rules = security_rules or DEFAULT_SECURITY_RULES
    
    # 获取语言的危险模式
    patterns = DANGEROUS_PATTERNS.get(language, [])
    if not patterns:
        return code
    
    # 替换危险操作
    sanitized_code = code
    for pattern in patterns:
        # 确定警告类型
        warning_type = 'dangerous_function'
        if 'system' in pattern or 'exec' in pattern or 'eval' in pattern:
            warning_type = 'system_command'
        elif 'file' in pattern.lower() or 'open' in pattern or 'write' in pattern:
            warning_type = 'file_operation'
        elif 'http' in pattern or 'url' in pattern or 'socket' in pattern:
            warning_type = 'network_operation'
        elif 'sql' in pattern or 'db' in pattern or 'mongo' in pattern:
            warning_type = 'database_operation'
        
        # 检查是否允许该类型的操作
        is_allowed = False
        if warning_type == 'system_command' and security_rules.get('allow_system_commands'):
            is_allowed = True
        elif warning_type == 'file_operation' and security_rules.get('allow_file_operations'):
            is_allowed = True
        elif warning_type == 'network_operation' and security_rules.get('allow_network_operations'):
            is_allowed = True
        elif warning_type == 'database_operation' and security_rules.get('allow_database_operations'):
            is_allowed = True
        elif warning_type == 'dangerous_function' and security_rules.get('allow_dangerous_functions'):
            is_allowed = True
        
        if not is_allowed:
            # 替换危险操作为注释
            sanitized_code = re.sub(
                pattern,
                lambda m: f"/* 安全限制: {m.group(0)} */",
                sanitized_code
            )
    
    return sanitized_code

def is_code_safe_to_run(code, language, security_rules=None):
    """
    检查代码是否安全可运行
    
    Args:
        code: 代码内容
        language: 编程语言
        security_rules: 安全规则
        
    Returns:
        bool: 是否安全
    """
    result = check_code_security(code, language, security_rules)
    return result['is_safe']
