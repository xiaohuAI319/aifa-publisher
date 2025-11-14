#!/bin/bash

# 小红书发布服务部署脚本

set -e

echo "======================================"
echo "小红书发布服务 - 快速部署"
echo "======================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请先安装 Node.js 18+ 版本"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低（当前: $(node --version)）"
    echo "需要 Node.js 18 或更高版本"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm --version)"
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"
echo ""

# 安装 Playwright
echo "🌐 安装 Playwright 浏览器..."
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo "⚠️  Playwright 安装失败，但可以继续"
fi

echo "✅ Playwright 安装完成"
echo ""

# 检查 PM2
if command -v pm2 &> /dev/null; then
    echo "🚀 使用 PM2 启动服务..."
    pm2 start xiaohongshu-server.js --name xiaohongshu
    pm2 save
    
    echo ""
    echo "✅ 服务已启动！"
    echo ""
    echo "常用命令："
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs xiaohongshu"
    echo "  停止服务: pm2 stop xiaohongshu"
    echo "  重启服务: pm2 restart xiaohongshu"
    echo ""
    
    # 检查是否已设置开机自启
    if ! pm2 startup | grep -q "already"; then
        echo "💡 提示: 运行 'pm2 startup' 设置开机自启动"
    fi
else
    echo "⚠️  未安装 PM2，使用普通方式启动"
    echo ""
    echo "安装 PM2: npm install -g pm2"
    echo "启动服务: npm start"
    echo ""
    echo "或者直接运行: node xiaohongshu-server.js"
fi

echo "======================================"
echo "部署完成！"
echo "======================================"
echo ""
echo "服务地址: http://localhost:3001"
echo "健康检查: curl http://localhost:3001/health"
echo ""

