#!/bin/bash

/**
 * 小红书发布服务部署脚本
 * 
 * 功能说明：
 * 1. 检查运行环境（Node.js、npm）
 * 2. 安装项目依赖
 * 3. 安装 Playwright 浏览器
 * 4. 启动服务（优先使用 PM2，否则使用普通方式）
 * 
 * 使用方法：
 *   bash deploy.sh
 *   或
 *   chmod +x deploy.sh && ./deploy.sh
 * 
 * 注意事项：
 * - 需要 Node.js 18+ 版本
 * - 建议安装 PM2 进行进程管理
 * - 首次运行会自动安装依赖和 Playwright
 */

# 设置脚本执行模式：遇到错误立即退出
set -e

# 输出部署脚本标题
echo "======================================"
echo "小红书发布服务 - 快速部署"
echo "======================================"
echo ""

# ============================================
# 环境检查：Node.js
# ============================================
# 检查系统中是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请先安装 Node.js 18+ 版本"
    exit 1
fi

# 提取 Node.js 主版本号（例如：v18.0.0 -> 18）
# 使用 cut 命令：-d'v' 表示以 'v' 为分隔符，-f2 取第二部分，再以 '.' 分隔取第一部分
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

# 检查 Node.js 版本是否满足要求（需要 18 或更高）
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低（当前: $(node --version)）"
    echo "需要 Node.js 18 或更高版本"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# ============================================
# 环境检查：npm
# ============================================
# 检查系统中是否安装了 npm（Node.js 包管理器）
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm --version)"
echo ""

# ============================================
# 安装项目依赖
# ============================================
# 使用 --production 参数只安装生产环境依赖（不安装 devDependencies）
echo "📦 安装依赖..."
npm install --production

# 检查上一个命令的退出状态码
# $? 表示上一个命令的退出状态，0 表示成功，非0 表示失败
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"
echo ""

# ============================================
# 安装 Playwright 浏览器
# ============================================
# Playwright 需要下载浏览器二进制文件才能运行自动化脚本
# 这里只安装 Chromium 浏览器（小红书发布使用）
echo "🌐 安装 Playwright 浏览器..."
npx playwright install chromium

# Playwright 安装失败不影响服务启动（可以后续手动安装）
if [ $? -ne 0 ]; then
    echo "⚠️  Playwright 安装失败，但可以继续"
fi

echo "✅ Playwright 安装完成"
echo ""

# ============================================
# 启动服务
# ============================================
# 优先使用 PM2 进程管理器（推荐），提供进程守护、日志管理等功能
if command -v pm2 &> /dev/null; then
    echo "🚀 使用 PM2 启动服务..."
    
    # 使用 PM2 启动服务
    # --name xiaohongshu: 为进程指定名称，方便管理
    pm2 start xiaohongshu-server.js --name xiaohongshu
    
    # 保存 PM2 进程列表，确保服务器重启后自动恢复
    pm2 save
    
    echo ""
    echo "✅ 服务已启动！"
    echo ""
    echo "常用命令："
    echo "  查看状态: pm2 status          # 查看所有 PM2 管理的进程状态"
    echo "  查看日志: pm2 logs xiaohongshu # 查看服务运行日志"
    echo "  停止服务: pm2 stop xiaohongshu # 停止服务"
    echo "  重启服务: pm2 restart xiaohongshu # 重启服务"
    echo ""
    
    # 检查是否已设置开机自启动
    # pm2 startup 会输出配置信息，如果包含 "already" 说明已配置
    if ! pm2 startup | grep -q "already"; then
        echo "💡 提示: 运行 'pm2 startup' 设置开机自启动"
    fi
else
    # 如果未安装 PM2，提供普通启动方式
    echo "⚠️  未安装 PM2，使用普通方式启动"
    echo ""
    echo "安装 PM2: npm install -g pm2    # 全局安装 PM2（推荐）"
    echo "启动服务: npm start              # 使用 npm 脚本启动"
    echo ""
    echo "或者直接运行: node xiaohongshu-server.js  # 直接运行 Node.js 脚本"
fi

# ============================================
# 部署完成提示
# ============================================
echo "======================================"
echo "部署完成！"
echo "======================================"
echo ""
echo "服务地址: http://localhost:3001      # 服务运行的地址"
echo "健康检查: curl http://localhost:3001/health  # 检查服务是否正常运行"
echo ""

