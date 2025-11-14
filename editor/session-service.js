import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3';

function getConfig() {
  const configElement = document.getElementById('aifaEditorConfig');
  if (!configElement) {
    throw new Error('缺少 Supabase 配置，请在页面注入 <script id="aifaEditorConfig">');
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = JSON.parse(configElement.textContent || '{}');
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase 配置不完整');
    }
    return { supabaseUrl, supabaseAnonKey };
  } catch (error) {
    throw new Error('Supabase 配置解析失败');
  }
}

let cachedClient = null;
function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return cachedClient;
}

export async function fetchChannelAccounts(channelId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('channel_accounts')
    .select('account_id, account_name')
    .eq('channel_id', channelId)
    .order('account_name', { ascending: true });

  if (error) {
    console.error('[session-service] 获取账号列表失败:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getChannelLoginStatus(channelId, accountId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('channel_sessions')
    .select('login_status, profile_name, account_id')
    .eq('channel_id', channelId)
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[session-service] 查询登录状态失败:', error.message);
    return { status: 'expired' };
  }

  if (!data) {
    return { status: 'expired' };
  }

  return {
    status: data.login_status || 'expired',
    accountId: data.account_id,
    profileName: data.profile_name || ''
  };
}

export async function startLoginSession(channelId, accountId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('channel-session-start', {
    body: { channelId, accountId }
  });

  if (error) {
    console.error('[session-service] 启动登录会话失败:', error.message);
    return null;
  }

  return {
    sessionToken: data.sessionToken,
    qrCodeUrl: data.qrCodeUrl,
    expiresAt: data.expiresAt,
    accountId: data.accountId
  };
}

export async function pollLoginSessionStatus(sessionToken) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('channel-session-status', {
    body: { sessionToken }
  });

  if (error) {
    console.error('[session-service] 轮询登录状态失败:', error.message);
    return { status: 'expired' };
  }

  return {
    status: data.status,
    accountId: data.accountId,
    profileName: data.profileName,
    qrCodeUrl: data.qrCodeUrl,
    sessionToken: data.sessionToken
  };
}

// ==================== 小红书服务函数（使用本地Node.js服务） ====================

/**
 * 根据环境自动确定 API 基础地址
 * - 本地开发：使用 localhost:3001
 * - 生产环境：使用当前域名（通过 Nginx 代理）或配置的环境变量
 */
function getXiaohongshuApiBase() {
  // 优先使用环境变量配置（如果设置了）
  if (window.XIAOHONGSHU_API_BASE) {
    return window.XIAOHONGSHU_API_BASE;
  }
  
  // 根据当前域名判断环境
  const hostname = window.location.hostname;
  
  // 本地开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // 生产环境：使用当前域名的 /api 路径（通过 Nginx 代理）
  // 或者使用完整的 API 域名（如果配置了独立域名）
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  
  // 如果 API 在独立域名，可以在这里配置
  // 例如：return 'https://api.yourdomain.com/api';
  
  // 默认使用当前域名的 /api 路径
  return `${protocol}//${hostname}${port}/api`;
}

const XIAOHONGSHU_API_BASE = getXiaohongshuApiBase();

/**
 * 获取小红书账号列表（从本地JSON文件）
 * @returns {Promise<Array>} 账号列表
 */
