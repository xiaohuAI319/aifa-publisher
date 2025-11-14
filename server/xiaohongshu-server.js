import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startLoginSession,
  checkLoginStatus,
  publishToXiaohongshu
} from './playwright/xiaohongshu-publish.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 中间件
app.use(cors()); // 允许跨域
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 账号配置文件路径
const ACCOUNTS_FILE = path.join(__dirname, '../data/xiaohongshu-accounts.json');

/**
 * 读取账号列表
 * @returns {Promise<Array>} 账号列表
 */
async function readAccounts() {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取账号列表失败:', error);
    return [];
  }
}

// ==================== API路由 ====================

/**
 * GET /api/accounts
 * 获取小红书账号列表
 */
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await readAccounts();
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('获取账号列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/login/status
 * 查询登录状态
 * Query参数: accountId
 */
app.get('/api/login/status', async (req, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '缺少accountId参数' });
    }

    const status = await checkLoginStatus(accountId);
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('查询登录状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/login/start
 * 启动扫码登录会话
 * Body参数: { accountId }
 */
app.post('/api/login/start', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '缺少accountId参数' });
    }

    const result = await startLoginSession(accountId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('启动登录会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/publish
 * 发布内容到小红书
 * Body参数: taskPayload
 */
app.post('/api/publish', async (req, res) => {
  try {
    const taskPayload = req.body;
    
    if (!taskPayload || !taskPayload.payload) {
      return res.status(400).json({ success: false, error: '缺少发布任务数据' });
    }

    const result = await publishToXiaohongshu(taskPayload);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('发布失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'xiaohongshu-publisher', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n====================================`);
  console.log(`小红书发布服务已启动`);
  console.log(`监听端口: http://localhost:${PORT}`);
  console.log(`====================================\n`);
  console.log(`可用接口:`);
  console.log(`  GET  /api/accounts        - 获取账号列表`);
  console.log(`  GET  /api/login/status    - 查询登录状态`);
  console.log(`  POST /api/login/start     - 启动扫码登录`);
  console.log(`  POST /api/publish         - 发布内容`);
  console.log(`  GET  /health              - 健康检查`);
  console.log(`\n====================================\n`);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

