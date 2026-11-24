export const USERNAME_FORMAT_MESSAGE = "用户名需为 3–32 位小写字母、数字或下划线。";

export function normalizeUsername(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9_]{3,32}$/.test(normalized) ? normalized : null;
}

export function usernameValidationMessage(value: string): string | null {
  return normalizeUsername(value) === null ? USERNAME_FORMAT_MESSAGE : null;
}

// Keep the existing UTF-16 length and UTF-8 byte limits without trimming.
export function passwordValidationMessage(value: string): string | null {
  if (value.length < 8) return "密码至少需要 8 个字符。";
  if (value.length > 128) return "密码最多 128 个字符。";
  if (new TextEncoder().encode(value).byteLength > 512) {
    return "密码内容过长，请缩短后再试。";
  }
  return null;
}

export function confirmPasswordValidationMessage(password: string, confirmation: string): string | null {
  if (!confirmation) return "请再次输入密码。";
  return confirmation === password ? null : "两次输入的密码不一致。";
}
