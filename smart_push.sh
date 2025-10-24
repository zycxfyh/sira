#!/bin/bash

# =================================================================
#
#           NEXUS-VERSE - 智能推送脚本 (Smart Push Script)
#
#   功能: 自动清理、提交并推送代码，专治“仓库太胖”和“推送失败”。
#
# =================================================================

# --- 脚本设置 ---
# 如果任何命令失败，脚本将立即退出
set -e

# --- 定义颜色，让输出更清晰 ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 启动 Nexus Verse 智能推送脚本...${NC}"

# --- 1. 安全检查 ---
# 检查当前目录是否是一个Git仓库
if [ ! -d ".git" ]; then
  echo -e "${RED}错误: 这里不是一个Git仓库。请在项目根目录运行此脚本。${NC}"
  exit 1
fi

echo -e "✅ 1/5: Git仓库检查通过。"

# --- 2. 确保 .gitignore 文件是完美的 ---
echo -e "${YELLOW}🔎 2/5: 正在检查和更新 .gitignore 文件...${NC}"
# 我们要确保这些大文件夹一定被忽略
MUST_IGNORE_DIRS=("node_modules/" "dist/" ".turbo/" "nexus-data/" ".devbox/")

for dir in "${MUST_IGNORE_DIRS[@]}"; do
  # grep -q: 静默模式检查。 ||: 如果没找到，则执行...
  grep -q "^${dir}$" .gitignore || echo "${dir}" >> .gitignore
done
echo -e "✅ .gitignore 文件已更新完毕。"

# --- 3. 执行“减肥手术” ---
echo -e "${YELLOW}🧹 3/5: 正在为Git仓库“瘦身”，请稍候...${NC}"
echo -e "       (这一步将让Git忘记所有不该追踪的大文件)"

# > /dev/null 2>&1 的作用是“别烦我，安静地执行”，不输出冗长的删除日志
git rm -r --cached . > /dev/null 2>&1
git add .
echo -e "✅ Git仓库瘦身完成！"

# --- 4. 交互式提交 ---
echo -e "${YELLOW}✍️  4/5: 准备提交...${NC}"

# 提示用户输入提交信息
read -p "请输入您的提交信息 (例如: 'feat: 添加新角色功能'): " COMMIT_MESSAGE

# 如果用户没输入任何东西，给一个默认值
if [ -z "$COMMIT_MESSAGE" ]; then
  COMMIT_MESSAGE="chore: Regular project update"
  echo -e "       (使用默认信息: ${COMMIT_MESSAGE})"
fi

# 执行提交
git commit -m "$COMMIT_MESSAGE"

# --- 5. 智能推送 ---
# 自动获取当前分支的名称
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${YELLOW}🛰️  5/5: 正在将代码推送到远程仓库的 '${CURRENT_BRANCH}' 分支...${NC}"

# 执行推送
git push -u origin "$CURRENT_BRANCH"

# --- 大功告成 ---
echo -e "\n${GREEN}🎉 恭喜！代码已成功推送到GitHub!${NC}"
echo -e "${GREEN}现在您的仓库非常干净，可以继续愉快地开发了。${NC}"