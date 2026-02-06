# Git Commit 自动生成工具推荐

## 1. **Commitizen**（最推荐）
最流行的交互式 commit 工具，遵循 Conventional Commits 规范。

### 安装：
```bash
npm install --save-dev commitizen cz-conventional-changelog
```

### 配置 `package.json`：
```json
{
  "config": {
    "commitizen": {
      "path": "cz-conventional-changelog"
    }
  },
  "scripts": {
    "commit": "cz"
  }
}
```

### 使用：
```bash
npm run commit
# 或
npx cz
```

## 2. **Git Commit Message Generator (AI)**
使用 AI 生成 commit message 的工具。

### 选项 A: **git-commit-msg-linter**（本地）
```bash
npm install --save-dev git-commit-msg-linter
```

### 选项 B: **GitLens** (VS Code 扩展)
- 在 VS Code 中安装 GitLens 扩展
- 使用 AI 功能生成 commit message

## 3. **Gitmoji CLI**
为 commit message 添加 emoji，让 commit 更直观。

```bash
npm install -g gitmoji-cli
gitmoji -c
```

## 4. **Cursor 内置功能**
Cursor 本身支持 AI 生成 commit message：
- 在 Source Control 面板中，点击 "Generate Commit Message" 按钮
- 或使用快捷键（如果有配置）

## 5. **自定义脚本（最简单）**
创建一个简单的脚本来自动生成 commit message：

### `scripts/git-commit.sh`:
```bash
#!/bin/bash
# 获取 git diff 的简短摘要
CHANGES=$(git diff --cached --stat | tail -1)
# 生成简单的 commit message
echo "feat: $CHANGES" | git commit -F -
```

## 推荐方案
对于你的项目，我推荐使用 **Commitizen**，因为：
1. ✅ 标准化 commit 格式（feat/fix/docs/style/refactor/test/chore）
2. ✅ 自动生成 CHANGELOG
3. ✅ 团队协作友好
4. ✅ 与 CI/CD 工具兼容

需要我帮你配置 Commitizen 吗？
