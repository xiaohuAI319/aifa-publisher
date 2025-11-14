# 部署指南

本文档介绍如何部署小红书发布服务到不同环境。

## 部署方案概览

- **方案一：本地后台运行**（推荐个人使用）
- **方案二：云服务器部署**（推荐团队使用）
- **方案三：Docker 容器部署**（推荐生产环境）
- **方案四：系统服务自启动**（推荐长期运行）

---

## 方案一：本地后台运行（PM2）

### 适用场景
- 个人电脑使用
- 需要服务在后台持续运行
- 需要自动重启和日志管理

### 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2
```

### 启动服务

```bash
cd server

# 启动服务
pm2 start xiaohongshu-server.js --name xiaohongshu

# 查看状态
pm2 status

# 查看日志
pm2 logs xiaohongshu

# 停止服务
pm2 stop xiaohongshu

# 重启服务
pm2 restart xiaohongshu

# 删除服务
pm2 delete xiaohongshu
```

### 开机自启动

```bash
# 保存当前 PM2 进程列表
pm2 save

# 设置开机自启动（macOS/Linux）
pm2 startup

# 按照提示执行生成的命令
```

### PM2 常用命令

```bash
# 监控面板
pm2 monit

# 查看详细信息
pm2 show xiaohongshu

# 查看实时日志
pm2 logs xiaohongshu --lines 100

# 清空日志
pm2 flush
```

---

## 方案二：云服务器部署

### 适用场景
- 团队协作
- 需要远程访问
- 24/7 运行

### 服务器要求

- **操作系统**：Linux (Ubuntu 20.04+ / CentOS 7+)
- **Node.js**：v18 或更高版本
- **内存**：至少 1GB（推荐 2GB+）
- **磁盘**：至少 10GB 可用空间

### 部署步骤

#### 1. 连接服务器

```bash
ssh user@your-server-ip
```

#### 2. 安装 Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### 3. 上传项目文件

```bash
# 在本地执行（使用 scp）
scp -r server/ user@your-server-ip:/opt/aifa-publisher/
scp -r data/ user@your-server-ip:/opt/aifa-publisher/
scp package.json user@your-server-ip:/opt/aifa-publisher/server/

# 或使用 Git
git clone your-repo-url
cd aifa-publisher
```

#### 4. 安装依赖

```bash
cd /opt/aifa-publisher/server
npm install --production
npx playwright install chromium
```

#### 5. 配置环境变量（可选）

创建 `.env` 文件：

```bash
cd /opt/aifa-publisher/server
cat > .env << EOF
PORT=3001
NODE_ENV=production
EOF
```

修改 `xiaohongshu-server.js` 读取环境变量：

```javascript
const PORT = process.env.PORT || 3001;
```

#### 6. 使用 PM2 启动

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start xiaohongshu-server.js --name xiaohongshu

# 设置开机自启
pm2 startup
pm2 save
```

#### 7. 配置防火墙

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3001/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

#### 8. 配置 Nginx 反向代理（推荐）

安装 Nginx：

```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx
```

创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/xiaohongshu
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/xiaohongshu /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# CentOS/RHEL
sudo cp /etc/nginx/sites-available/xiaohongshu /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl restart nginx
```

#### 9. 配置 SSL（HTTPS，可选）

使用 Let's Encrypt：

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx  # Ubuntu/Debian
sudo yum install certbot python3-certbot-nginx      # CentOS/RHEL

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 方案三：Docker 容器部署

### 适用场景
- 需要环境隔离
- 快速部署和迁移
- 容器化环境

### 创建 Dockerfile

在 `server/` 目录创建 `Dockerfile`：

```dockerfile
FROM node:18-slim

# 安装 Playwright 依赖
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制文件
COPY package.json ./
COPY xiaohongshu-server.js ./
COPY playwright/ ./playwright/

# 安装依赖
RUN npm install --production

# 安装 Playwright
RUN npx playwright install chromium

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "xiaohongshu-server.js"]
```

### 创建 docker-compose.yml

在项目根目录创建：

```yaml
version: '3.8'

services:
  xiaohongshu-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: xiaohongshu-publisher
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
    networks:
      - aifa-network

networks:
  aifa-network:
    driver: bridge
