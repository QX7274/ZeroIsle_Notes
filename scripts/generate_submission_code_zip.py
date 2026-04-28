from __future__ import annotations

import zipfile
from pathlib import Path


ROOT = Path(r"D:\ZeroIsle_Notes")
OUTPUT_DIR = ROOT / "output" / "结题材料_20260330"
ZIP_PATH = OUTPUT_DIR / "零屿笔记_核心代码_提交版_20260330.zip"


ROOT_FILES = [
    "README.md",
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "index.js",
    "app.json",
    "babel.config.js",
    "metro.config.js",
    "jest.config.js",
    "tsconfig.json",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "electron-builder.yml",
    "requirements.txt",
    "pytest.ini",
    ".env.example",
    ".eslintrc.js",
    ".eslintignore",
    ".prettierrc.js",
]

ROOT_DIRS = [
    "src",
    "backend",
    "android",
    "ios",
    "web",
    "Info",
    "docs",
    "admin_system",
    "electron",
    "e2e",
    "scripts",
]

EXCLUDED_DIR_NAMES = {
    "node_modules",
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".idea",
    ".cursor",
    ".qoder",
    ".bundle",
    ".vscode",
    ".gradle",
    "backups",
    "archive",
    "build",
    "Pods",
    "DerivedData",
    "output",
    "tmp",
    "zeroislenotes_local.realm.management",
}

EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".log",
    ".tmp",
    ".lock",
    ".apk",
    ".aab",
    ".hprof",
}

EXCLUDED_FILE_NAMES = {
    ".env",
    "zeroislenotes_local.realm",
    "zeroislenotes_local.realm.lock",
}


def should_include(path: Path) -> bool:
    if path.name in EXCLUDED_FILE_NAMES:
        return False
    if any(part in EXCLUDED_DIR_NAMES for part in path.parts):
        return False
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    if path.name.startswith("~$"):
        return False
    return True


def iter_included_files(base: Path):
    for path in base.rglob("*"):
        if path.is_file() and should_include(path):
            yield path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_name in ROOT_FILES:
            path = ROOT / file_name
            if path.exists() and path.is_file() and should_include(path):
                zf.write(path, arcname=file_name)
                count += 1

        for dir_name in ROOT_DIRS:
            base = ROOT / dir_name
            if not base.exists():
                continue
            for path in iter_included_files(base):
                zf.write(path, arcname=str(path.relative_to(ROOT)))
                count += 1

    print(f"ZIP={ZIP_PATH}")
    print(f"COUNT={count}")
    print(f"SIZE_MB={ZIP_PATH.stat().st_size / (1024 * 1024):.2f}")


if __name__ == "__main__":
    main()
