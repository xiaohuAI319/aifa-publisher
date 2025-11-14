import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cookie存储文件路径
const COOKIES_FILE = path.join(__dirname, '../../data/xiaohongshu-cookies.json');

/**
 * 读取Cookie存储文件
 * @returns {Promise<Object>} Cookie数据
 */
async function readCookies() {
  try {
    const data = await fs.readFile(COOKIES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取Cookie文件失败:', error);
    return {};
  }
}

/**
 * 保存Cookie到存储文件
 * @param {string} accountId - 账号ID
 * @param {Array} cookies - Cookie数组
 */
async function saveCookies(accountId, cookies) {
  try {
    const allCookies = await readCookies();
    allCookies[accountId] = {
      cookies,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
    };
    await fs.writeFile(COOKIES_FILE, JSON.stringify(allCookies, null, 2));
    console.log(`Cookie已保存，账号: ${accountId}`);
  } catch (error) {
    console.error('保存Cookie失败:', error);
    throw error;
  }
}

/**
 * 启动小红书登录流程
 * @param {string} accountId - 账号ID
 * @returns {Promise<Object>} 登录会话信息
 */
export async function startLoginSession(accountId) {
  console.log(`启动小红书登录会话，账号: ${accountId}`);
  
  const browser = await chromium.launch({
    headless: false, // 显示浏览器窗口供用户扫码
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    
    // 访问小红书创作中心登录页
    await page.goto('https://creator.xiaohongshu.com/login', {
      waitUntil: 'networkidle'
    });

    console.log('等待用户扫码登录...');
    
    // 生成会话令牌
    const sessionToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 等待登录成功（检测URL变化或特定元素出现）
    await page.waitForURL('**/creator.xiaohongshu.com/**', { timeout: 120000 }); // 2分钟超时

    // 登录成功，获取Cookie
    const cookies = await context.cookies();
    await saveCookies(accountId, cookies);

    console.log('登录成功，Cookie已保存');

    await browser.close();

    return {
      success: true,
      sessionToken,
      accountId,
      message: '登录成功'
    };
  } catch (error) {
    console.error('登录失败:', error);
    await browser.close();
    throw error;
  }
}

/**
 * 检查登录状态
 * @param {string} accountId - 账号ID
 * @returns {Promise<Object>} 登录状态
 */
export async function checkLoginStatus(accountId) {
  const allCookies = await readCookies();
  const accountCookies = allCookies[accountId];

  if (!accountCookies || !accountCookies.cookies || accountCookies.cookies.length === 0) {
    return { status: 'expired', accountId };
  }

  // 检查Cookie是否过期
  const expiresAt = new Date(accountCookies.expires_at);
  if (expiresAt < new Date()) {
    return { status: 'expired', accountId };
  }

  return {
    status: 'active',
    accountId,
    expiresAt: accountCookies.expires_at
  };
}

/**
 * 发布内容到小红书
 * @param {Object} taskPayload - 发布任务数据
 * @returns {Promise<Object>} 发布结果
 */
export async function publishToXiaohongshu(taskPayload) {
  console.log('开始发布到小红书:', taskPayload);

  const { payload } = taskPayload;
  const { title, content, tags = [], accountId = 'account_1' } = payload;

  // 读取账号Cookie
  const allCookies = await readCookies();
  const accountCookies = allCookies[accountId];

  if (!accountCookies || !accountCookies.cookies) {
    throw new Error('未找到登录Cookie，请先登录');
  }

  const browser = await chromium.launch({
    headless: false, // 可以改为true以后台运行
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 添加Cookie
    await context.addCookies(accountCookies.cookies);

    const page = await context.newPage();

    // 访问小红书发布页面
    await page.goto('https://creator.xiaohongshu.com/publish/publish', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('已打开发布页面');

    // 等待页面加载完成
    await page.waitForTimeout(2000);

    // 填写标题
    const titleSelector = 'input[placeholder*="标题"], input[placeholder*="填写标题"]';
    await page.waitForSelector(titleSelector, { timeout: 10000 });
    await page.fill(titleSelector, title);
    console.log('标题已填写:', title);

    // 填写内容
    const contentSelector = 'textarea[placeholder*="正文"], div[contenteditable="true"]';
    await page.waitForSelector(contentSelector, { timeout: 10000 });
    await page.fill(contentSelector, content);
    console.log('内容已填写');

    // 添加标签（如果有）
    if (tags.length > 0) {
      try {
        const tagSelector = 'input[placeholder*="标签"], input[placeholder*="话题"]';
        const tagInput = await page.$(tagSelector);
        if (tagInput) {
          for (const tag of tags) {
            await tagInput.fill(`#${tag}`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
          }
          console.log('标签已添加:', tags);
        }
      } catch (error) {
        console.warn('添加标签失败:', error.message);
      }
    }

    // 等待用户手动点击发布按钮
    // 注意：实际自动点击发布可能需要更复杂的逻辑和风险控制
    console.log('内容已填充完成，等待用户确认发布...');
    
    // 可选：自动点击发布按钮（需谨慎使用）
    // const publishButtonSelector = 'button:has-text("发布"), button:has-text("立即发布")';
    // await page.click(publishButtonSelector);

    // 等待一段时间让用户确认
    await page.waitForTimeout(10000);

    await browser.close();

    return {
      success: true,
      message: '内容已填充，请手动确认发布',
      url: 'https://creator.xiaohongshu.com/publish/publish'
    };
  } catch (error) {
    console.error('发布失败:', error);
    await browser.close();
    throw error;
  }
}

