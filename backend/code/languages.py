LANGUAGE_CONFIGS = {
    'javascript': {
        'extension': '.js',
        'command': 'node {file}',
        'linter': 'eslint --format json --stdin',
        'formatter': 'prettier --stdin',
        'analyzer': 'jshint --reporter=json --stdin',
        'completer': 'node completers/javascript.js {code}'
    },
    'python': {
        'extension': '.py',
        'command': 'python {file}',
        'linter': 'pylint --output-format=json --stdin',
        'formatter': 'black --stdin',
        'analyzer': 'pylint --output-format=json --stdin',
        'completer': 'python completers/python.py {code}'
    },
    'java': {
        'extension': '.java',
        'command': 'javac {file} && java {file}',
        'linter': 'checkstyle -f json -c google_checks.xml',
        'formatter': 'google-java-format',
        'analyzer': 'pmd -f json -R rulesets/java/quickstart.xml',
        'completer': 'java completers/JavaCompleter {code}'
    },
    'cpp': {
        'extension': '.cpp',
        'command': 'g++ {file} -o {file}.out && ./{file}.out',
        'linter': 'cppcheck --output-file=cppcheck.json',
        'formatter': 'clang-format',
        'analyzer': 'clang-tidy -checks=*',
        'completer': 'cpp completers/cpp_completer {code}'
    },
    'csharp': {
        'extension': '.cs',
        'command': 'dotnet run {file}',
        'linter': 'stylecop',
        'formatter': 'dotnet format',
        'analyzer': 'roslynator analyze',
        'completer': 'csharp completers/csharp_completer {code}'
    },
    'php': {
        'extension': '.php',
        'command': 'php {file}',
        'linter': 'phpcs --report=json',
        'formatter': 'php-cs-fixer fix',
        'analyzer': 'phpstan analyse',
        'completer': 'php completers/php_completer {code}'
    },
    'ruby': {
        'extension': '.rb',
        'command': 'ruby {file}',
        'linter': 'rubocop --format json',
        'formatter': 'rubocop -a',
        'analyzer': 'ruby-lint',
        'completer': 'ruby completers/ruby_completer {code}'
    },
    'swift': {
        'extension': '.swift',
        'command': 'swift {file}',
        'linter': 'swiftlint lint --reporter json',
        'formatter': 'swiftformat',
        'analyzer': 'swift-analyzer',
        'completer': 'swift completers/swift_completer {code}'
    },
    'kotlin': {
        'extension': '.kt',
        'command': 'kotlin {file}',
        'linter': 'ktlint --reporter=json',
        'formatter': 'ktlint -F',
        'analyzer': 'detekt',
        'completer': 'kotlin completers/kotlin_completer {code}'
    },
    'go': {
        'extension': '.go',
        'command': 'go run {file}',
        'linter': 'golangci-lint run --out-format=json',
        'formatter': 'gofmt',
        'analyzer': 'go vet',
        'completer': 'go completers/go_completer {code}'
    },
    'rust': {
        'extension': '.rs',
        'command': 'rustc {file} && ./{file}',
        'linter': 'clippy --message-format=json',
        'formatter': 'rustfmt',
        'analyzer': 'rust-analyzer',
        'completer': 'rust completers/rust_completer {code}'
    },
    'typescript': {
        'extension': '.ts',
        'command': 'ts-node {file}',
        'linter': 'eslint --format json --stdin',
        'formatter': 'prettier --stdin',
        'analyzer': 'tslint --format json',
        'completer': 'typescript completers/typescript_completer {code}'
    }
} 