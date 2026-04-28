# 使用 GitHub CLI（gh）推送到主线 `main`（PowerShell / Windows）

> 适用仓库：`ZeroIsle_Notes`  
> 目标：用 `gh` 做认证/仓库校验，用 `git push` 完成代码推送（`gh` 本身不替代 `git push`）。

## 1. 前置条件

### 必须安装
- **Git**：确保命令行可用 `git --version`
- **GitHub CLI**：确保命令行可用 `gh --version`

### 必须完成登录（一次即可）
在仓库目录执行：

```powershell
gh auth status -h github.com
```

若提示未登录，执行交互式登录（推荐 HTTPS）：

```powershell
gh auth login -h github.com
```

建议选择：
- Account：GitHub.com
- Protocol：HTTPS
- Authenticate：Browser（最省事）

## 2. 推送前的“最小安全检查”（强烈建议）

### 2.1 检查当前分支与工作区状态
```powershell
git status
git branch --show-current
```

建议推送到主线 `main` 前保证：
- 工作区干净（没有未提交的改动）
- 当前分支就是 `main`（或你明确知道自己在做什么）

### 2.2 确认远端是 GitHub 仓库
```powershell
git remote -v
```

如果 `origin` 不是 GitHub 地址，先修正远端（示例）：
```powershell
git remote set-url origin https://github.com/<OWNER>/<REPO>.git
```

## 3. 推荐流程：同步主线 → 再推送

### 3.1 切到 `main` 并拉取最新
```powershell
git fetch origin
git checkout main
git pull --rebase origin main
```

说明：
- 用 `--rebase` 能减少无意义的 merge commit（除非团队明确禁用 rebase）。

### 3.2 提交你的改动（如尚未提交）
```powershell
git add -A
git commit -m "chore: update"
```

### 3.3 推送到主线 `main`
```powershell
git push origin main
```

> 注意：本仓库 GitHub Actions 在 `push` 到 `main` 时可能触发 CI/CD（例如 Docker 构建与推送）。推送前确认你确实要触发这些动作。

## 4. 用脚本“一键推送”（写入项目规则/配置）

本仓库提供了脚本：`scripts/git/push-main.ps1`  
它会做以下事情：
- 检查 `gh` 是否已登录
- 检查工作区是否干净（可选跳过）
- `fetch` + `checkout main` + `pull --rebase`
- `push origin main`（支持 dry-run）

### 4.1 最常用用法
```powershell
powershell -ExecutionPolicy RemoteSigned -File scripts/git/push-main.ps1
```

### 4.2 先演练（不真正推送）
```powershell
powershell -ExecutionPolicy RemoteSigned -File scripts/git/push-main.ps1 -DryRun
```

### 4.3 允许在存在本地改动时继续（不推荐）
```powershell
powershell -ExecutionPolicy RemoteSigned -File scripts/git/push-main.ps1 -SkipStatusCheck
```

如果你明确知道本地工作区是脏的，但仍想避免 `pull/rebase` 失败，可以显式跳过拉取：
```powershell
powershell -ExecutionPolicy RemoteSigned -File scripts/git/push-main.ps1 -SkipStatusCheck -SkipPull
```

## 5. 常见问题（FAQ）

### Q1：为什么说“用 gh 推送”但还是 `git push`？
`gh` 的定位是 **GitHub 工作流工具**（认证、仓库信息、issue/pr、release 等）。  
代码推送仍由 Git 完成（`git push`）。我们用 `gh` 来保证“你推送到的确实是 GitHub、且登录状态正常”，避免推送前才发现权限/认证问题。

### Q2：推送到 main 失败：protected branch
如果仓库开启了 `main` 分支保护，你可能需要走 PR 流程（`gh pr create`）。  
此时不要强行绕过保护规则，按仓库策略操作。
