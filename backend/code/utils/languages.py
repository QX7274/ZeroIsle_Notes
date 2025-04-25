"""
编程语言配置和工具
"""

# 语言配置
LANGUAGE_CONFIG = {
    'javascript': {
        'extension': 'js',
        'run_command': 'node {file}',
        'format_command': 'prettier --write {file}',
        'lint_command': 'eslint {file} {rules}',
        'patterns': [
            r'function\s+\w+\s*\(',
            r'const\s+|let\s+|var\s+',
            r'console\.log',
            r'=>'
        ],
        'imports': [
            r'require\([\'"].*[\'"]\)',
            r'import\s+.*\s+from'
        ],
        'functions': [
            r'function\s+\w+',
            r'const\s+\w+\s*=\s*function',
            r'const\s+\w+\s*=\s*\('
        ],
        'completions': [
            {'pattern': r'console\.', 'text': 'log()', 'display_text': 'log', 'description': '将消息输出到控制台'},
            {'pattern': r'document\.', 'text': 'getElementById()', 'display_text': 'getElementById', 'description': '获取指定ID的DOM元素'},
            {'pattern': r'array\.', 'text': 'forEach()', 'display_text': 'forEach', 'description': '对数组中的每个元素执行函数'}
        ]
    },
    'python': {
        'extension': 'py',
        'run_command': 'python {file}',
        'format_command': 'black {file}',
        'lint_command': 'pylint {file} {rules}',
        'patterns': [
            r'def\s+\w+\s*\(',
            r'import\s+',
            r'class\s+\w+',
            r'print\('
        ],
        'imports': [
            r'import\s+\w+',
            r'from\s+\w+\s+import'
        ],
        'functions': [
            r'def\s+\w+',
            r'lambda\s+',
            r'\w+\s*=\s*staticmethod'
        ],
        'completions': [
            {'pattern': r'print\(', 'text': 'f"")', 'display_text': 'f-string', 'description': '格式化字符串'},
            {'pattern': r'\.', 'text': 'append()', 'display_text': 'append', 'description': '向列表添加元素'},
            {'pattern': r'with\s+open\(', 'text': ', "r") as f:', 'display_text': 'open file', 'description': '打开文件进行读取'}
        ]
    },
    'java': {
        'extension': 'java',
        'run_command': 'javac {file} && java {file}',
        'format_command': 'google-java-format -i {file}',
        'lint_command': 'checkstyle {file} {rules}',
        'patterns': [
            r'public\s+class',
            r'public\s+static\s+void\s+main',
            r'System\.out\.println',
            r'import\s+java\.'
        ],
        'imports': [
            r'import\s+java\.',
            r'import\s+javax\.',
            r'import\s+org\.'
        ],
        'functions': [
            r'public\s+\w+\s+\w+\s*\(',
            r'private\s+\w+\s+\w+\s*\(',
            r'protected\s+\w+\s+\w+\s*\('
        ],
        'completions': [
            {'pattern': r'System\.', 'text': 'out.println()', 'display_text': 'out.println', 'description': '向控制台输出一行'},
            {'pattern': r'public\s+void\s+', 'text': 'main(String[] args) {', 'display_text': 'main', 'description': '主方法'},
            {'pattern': r'new\s+ArrayList', 'text': '<>()', 'display_text': 'ArrayList<>()', 'description': '创建新的ArrayList'}
        ]
    },
    'cpp': {
        'extension': 'cpp',
        'run_command': 'g++ {file} -o {file}.out && ./{file}.out',
        'format_command': 'clang-format -i {file}',
        'lint_command': 'cppcheck {file} {rules}',
        'patterns': [
            r'#include',
            r'int\s+main\s*\(',
            r'std::',
            r'cout\s*<<'
        ],
        'imports': [
            r'#include\s+<\w+>',
            r'#include\s+".*"'
        ],
        'functions': [
            r'\w+\s+\w+\s*\([^)]*\)\s*{',
            r'void\s+\w+\s*\(',
            r'int\s+\w+\s*\('
        ]
    },
    'typescript': {
        'extension': 'ts',
        'run_command': 'ts-node {file}',
        'format_command': 'prettier --write {file}',
        'lint_command': 'eslint {file} {rules}',
        'patterns': [
            r'interface\s+',
            r'class\s+',
            r'type\s+',
            r':\s*\w+'
        ],
        'imports': [
            r'import\s+.*\s+from',
            r'export\s+'
        ],
        'functions': [
            r'function\s+\w+',
            r'const\s+\w+\s*=\s*\(',
            r'\w+\s*:\s*\([^)]*\)\s*=>'
        ]
    },
    'go': {
        'extension': 'go',
        'run_command': 'go run {file}',
        'format_command': 'gofmt -w {file}',
        'lint_command': 'golint {file} {rules}',
        'patterns': [
            r'package\s+',
            r'func\s+',
            r'import\s+\(',
            r'fmt\.'
        ],
        'imports': [
            r'import\s+\(',
            r'import\s+"'
        ],
        'functions': [
            r'func\s+\w+',
            r'func\s+\([^)]+\)\s+\w+',
            r'func\s+\([^)]+\)\s+\w+\s*\('
        ]
    },
    'ruby': {
        'extension': 'rb',
        'run_command': 'ruby {file}',
        'format_command': 'rubocop -a {file}',
        'lint_command': 'rubocop {file} {rules}',
        'patterns': [
            r'def\s+',
            r'class\s+',
            r'require\s+',
            r'puts\s+'
        ],
        'imports': [
            r'require\s+[\'"]',
            r'include\s+'
        ],
        'functions': [
            r'def\s+\w+',
            r'def\s+self\.\w+',
            r'lambda\s*{'
        ]
    },
    'php': {
        'extension': 'php',
        'run_command': 'php {file}',
        'format_command': 'php-cs-fixer fix {file}',
        'lint_command': 'phpcs {file} {rules}',
        'patterns': [
            r'<\?php',
            r'function\s+',
            r'\$\w+',
            r'echo\s+'
        ],
        'imports': [
            r'require\s+[\'"]',
            r'include\s+[\'"]',
            r'use\s+\w+'
        ],
        'functions': [
            r'function\s+\w+',
            r'public\s+function',
            r'private\s+function'
        ]
    },
    'rust': {
        'extension': 'rs',
        'run_command': 'rustc {file} && ./{file}',
        'format_command': 'rustfmt {file}',
        'lint_command': 'clippy-driver {file} {rules}',
        'patterns': [
            r'fn\s+',
            r'let\s+mut',
            r'struct\s+',
            r'impl\s+'
        ],
        'imports': [
            r'use\s+\w+',
            r'mod\s+\w+'
        ],
        'functions': [
            r'fn\s+\w+',
            r'pub\s+fn',
            r'impl\s+\w+\s+for'
        ]
    },
    'swift': {
        'extension': 'swift',
        'run_command': 'swift {file}',
        'format_command': 'swiftformat {file}',
        'lint_command': 'swiftlint {file} {rules}',
        'patterns': [
            r'func\s+',
            r'class\s+',
            r'struct\s+',
            r'var\s+'
        ],
        'imports': [
            r'import\s+\w+'
        ],
        'functions': [
            r'func\s+\w+',
            r'override\s+func',
            r'mutating\s+func'
        ]
    }
}

def get_language_extension(language):
    """
    获取语言的文件扩展名
    
    Args:
        language: 语言名称
        
    Returns:
        str: 文件扩展名
    """
    language = language.lower()
    if language in LANGUAGE_CONFIG:
        return LANGUAGE_CONFIG[language]['extension']
    return 'txt'

def get_language_by_extension(extension):
    """
    根据文件扩展名获取语言
    
    Args:
        extension: 文件扩展名
        
    Returns:
        str: 语言名称
    """
    if extension.startswith('.'):
        extension = extension[1:]
    
    for language, config in LANGUAGE_CONFIG.items():
        if config['extension'] == extension:
            return language
    
    return 'text'
