import type { Locale } from '@/lib/i18n';

const EN_MESSAGES = {
  'auth.error.generic': 'The Arena could not complete that request.',
  'auth.error.invite_min': 'Invite codes must contain at least 20 characters.',
  'auth.error.password_min':
    'Registration passwords must be at least 12 characters.',
  'auth.error.password_mismatch':
    'The password confirmation does not match.',
  'auth.error.username_min': 'Username must be at least 3 characters.',
  'auth.placeholder.password_min': '12 characters minimum',
  'confirm.connector_revoke':
    'Revoke {deviceName}? Its Connector token and active bindings will stop working.',
  'confirm.game_withdraw':
    'Leave this pool and revoke the unused game mandate?',
} as const;

export type PlayerMessageKey = keyof typeof EN_MESSAGES;
export type PlayerMessageParams = Record<string, string | number>;

const ZH_CN_MESSAGES: Record<PlayerMessageKey, string> = {
  'auth.error.generic': 'Arena 无法完成该请求。',
  'auth.error.invite_min': '邀请码至少需要 20 个字符。',
  'auth.error.password_min': '注册密码至少需要 12 个字符。',
  'auth.error.password_mismatch': '两次输入的密码不一致。',
  'auth.error.username_min': '用户名至少需要 3 个字符。',
  'auth.placeholder.password_min': '至少 12 个字符',
  'confirm.connector_revoke':
    '确定撤销 {deviceName} 吗？其 Connector 令牌和当前绑定将立即停止工作。',
  'confirm.game_withdraw': '确定退出该匹配池并撤销尚未使用的对局支付授权吗？',
};

function interpolate(
  template: string,
  params: PlayerMessageParams,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/gu, (token, key) => {
    const value = params[key];
    return value === undefined ? token : String(value);
  });
}

export function playerMessage(
  locale: Locale,
  key: PlayerMessageKey,
  params: PlayerMessageParams = {},
): string {
  const catalog = locale === 'zh-CN' ? ZH_CN_MESSAGES : EN_MESSAGES;
  return interpolate(catalog[key], params);
}
