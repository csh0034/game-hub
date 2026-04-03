const ADMIN_NICKNAMES = (process.env.ADMIN_NICKNAMES || "admin")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isAdmin(nickname: string): boolean {
  return ADMIN_NICKNAMES.includes(nickname);
}

export function getDisplayNickname(nickname: string): string {
  return isAdmin(nickname) ? "관리자" : nickname;
}