```

### 构建和运行

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 方案四：系统服务自启动（systemd）

### 适用场景
- Linux 服务器
- 需要系统级服务管理
- 开机自动启动

### 创建 systemd 服务文件

```bash
sudo nano /etc/systemd/system/xiaohongshu.service
```

内容：

```ini
[Unit]
Description=Xiaohongshu Publisher Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/opt/aifa-publisher/server
ExecStart=/usr/bin/node /opt/aifa-publisher/server/xiaohongshu-server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=xiaohongshu

Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

### 启用服务

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start xiaohongshu

# 设置开机自启
sudo systemctl enable xiaohongshu

# 查看状态
sudo systemctl status xiaohongshu

# 查看日志
sudo journalctl -u xiaohongshu -f
```

### macOS 使用 launchd

创建 `~/Library/LaunchAgents/com.aifa.xiaohongshu.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aifa.xiaohongshu</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/aifa-publisher/server/xiaohongshu-server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/aifa-publisher/server</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/xiaohongshu.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/xiaohongshu.error.log</string>
</dict>
</plist>
```

加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.aifa.xiaohongshu.plist
launchctl start com.aifa.xiaohongshu
```

---

## 前端部署

### 静态文件部署

前端编辑器是纯静态文件，可以部署到：

1. **Nginx**
2. **Apache**
3. **云存储**（OSS、S3）
4. **CDN**（Cloudflare、Vercel）

### 修改 API 地址

部署后需要修改前端调用的 API 地址：

编辑 `editor/session-service.js`：

```javascript
// 开发环境
const XIAOHONGSHU_API_BASE = 'http://localhost:3001/api';

// 生产环境（根据实际部署地址修改）
const XIAOHONGSHU_API_BASE = process.env.API_BASE_URL || 'https://your-domain.com/api';
```

或使用环境变量：

```javascript
const XIAOHONGSHU_API_BASE = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api'
    : 'https://api.your-domain.com/api';
```

---

## 安全建议

### 1. 使用 HTTPS

- 配置 SSL 证书
- 强制 HTTPS 重定向

### 2. 配置防火墙

```bash
# 只允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 3. 保护 Cookie 文件

```bash
# 设置文件权限
chmod 600 data/xiaohongshu-cookies.json
chmod 700 data/
```

### 4. 使用环境变量

敏感信息不要硬编码，使用环境变量：

```bash
# .env 文件
PORT=3001
NODE_ENV=production
SECRET_KEY=your-secret-key
```

### 5. 定期备份

```bash
# 备份 Cookie 文件
cp data/xiaohongshu-cookies.json data/xiaohongshu-cookies.json.backup
```

---

## 监控和维护

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3001/health

# 检查进程
ps aux | grep node
```

### 日志管理

```bash
# PM2 日志
pm2 logs xiaohongshu --lines 100

# systemd 日志
sudo journalctl -u xiaohongshu -f

# Docker 日志
docker-compose logs -f
```

### 性能监控

使用 PM2 监控：

```bash
pm2 monit
```

或使用专业监控工具：
- **PM2 Plus**（免费）
- **New Relic**
- **Datadog**

---

## 故障排查

### 服务无法启动

1. 检查端口占用：`lsof -i :3001`
2. 检查日志：查看错误信息
3. 检查依赖：`npm install`
4. 检查 Node.js 版本：`node --version`

### 无法访问服务

1. 检查防火墙规则
2. 检查服务是否运行
3. 检查网络连接
4. 检查 CORS 配置

### Playwright 问题

```bash
# 重新安装浏览器
npx playwright install chromium --force

# 检查浏览器路径
npx playwright --version
```

---

## 推荐部署方案

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 个人使用 | PM2 本地运行 | 简单、快速 |
| 团队使用 | 云服务器 + PM2 | 稳定、可访问 |
| 生产环境 | Docker + Nginx | 隔离、可扩展 |
| 长期运行 | systemd/launchd | 系统级管理 |

---

## 快速部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash

echo "开始部署小红书发布服务..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    exit 1
fi

# 安装依赖
cd server
npm install --production

# 安装 Playwright
npx playwright install chromium

# 启动服务（使用 PM2）
if command -v pm2 &> /dev/null; then
    pm2 start xiaohongshu-server.js --name xiaohongshu
    pm2 save
    echo "服务已启动，使用 'pm2 status' 查看状态"
else
    echo "未安装 PM2，使用 'npm start' 启动服务"
fi

echo "部署完成！"
```

使用：

```bash
chmod +x deploy.sh
./deploy.sh
```

---

需要帮助？查看：
- [README.md](./README.md) - 项目说明
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 测试指南
- [QUICK_START.md](./QUICK_START.md) - 快速开始

