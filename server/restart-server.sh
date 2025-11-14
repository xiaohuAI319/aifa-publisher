#!/bin/bash
# 小红书服务器重启脚本

echo "正在查找并停止旧服务器进程..."
pkill -f "node.*xiaohongshu-server.js" || echo "未找到运行中的服务器进程"

echo "等待2秒..."
sleep 2

echo "启动服务器..."
cd "$(dirname "$0")"
node xiaohongshu-server.js

