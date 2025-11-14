# 线上部署方案

本文档提供完整的线上生产环境部署方案。

## 部署架构

```
┌─────────────────────────────────────────┐
│  用户浏览器                                │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│  CDN / 静态托管                          │
│  (前端编辑器: editor/)                  │
│  - Cloudflare Pages                    │
│  - Vercel                              │
│  - 腾讯云 COS + CDN                     │
└──────────────┬──────────────────────────┘
               │ API 调用
               ▼
┌─────────────────────────────────────────┐
│  后端服务 (Node.js + Playwright)        │
│  - 云服务器 (ECS/轻量应用服务器)          │
│  - 容器服务 (Docker)                    │
│  - Serverless (云函数)                  │
└─────────────────────────────────────────┘
```

---

## 方案一：云服务器部署（推荐）

### 适用场景
- 需要长期稳定运行
- 需要完整控制权
- 成本可控

### 服务器选择

#### 阿里云 ECS
- **配置推荐**：2核4G，带宽 3Mbps
- **系统**：Ubuntu 22.04 LTS
- **价格**：约 ¥200-300/月

#### 腾讯云轻量应用服务器
- **配置推荐**：2核4G，带宽 5Mbps
- **系统**：Ubuntu 22.04 LTS
- **价格**：约 ¥288/年（活动价）

#### AWS EC2
- **实例类型**：t3.small (2 vCPU, 2GB RAM)
- **系统**：Amazon Linux 2023
- **价格**：约 $15-20/月

### 部署步骤

#### 1. 购买和配置服务器

```bash
# SSH 连接服务器
ssh root@your-server-ip
```

#### 2. 系统初始化

```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git vim

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node --version
npm --version
```

#### 3. 部署项目代码

**方式一：Git 克隆**

```bash
# 创建项目目录
mkdir -p /opt/aifa-publisher
cd /opt/aifa-publisher

# 克隆代码（需要配置 Git 仓库）
git clone https://github.com/your-username/aifa-publisher.git .

# 或使用私有仓库
git clone https://your-token@github.com/your-username/aifa-publisher.git .
```

**方式二：直接上传**

```bash
# 在本地打包
cd /path/to/aifa-publisher
tar -czf aifa-publisher.tar.gz server/ data/ editor/

# 上传到服务器
scp aifa-publisher.tar.gz root@your-server-ip:/opt/

# 在服务器解压
ssh root@your-server-ip
cd /opt
tar -xzf aifa-publisher.tar.gz -C aifa-publisher/
```

#### 4. 安装依赖和配置

```bash
cd /opt/aifa-publisher/server

# 安装依赖
npm install --production

# 安装 Playwright
npx playwright install chromium
npx playwright install-deps chromium

# 创建必要目录
mkdir -p ../data
chmod 700 ../data
```

#### 5. 配置环境变量

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

修改 `xiaohongshu-server.js` 支持环境变量：

```javascript
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`服务已启动: http://${HOST}:${PORT}`);
});
```

#### 6. 使用 PM2 管理服务

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

#### 7. 配置防火墙

```bash
# Ubuntu/Debian (ufw)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # 后端服务（如果直接暴露）
ufw enable

# 查看状态
ufw status
```

#### 8. 配置 Nginx 反向代理

```bash
# 安装 Nginx
apt install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/xiaohongshu << 'EOF'
# 后端 API 服务
server {
    listen 80;
    server_name api.yourdomain.com;  # 替换为你的域名

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
        
        # 超时设置（Playwright 可能需要较长时间）
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}

