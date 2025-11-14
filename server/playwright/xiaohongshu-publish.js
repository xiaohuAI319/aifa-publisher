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
    console.log('正在打开登录页面...');
    await page.goto('https://creator.xiaohongshu.com/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面加载完成
    await page.waitForTimeout(2000);

    console.log('页面已加载，检查是否需要切换到扫码登录...');
    
    // 尝试切换到扫码登录（如果当前是用户名登录）
    try {
      // 查找"扫码登录"相关的按钮或链接
      // 可能的选择器：包含"扫码"、"二维码"等文本的按钮
      const qrLoginSelectors = [
        'button:has-text("扫码登录")',
        'button:has-text("二维码登录")',
        'a:has-text("扫码登录")',
        'a:has-text("二维码登录")',
        '[class*="qr"]',
        '[class*="scan"]',
        'button[aria-label*="扫码"]',
        'button[aria-label*="二维码"]'
      ];

      let qrButtonFound = false;
      for (const selector of qrLoginSelectors) {
        try {
          const qrButton = await page.$(selector);
          if (qrButton) {
            const isVisible = await qrButton.isVisible();
            if (isVisible) {
              console.log(`找到扫码登录按钮: ${selector}`);
              await qrButton.click();
              await page.waitForTimeout(1000); // 等待切换动画
              qrButtonFound = true;
              break;
            }
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!qrButtonFound) {
        console.log('未找到扫码登录按钮，可能已经是扫码登录页面');
      }
    } catch (error) {
      console.log('切换扫码登录时出错（可能已经是扫码页面）:', error.message);
    }

    console.log('等待用户扫码登录...');
    console.log('提示：请使用小红书APP扫描页面上的二维码完成登录');
    
    // 生成会话令牌
    const sessionToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 等待登录成功 - 检测URL变化到非登录页面
    // 登录成功后，URL会从 /login 变为其他页面（如 /publish 或首页）
    console.log('等待登录成功（检测URL变化）...');
    
    // 等待登录成功 - 通过轮询检查URL变化
    const startTime = Date.now();
    const timeout = 120000; // 2分钟超时
    
    while (Date.now() - startTime < timeout) {
      await page.waitForTimeout(2000); // 每2秒检查一次
      
      const currentUrl = page.url();
      
      // 如果URL不再是登录页面，说明登录成功
      if (currentUrl.includes('creator.xiaohongshu.com') && !currentUrl.includes('/login')) {
        console.log('检测到URL已离开登录页面，登录成功！');
        break;
      }
      
      // 检查是否有错误提示（登录失败）
      try {
        const pageText = await page.textContent('body');
        if (pageText && /登录失败|验证失败|二维码已过期/i.test(pageText)) {
          throw new Error('登录失败，请重试');
        }
      } catch (e) {
        if (e.message.includes('登录失败')) {
          throw e; // 重新抛出登录失败错误
        }
        // 忽略其他错误（如选择器错误）
      }
    }
    
    // 最终确认已离开登录页面
    const finalUrl = page.url();
    if (finalUrl.includes('/login')) {
      throw new Error('登录超时（2分钟），请重试');
    }

    console.log('登录成功！当前URL:', finalUrl);

    // 登录成功，获取Cookie
    const cookies = await context.cookies();
    await saveCookies(accountId, cookies);

    console.log('Cookie已保存');

    // 等待一小段时间让用户看到登录成功
    await page.waitForTimeout(2000);

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

    let page = null;
    let context = null;

    try {
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // 添加Cookie
      await context.addCookies(accountCookies.cookies);

      page = await context.newPage();

    // 访问小红书创作服务平台首页
    await page.goto('https://creator.xiaohongshu.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('已打开创作服务平台，当前URL:', page.url());

    // 检查是否还在正确页面（可能Cookie过期导致跳转到登录页）
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(`页面已跳转到登录页，当前URL: ${currentUrl}，可能Cookie已过期，请重新登录`);
    }

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 步骤1: 点击"发布笔记"按钮
    console.log('步骤1: 正在查找并点击"发布笔记"按钮...');
    const publishNoteSelectors = [
      'button:has-text("发布笔记")',
      'a:has-text("发布笔记")',
      '[class*="publish"]:has-text("发布笔记")',
      'button[aria-label*="发布笔记"]',
      '.publish-note-button',
      '[data-testid*="publish"]'
    ];

    let publishNoteButton = null;
    for (const selector of publishNoteSelectors) {
      try {
        publishNoteButton = await page.waitForSelector(selector, { 
          timeout: 5000,
          state: 'visible'
        });
        if (publishNoteButton && await publishNoteButton.isVisible()) {
          console.log(`找到"发布笔记"按钮，使用选择器: ${selector}`);
          await publishNoteButton.click();
          await page.waitForTimeout(2000); // 等待菜单展开或页面跳转
          break;
        }
      } catch (e) {
        console.log(`选择器 ${selector} 未找到，继续尝试下一个...`);
        continue;
      }
    }

    if (!publishNoteButton) {
      const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-publish-note.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      throw new Error(`无法找到"发布笔记"按钮。当前URL: ${page.url()}。页面截图已保存到: ${screenshotPath}`);
    }

    // 步骤2: 点击"写长文"标签，或直接导航到正确的URL
    console.log('步骤2: 正在查找并点击"写长文"标签...');
    const writeLongArticleSelectors = [
      'a:has-text("写长文")',
      'button:has-text("写长文")',
      '[role="tab"]:has-text("写长文")',
      'div:has-text("写长文")',
      '[class*="tab"]:has-text("写长文")',
      '[data-testid*="long-article"]'
    ];

    let writeLongArticleTab = null;
    for (const selector of writeLongArticleSelectors) {
      try {
        writeLongArticleTab = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible'
        });
        if (writeLongArticleTab && await writeLongArticleTab.isVisible()) {
          console.log(`找到"写长文"标签，使用选择器: ${selector}`);
          await writeLongArticleTab.click();
          await page.waitForTimeout(2000); // 等待页面切换
          break;
        }
      } catch (e) {
        console.log(`选择器 ${selector} 未找到，继续尝试下一个...`);
        continue;
      }
    }

    // 检查URL是否正确，如果不正确则直接导航到正确的URL
    const currentUrl = page.url();
    if (!currentUrl.includes('target=article')) {
      console.log('检测到URL不正确，直接导航到写长文页面...');
      await page.goto('https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=article', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('已导航到写长文页面，当前URL:', page.url());
    }

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 步骤3: 点击"新的创作"按钮
    console.log('步骤3: 正在查找并点击"新的创作"按钮...');
    const newCreationSelectors = [
      'button:has-text("新的创作")',
      'a:has-text("新的创作")',
      '[class*="new-creation"]:has-text("新的创作")',
      'button[aria-label*="新的创作"]',
      '[data-testid*="new-creation"]'
    ];

    let newCreationButton = null;
    for (const selector of newCreationSelectors) {
      try {
        newCreationButton = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible'
        });
        if (newCreationButton && await newCreationButton.isVisible()) {
          console.log(`找到"新的创作"按钮，使用选择器: ${selector}`);
          await newCreationButton.click();
          await page.waitForTimeout(3000); // 等待编辑页面加载
          break;
        }
      } catch (e) {
        console.log(`选择器 ${selector} 未找到，继续尝试下一个...`);
        continue;
      }
    }

    if (!newCreationButton) {
      const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-new-creation.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      throw new Error(`无法找到"新的创作"按钮。当前URL: ${page.url()}。页面截图已保存到: ${screenshotPath}`);
    }

    // 等待编辑页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 尝试关闭可能的弹窗或引导提示
    try {
      const closeButtons = [
        'button[aria-label*="关闭"]',
        'button[aria-label*="知道了"]',
        '.close-button',
        '[class*="close"]',
        'button:has-text("知道了")',
        'button:has-text("关闭")'
      ];
      
      for (const selector of closeButtons) {
        try {
          const closeBtn = await page.$(selector);
          if (closeBtn && await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
            console.log('已关闭弹窗:', selector);
            break;
          }
        } catch (e) {
          // 继续尝试下一个
        }
      }
    } catch (error) {
      console.log('关闭弹窗时出错（可能没有弹窗）:', error.message);
    }

    // 步骤4: 填写标题（placeholder: "输入标题"）
    console.log('步骤4: 正在查找标题输入框...');
    const titleSelectors = [
      'input[placeholder*="输入标题"]',
      'input[placeholder*="标题"]',
      'textarea[placeholder*="输入标题"]',
      'textarea[placeholder*="标题"]',
      'div[contenteditable="true"][placeholder*="输入标题"]',
      'div[contenteditable="true"][placeholder*="标题"]',
      'input[type="text"]',
      '[class*="title-input"]',
      '[class*="title"] input'
    ];

    let titleInput = null;
    for (const selector of titleSelectors) {
      try {
        console.log(`尝试选择器: ${selector}`);
        titleInput = await page.waitForSelector(selector, { 
          timeout: 5000,
          state: 'visible'
        });
        if (titleInput && await titleInput.isVisible()) {
          console.log(`找到标题输入框，使用选择器: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`选择器 ${selector} 未找到，继续尝试下一个...`);
        continue;
      }
    }

    if (!titleInput) {
      const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-title.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`已保存页面截图到: ${screenshotPath}`);
      
      const pageTitle = await page.title().catch(() => '无法获取页面标题');
      throw new Error(
        `无法找到标题输入框。当前URL: ${page.url()}, 页面标题: ${pageTitle}, ` +
        `已尝试的选择器: ${titleSelectors.join(', ')}。` +
        `页面截图已保存到: ${screenshotPath}`
      );
    }

    // 填写标题
    await titleInput.click();
    await page.waitForTimeout(500);
    await titleInput.fill(title);
    console.log('标题已填写:', title);

    // 步骤5: 填写内容（placeholder: "粘贴到这里或输入文字"）
    console.log('步骤5: 正在查找内容输入框...');
    const contentSelectors = [
      'textarea[placeholder*="粘贴到这里或输入文字"]',
      'textarea[placeholder*="粘贴"]',
      'div[contenteditable="true"][placeholder*="粘贴到这里或输入文字"]',
      'div[contenteditable="true"][placeholder*="粘贴"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="输入文字"]',
      '[class*="editor"]',
      '[class*="content-editor"]'
    ];

    let contentInput = null;
    for (const selector of contentSelectors) {
      try {
        console.log(`尝试选择器: ${selector}`);
        contentInput = await page.waitForSelector(selector, { 
          timeout: 5000,
          state: 'visible'
        });
        if (contentInput && await contentInput.isVisible()) {
          console.log(`找到内容输入框，使用选择器: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`选择器 ${selector} 未找到，继续尝试下一个...`);
        continue;
      }
    }

    if (!contentInput) {
      const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-content.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`已保存页面截图到: ${screenshotPath}`);
      
      throw new Error(
        `无法找到内容输入框。当前URL: ${page.url()}, ` +
        `已尝试的选择器: ${contentSelectors.join(', ')}。` +
        `页面截图已保存到: ${screenshotPath}`
      );
    }

    // 填写内容 - 对于contenteditable元素，使用键盘输入方式
    await contentInput.click();
    await page.waitForTimeout(500);
    
    if (await contentInput.evaluate(el => el.isContentEditable || el.tagName === 'TEXTAREA')) {
      // 清空现有内容（如果有）
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(200);
      // 输入内容
      await page.keyboard.type(content, { delay: 30 });
    } else {
      await contentInput.fill(content);
    }
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
    
    // 尝试保存页面截图和详细信息用于调试
    try {
      if (page) {
        const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-error.png');
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        console.error(`错误截图已保存到: ${screenshotPath}`);
        
        try {
          const currentUrl = page.url();
          const pageTitle = await page.title();
          console.error(`错误时页面URL: ${currentUrl}`);
          console.error(`错误时页面标题: ${pageTitle}`);
        } catch (urlError) {
          console.error('获取页面信息失败:', urlError.message);
        }
      } else if (context) {
        // 如果page未定义，尝试从context获取页面
        const pages = context.pages();
        if (pages.length > 0) {
          const lastPage = pages[pages.length - 1];
          const screenshotPath = path.join(__dirname, '../../data/debug-screenshot-error.png');
          await lastPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
          console.error(`错误截图已保存到: ${screenshotPath}`);
        }
      }
    } catch (screenshotError) {
      console.error('保存错误截图失败:', screenshotError.message);
    }
    
    await browser.close();
    
    // 构造更详细的错误信息
    const errorMessage = error.message || '未知错误';
    throw new Error(`发布失败: ${errorMessage}`);
  }
}

