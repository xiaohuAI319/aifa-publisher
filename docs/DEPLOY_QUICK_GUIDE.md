# 线上部署快速指南

本文档提供最常用的线上部署方案，适合快速上线使用。

## 📋 部署前准备

1. **服务器要求**
   - 操作系统：Ubuntu 22.04 LTS（推荐）
   - 配置：2核4G，带宽 3Mbps+
   - Node.js：v18 或更高版本

2. **域名准备**（可选）
   - 准备一个域名（如：`yourdomain.com`）
   - 配置 DNS A 记录指向服务器 IP

---

## 🚀 方案一：一键部署脚本（推荐）

### 步骤 1：上传代码到服务器

```bash
# 在本地打包项目
cd /path/to/aifa-publisher
tar -czf aifa-publisher.tar.gz server/ data/ editor/

# 上传到服务器
scp aifa-publisher.tar.gz root@your-server-ip:/opt/

# SSH 连接到服务器
ssh root@your-server-ip
```

### 步骤 2：解压并运行部署脚本

```bash
# 解压文件
cd /opt
mkdir -p aifa-publisher
tar -xzf aifa-publisher.tar.gz -C aifa-publisher/

# 进入服务器目录
cd aifa-publisher/server

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动：
- ✅ 检查 Node.js 版本
- ✅ 安装依赖
- ✅ 安装 Playwright 浏览器
- ✅ 使用 PM2 启动服务

### 步骤 3：配置 Nginx 反向代理

```bash
# 安装 Nginx
apt update && apt install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/aifa-publisher << 'EOF'
# 前端静态文件 + API 代理
server {
    listen 80;
    server_name yourdomain.com;  # 替换为你的域名

    # 前端静态文件
    root /opt/aifa-publisher/editor;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端服务
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置（Playwright 可能需要较长时间）
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/aifa-publisher /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
systemctl enable nginx
```

### 步骤 4：配置 SSL 证书（HTTPS）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置 Nginx）
certbot --nginx -d yourdomain.com

# 测试自动续期
certbot renew --dry-run
```

### 步骤 5：配置防火墙

```bash
# 允许必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# 查看状态
ufw status
```

---

## 🔧 方案二：手动部署（详细步骤）

### 1. 系统初始化

```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git vim

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version
```

### 2. 部署项目代码

```bash
# 创建项目目录
mkdir -p /opt/aifa-publisher
cd /opt/aifa-publisher

# 方式一：使用 Git（推荐）
git clone https://github.com/your-username/aifa-publisher.git .

# 方式二：上传文件
# 在本地打包后上传，然后解压
```

### 3. 安装依赖

```bash
cd /opt/aifa-publisher/server

# 安装 Node.js 依赖
npm install --production

# 安装 Playwright 浏览器
npx playwright install chromium
npx playwright install-deps chromium
```

### 4. 配置环境变量（可选）

```bash
cd /opt/aifa-publisher/server

# 创建 .env 文件
cat > .env << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
EOF

chmod 600 .env
```

### 5. 使用 PM2 启动服务

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd /opt/aifa-publisher/server
pm2 start xiaohongshu-server.js --name xiaohongshu

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs xiaohongshu
```

### 6. 配置 Nginx（同方案一步骤 3）

### 7. 配置 SSL（同方案一步骤 4）

### 8. 配置防火墙（同方案一步骤 5）

---

## ✅ 验证部署

### 1. 检查服务状态

```bash
# 检查 PM2 服务
pm2 status

# 检查服务健康
curl http://localhost:3001/health

# 检查 Nginx
systemctl status nginx

# 检查端口
netstat -tlnp | grep 3001
```

### 2. 访问测试

- 打开浏览器访问：`http://yourdomain.com`（或 `https://yourdomain.com`）
- 应该能看到编辑器页面
- 测试小红书登录和发布功能

---

## 🔍 常见问题

### 问题 1：服务无法启动

```bash
# 检查端口占用
lsof -i :3001

# 查看 PM2 日志
pm2 logs xiaohongshu --lines 50

# 检查 Node.js 版本
node --version
```

### 问题 2：无法访问前端

```bash
# 检查 Nginx 配置
nginx -t

# 查看 Nginx 日志
tail -f /var/log/nginx/error.log

# 检查文件权限
ls -la /opt/aifa-publisher/editor
```

### 问题 3：API 请求失败

```bash
# 检查后端服务
curl http://localhost:3001/health

# 检查 Nginx 代理配置
grep -A 10 "location /api" /etc/nginx/sites-available/aifa-publisher

# 查看浏览器控制台错误（F12）
```

### 问题 4：Playwright 问题

```bash
# 重新安装浏览器
cd /opt/aifa-publisher/server
npx playwright install chromium --force
npx playwright install-deps chromium
```

---

## 📝 维护命令

### PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs xiaohongshu

# 重启服务
pm2 restart xiaohongshu

# 停止服务
pm2 stop xiaohongshu

# 删除服务
pm2 delete xiaohongshu
```

### Nginx 常用命令

```bash
# 测试配置
nginx -t

# 重新加载配置
systemctl reload nginx

# 重启服务
systemctl restart nginx

# 查看日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔐 安全建议

1. **文件权限**
   ```bash
   chmod 600 /opt/aifa-publisher/data/xiaohongshu-cookies.json
   chmod 700 /opt/aifa-publisher/data
   ```

2. **定期备份**
   ```bash
   # 备份 Cookie 和配置
   tar -czf backup-$(date +%Y%m%d).tar.gz \
     /opt/aifa-publisher/data \
     /opt/aifa-publisher/server/.env
   ```

3. **系统更新**
   ```bash
   apt update && apt upgrade -y
   ```

---

## 📚 更多信息

- **详细部署方案**：查看 [ONLINE_DEPLOYMENT.md](./ONLINE_DEPLOYMENT.md)
- **本地开发**：查看 [LOCAL_DEV.md](./LOCAL_DEV.md)
- **项目说明**：查看 [README.md](./README.md)

---

## 🎉 部署完成！

部署成功后，你可以：
- ✅ 通过域名访问编辑器
- ✅ 使用小红书登录和发布功能
- ✅ 查看发布历史记录

如有问题，请查看日志或参考其他文档。