# 前端静态文件
server {
    listen 80;
    server_name yourdomain.com;  # 替换为你的域名

    root /opt/aifa-publisher/editor;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/xiaohongshu /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
systemctl enable nginx
```

#### 9. 配置 SSL 证书（HTTPS）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置 Nginx）
certbot --nginx -d yourdomain.com -d api.yourdomain.com

# 测试自动续期
certbot renew --dry-run

# 设置自动续期（crontab 已自动配置）
```

#### 10. 配置域名 DNS

在域名服务商添加 DNS 记录：

```
A 记录: yourdomain.com      -> 服务器IP
A 记录: api.yourdomain.com  -> 服务器IP
```

---

## 方案二：容器服务部署（Docker）

### 适用场景
- 需要快速部署和扩展
- 多环境一致性
- 容器化基础设施

### 使用 Docker Compose

#### 1. 创建 Dockerfile

`server/Dockerfile`:

```dockerfile
FROM node:18-slim

# 安装系统依赖（Playwright 需要）
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
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖文件
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制应用代码
COPY xiaohongshu-server.js ./
COPY playwright/ ./playwright/

# 安装 Playwright 浏览器
RUN npx playwright install chromium

# 创建数据目录
RUN mkdir -p /app/data && chmod 700 /app/data

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "xiaohongshu-server.js"]
```

#### 2. 创建 docker-compose.yml

项目根目录 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  xiaohongshu-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: xiaohongshu-api
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
      - ./server/.env:/app/.env:ro
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
    restart: unless-stopped
    networks:
      - aifa-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: xiaohongshu-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./editor:/usr/share/nginx/html:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - xiaohongshu-api
    restart: unless-stopped
    networks:
      - aifa-network

networks:
  aifa-network:
    driver: bridge
```

#### 3. 部署到云平台

**阿里云容器服务 ACK**:
```bash
# 构建镜像
docker build -t registry.cn-hangzhou.aliyuncs.com/your-namespace/xiaohongshu:latest ./server

# 推送镜像
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/xiaohongshu:latest

# 使用 kubectl 部署
kubectl apply -f k8s-deployment.yaml
```

**腾讯云容器服务 TKE**:
```bash
# 类似流程
docker build -t ccr.ccs.tencentyun.com/your-namespace/xiaohongshu:latest ./server
docker push ccr.ccs.tencentyun.com/your-namespace/xiaohongshu:latest
```

---

## 方案三：Serverless 部署（云函数）

### 适用场景
- 按需付费
- 无需管理服务器
- 自动扩缩容

### 腾讯云函数 SCF

#### 1. 创建云函数

由于 Playwright 需要浏览器环境，需要特殊处理：

```javascript
// index.js (云函数入口)
const { chromium } = require('playwright');

exports.main_handler = async (event, context) => {
  // 云函数需要特殊配置才能运行 Playwright
  // 建议使用自定义运行时或容器镜像
};
```

**注意**：Playwright 在 Serverless 环境需要：
- 自定义运行时（较大体积）
- 或使用容器镜像
- 或使用无头浏览器服务（如 Browserless）

### 推荐：使用 Browserless 服务

```javascript
// 使用 Browserless.io 或自建 Browserless 服务
const puppeteer = require('puppeteer-core');

const browser = await puppeteer.connect({
  browserWSEndpoint: 'wss://your-browserless-instance.com'
});
```

---

## 方案四：前端静态文件部署

### Cloudflare Pages（推荐，免费）

```bash
# 1. 安装 Wrangler CLI
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 部署前端
cd editor
wrangler pages deploy . --project-name=aifa-publisher
```

### Vercel（推荐，免费）

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 部署
cd editor
vercel --prod
```

### 腾讯云 COS + CDN

```bash
# 1. 安装 COS CLI
pip install coscmd

# 2. 配置
coscmd config -a <SecretId> -s <SecretKey> -b <Bucket> -r <Region>

# 3. 上传文件
cd editor
coscmd upload -r . /
```

### 阿里云 OSS + CDN

```bash
# 1. 安装 ossutil
wget https://gosspublic.alicdn.com/ossutil/1.7.14/ossutil64
chmod 755 ossutil64

# 2. 配置
./ossutil64 config

# 3. 上传
cd editor
./ossutil64 cp -r . oss://your-bucket/
```

---

## 完整部署示例：阿里云 ECS

### 步骤总结

```bash
# 1. 连接服务器
ssh root@your-server-ip

# 2. 初始化环境
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx

# 3. 部署代码
cd /opt
git clone https://github.com/your-username/aifa-publisher.git
cd aifa-publisher/server
npm install --production
npx playwright install chromium

# 4. 配置环境变量
cat > .env << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
EOF

# 5. 启动服务
npm install -g pm2
pm2 start xiaohongshu-server.js --name xiaohongshu
pm2 startup
pm2 save

# 6. 配置 Nginx（见上文）

# 7. 配置 SSL
certbot --nginx -d yourdomain.com

# 8. 配置 DNS（在域名服务商）
# A 记录: yourdomain.com -> 服务器IP
```

### 修改前端 API 地址

编辑 `editor/session-service.js`:

```javascript
// 根据环境自动切换
const XIAOHONGSHU_API_BASE = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api'
    : 'https://api.yourdomain.com/api';  // 线上地址
```

---

## 成本估算

### 方案一：云服务器
- **服务器**：¥200-300/月（2核4G）
- **域名**：¥50-100/年
- **SSL证书**：免费（Let's Encrypt）
- **总计**：约 ¥2500-3700/年

### 方案二：容器服务
- **容器服务**：¥300-500/月
- **负载均衡**：¥50-100/月
- **总计**：约 ¥4200-7200/年

### 方案三：Serverless
- **云函数**：按调用次数计费
- **API网关**：按请求数计费
- **总计**：约 ¥100-500/月（取决于使用量）

### 方案四：静态托管
- **Cloudflare Pages**：免费
- **Vercel**：免费（个人项目）
- **COS/OSS**：¥10-50/月（存储+流量）

---

## 监控和运维

### 使用 PM2 Plus（免费）

```bash
# 注册 PM2 Plus
pm2 link <secret-key> <public-key>

# 查看监控面板
pm2 plus
```

### 日志管理

```bash
# PM2 日志
pm2 logs xiaohongshu --lines 100

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 系统日志
journalctl -u nginx -f
```

### 备份策略

```bash
# 创建备份脚本
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/aifa-publisher-$DATE.tar.gz \
  /opt/aifa-publisher/data \
  /opt/aifa-publisher/server/.env
# 保留最近7天的备份
find /backup -name "aifa-publisher-*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup.sh

# 添加到 crontab（每天凌晨2点备份）
crontab -e
# 添加: 0 2 * * * /opt/backup.sh
```

---

## 安全建议

1. **防火墙配置**：只开放必要端口
2. **SSL 证书**：强制 HTTPS
3. **文件权限**：Cookie 文件设置 600 权限
4. **定期更新**：系统和依赖包
5. **访问控制**：使用 Nginx 限制访问频率
6. **日志审计**：定期检查访问日志

---

## 故障排查

### 服务无法访问

```bash
# 检查服务状态
pm2 status
systemctl status nginx

# 检查端口
netstat -tlnp | grep 3001

# 检查防火墙
ufw status
```

### Playwright 问题

```bash
# 重新安装浏览器
cd /opt/aifa-publisher/server
npx playwright install chromium --force

# 检查依赖
npx playwright install-deps chromium
```

---

## 推荐方案

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 个人项目 | 云服务器 + PM2 | 成本低、控制权高 |
| 小团队 | 云服务器 + Nginx | 稳定、易维护 |
| 企业级 | 容器服务 + K8s | 可扩展、高可用 |
| 快速上线 | Serverless + 静态托管 | 零运维、按需付费 |

---

需要帮助？查看：
- [README.md](./README.md) - 项目说明
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 本地部署
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 测试指南

