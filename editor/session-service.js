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