export async function fetchXiaohongshuAccounts() {
  try {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/accounts`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    console.error('[session-service] 获取小红书账号列表失败:', error.message);
    return [];
  }
}

/**
 * 获取小红书登录状态
 * @param {string} accountId - 账号ID
 * @returns {Promise<Object>} 登录状态信息
 */
export async function getXiaohongshuLoginStatus(accountId) {
  try {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/login/status?accountId=${encodeURIComponent(accountId)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return {
      status: data.status || 'expired',
      accountId: data.accountId,
      profileName: data.profileName || ''
    };
  } catch (error) {
    console.error('[session-service] 查询小红书登录状态失败:', error.message);
    return { status: 'expired' };
  }
}

/**
 * 启动小红书扫码登录会话
 * @param {string} accountId - 账号ID
 * @returns {Promise<Object|null>} 会话信息
 */
export async function startXiaohongshuLoginSession(accountId) {
  try {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/login/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountId })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success || false,
      sessionToken: data.sessionToken,
      qrCodeUrl: data.qrCodeUrl,
      expiresAt: data.expiresAt,
      accountId: data.accountId,
      message: data.message
    };
  } catch (error) {
    console.error('[session-service] 启动小红书登录会话失败:', error.message);
    return null;
  }
}

/**
 * 轮询小红书登录状态
 * @param {string} sessionToken - 会话令牌
 * @returns {Promise<Object>} 登录状态
 */
export async function pollXiaohongshuLoginStatus(sessionToken) {
  try {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/login/status?sessionToken=${encodeURIComponent(sessionToken)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return {
      status: data.status,
      accountId: data.accountId,
      profileName: data.profileName,
      qrCodeUrl: data.qrCodeUrl,
      sessionToken: data.sessionToken
    };
  } catch (error) {
    console.error('[session-service] 轮询小红书登录状态失败:', error.message);
    return { status: 'expired' };
  }
}

/**
 * 发布内容到小红书
 * @param {Object} taskPayload - 发布任务数据
 * @returns {Promise<Object>} 发布结果
 */
export async function publishToXiaohongshu(taskPayload) {
  try {
    const response = await fetch(`${XIAOHONGSHU_API_BASE}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
      
      // 构造详细的错误信息，包括Call log
      let fullErrorMessage = `发布失败: ${errorMessage}`;
      if (errorData.callLog) {
        fullErrorMessage += `\nCall log: ${errorData.callLog}`;
      }
      
      console.error('[session-service] 小红书发布失败:', fullErrorMessage);
      throw new Error(fullErrorMessage);
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url,
      message: data.message || '发布成功'
    };
  } catch (error) {
    // 如果是网络错误，提供更友好的提示
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error('发布失败: 无法连接到本地服务，请确保小红书服务正在运行 (http://localhost:3001)');
      console.error('[session-service] 网络错误:', networkError.message);
      throw networkError;
    }
    
    console.error('[session-service] 小红书发布失败:', error.message);
    throw error;
  }
}

// ==================== 发布历史管理 ====================

const PUBLISH_HISTORY_KEY = 'aifa_publish_history';
const MAX_HISTORY_ITEMS = 100; // 最多保存100条历史记录

/**
 * 保存发布历史记录
 * @param {Object} historyItem - 发布历史项
 * @param {string} historyItem.platform - 发布平台（zhihu/xiaohongshu）
 * @param {string} historyItem.title - 文章标题
 * @param {string} historyItem.content - 文章内容（截取前200字符）
 * @param {string} historyItem.url - 发布后的URL
 * @param {string} historyItem.accountId - 账号ID
 * @param {string} historyItem.accountName - 账号名称
 * @param {string} historyItem.status - 发布状态（success/failed）
 * @param {string} historyItem.message - 发布消息
 */
export function savePublishHistory(historyItem) {
  try {
    const history = getPublishHistory();
    
    // 添加时间戳和ID
    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...historyItem
    };
    
    // 添加到数组开头
    history.unshift(newItem);
    
    // 限制历史记录数量
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    // 保存到localStorage
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(history));
    
    console.log('[session-service] 发布历史已保存:', newItem.id);
    return newItem;
  } catch (error) {
    console.error('[session-service] 保存发布历史失败:', error.message);
    // 即使保存失败也不影响发布流程
    return null;
  }
}

/**
 * 获取所有发布历史记录
 * @returns {Array} 发布历史记录数组
 */
export function getPublishHistory() {
  try {
    const historyJson = localStorage.getItem(PUBLISH_HISTORY_KEY);
    if (!historyJson) {
      return [];
    }
    return JSON.parse(historyJson);
  } catch (error) {
    console.error('[session-service] 读取发布历史失败:', error.message);
    return [];
  }
}

/**
 * 删除指定的发布历史记录
 * @param {string} historyId - 历史记录ID
 * @returns {boolean} 是否删除成功
 */
export function deletePublishHistory(historyId) {
  try {
    const history = getPublishHistory();
    const filtered = history.filter(item => item.id !== historyId);
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('[session-service] 删除发布历史失败:', error.message);
    return false;
  }
}

/**
 * 清空所有发布历史记录
 * @returns {boolean} 是否清空成功
 */
export function clearPublishHistory() {
  try {
    localStorage.removeItem(PUBLISH_HISTORY_KEY);
    return true;
  } catch (error) {
    console.error('[session-service] 清空发布历史失败:', error.message);
    return false;
  }
}
