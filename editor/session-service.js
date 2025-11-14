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

const XIAOHONGSHU_API_BASE = 'http://localhost:3001/api';

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
      sessionToken: data.sessionToken,
      qrCodeUrl: data.qrCodeUrl,
      expiresAt: data.expiresAt,
      accountId: data.accountId
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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url,
      message: data.message || '发布成功'
    };
  } catch (error) {
    console.error('[session-service] 小红书发布失败:', error.message);
    throw error;
  }
}
