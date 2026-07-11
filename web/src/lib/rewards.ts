// 18TRIP イベント報酬テーブル
// 3種類の報酬パターン (フィーチャー・通常シーズン・班シーズン) をプリセットとして保持。
// イベントに応じて切り替え・編集が可能 (LocalStorage に保存)。

export interface RewardEntry {
  pt: number;
  name: string;
  bento?: number;
  shumai?: number;
  diamonds?: number;
}

export interface LoginBonus {
  bento: number;   // シュウマイ弁当 (1個=10AP)
  shumai: number;  // シュウマイ (1個=1AP)
}

export interface RewardPattern {
  id: string;
  name: string;
  rewards: RewardEntry[];
  loginBonus: LoginBonus;
  isDefault?: boolean;
}

// --- フィーチャーイベント報酬 ---
const FEATURE_REWARDS: RewardEntry[] = [
  { pt: 500, name: "イベントストーリー1話" },
  { pt: 4000, name: "イベントストーリー2話" },
  { pt: 10000, name: "イベントストーリー3話" },
  { pt: 12000, name: "シュウマイ5個", shumai: 5 },
  { pt: 20000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 22000, name: "イベントストーリー4話" },
  { pt: 34000, name: "シュウマイ3個", shumai: 3 },
  { pt: 36000, name: "イベントストーリー5話" },
  { pt: 50000, name: "イベントストーリー6話" },
  { pt: 55000, name: "Rカード①1枚目" },
  { pt: 65000, name: "イベントストーリー7話" },
  { pt: 70000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 75000, name: "Rカード②1枚目" },
  { pt: 90000, name: "イベントストーリー8話" },
  { pt: 100000, name: "Rカード③1枚目" },
  { pt: 110000, name: "イベントストーリー9話" },
  { pt: 120000, name: "シュウマイ3個", shumai: 3 },
  { pt: 140000, name: "イベントストーリー10話" },
  { pt: 160000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 170000, name: "イベントストーリー11話" },
  { pt: 180000, name: "シュウマイ3個", shumai: 3 },
  { pt: 190000, name: "イベントストーリーEP" },
  { pt: 200000, name: "Rカード①2枚目" },
  { pt: 230000, name: "Rカード②2枚目" },
  { pt: 260000, name: "Rカード③2枚目" },
  { pt: 280000, name: "シュウマイ3個", shumai: 3 },
  { pt: 300000, name: "イベント楽曲" },
  { pt: 400000, name: "Rカード①3枚目" },
  { pt: 440000, name: "Rカード②3枚目" },
  { pt: 460000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 480000, name: "Rカード③3枚目" },
  { pt: 500000, name: "SRカード1枚目" },
  { pt: 560000, name: "シュウマイ3個", shumai: 3 },
  { pt: 600000, name: "Rカード①4枚目" },
  { pt: 640000, name: "Rカード②4枚目" },
  { pt: 680000, name: "Rカード③4枚目" },
  { pt: 740000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 770000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 790000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 845000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 900000, name: "Rカード①5枚目" },
  { pt: 940000, name: "Rカード②5枚目" },
  { pt: 980000, name: "Rカード③5枚目" },
  { pt: 990000, name: "SRカード2枚目" },
  { pt: 1000000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 1200000, name: "プリシールS①" },
  { pt: 1310000, name: "Rカード①6枚目" },
  { pt: 1330000, name: "Rカード②6枚目" },
  { pt: 1350000, name: "Rカード③6枚目" },
  { pt: 1450000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 1480000, name: "プリシールS②" },
  { pt: 1500000, name: "TRIPアチーブ1個" },
  { pt: 1550000, name: "SRカード3枚目" },
  { pt: 1600000, name: "無償ダイヤ20個", diamonds: 20 },
  { pt: 2200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 2400000, name: "SRカード4枚目" },
  { pt: 3000000, name: "SSRカード1枚目" },
  { pt: 3200000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 3500000, name: "SRカード5枚目" },
  { pt: 4000000, name: "TRIPアチーブ1個" },
  { pt: 4200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 5000000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 5500000, name: "SRカード6枚目" },
  { pt: 5700000, name: "SSRカード2枚目" },
  { pt: 6600000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 7400000, name: "プリシールM①" },
  { pt: 7950000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 8000000, name: "TRIPアチーブ1個" },
  { pt: 8400000, name: "SSRカード3枚目" },
  { pt: 9300000, name: "プリシールM②" },
  { pt: 10000000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 11200000, name: "SSRカード4枚目" },
  { pt: 12000000, name: "TRIPアチーブ1個" },
  { pt: 14000000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 14200000, name: "SSRカード5枚目" },
  { pt: 16900000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 17000000, name: "TRIPアチーブ1個" },
  { pt: 18000000, name: "SSRカード6枚目" },
];

// --- 通常シーズン報酬 ---
const NORMAL_SEASON_REWARDS: RewardEntry[] = [
  { pt: 500, name: "イベントストーリー1話" },
  { pt: 4000, name: "イベントストーリー2話" },
  { pt: 10000, name: "イベントストーリー3話" },
  { pt: 12000, name: "シュウマイ5個", shumai: 5 },
  { pt: 20000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 22000, name: "イベントストーリー4話" },
  { pt: 34000, name: "シュウマイ3個", shumai: 3 },
  { pt: 50000, name: "イベントストーリー5話" },
  { pt: 55000, name: "Rカード1枚目" },
  { pt: 70000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 80000, name: "イベントストーリー6話" },
  { pt: 110000, name: "イベントストーリー7話" },
  { pt: 120000, name: "シュウマイ3個", shumai: 3 },
  { pt: 140000, name: "イベントストーリー8話" },
  { pt: 160000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 170000, name: "イベントストーリー9話" },
  { pt: 190000, name: "シュウマイ3個", shumai: 3 },
  { pt: 200000, name: "Rカード2枚目" },
  { pt: 280000, name: "シュウマイ3個", shumai: 3 },
  { pt: 340000, name: "Rカード3枚目" },
  { pt: 400000, name: "SRカード1枚目" },
  { pt: 460000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 530000, name: "Rカード4枚目" },
  { pt: 560000, name: "シュウマイ3個", shumai: 3 },
  { pt: 740000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 770000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 790000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 800000, name: "Rカード5枚目" },
  { pt: 845000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 900000, name: "SRカード2枚目" },
  { pt: 1000000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 1200000, name: "Rカード6枚目" },
  { pt: 1350000, name: "SRカード3枚目" },
  { pt: 1450000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 1500000, name: "TRIPアチーブ1個" },
  { pt: 1600000, name: "無償ダイヤ20個", diamonds: 20 },
  { pt: 2000000, name: "SRカード4枚目" },
  { pt: 2200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 3000000, name: "SRカード5枚目" },
  { pt: 3200000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 3500000, name: "TRIPアチーブ1個" },
  { pt: 4200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 4500000, name: "SRカード6枚目" },
  { pt: 4500018, name: "完走称号" },
];

// --- 班シーズン報酬 ---
const TEAM_SEASON_REWARDS: RewardEntry[] = [
  { pt: 500, name: "イベントストーリー1話" },
  { pt: 4000, name: "イベントストーリー2話" },
  { pt: 10000, name: "イベントストーリー3話" },
  { pt: 12000, name: "シュウマイ5個", shumai: 5 },
  { pt: 20000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 22000, name: "イベントストーリー4話" },
  { pt: 34000, name: "シュウマイ3個", shumai: 3 },
  { pt: 50000, name: "イベントストーリー5話" },
  { pt: 55000, name: "Rカード1枚目" },
  { pt: 70000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 80000, name: "イベントストーリー6話" },
  { pt: 110000, name: "イベントストーリー7話" },
  { pt: 120000, name: "シュウマイ3個", shumai: 3 },
  { pt: 140000, name: "イベントストーリー8話" },
  { pt: 160000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 170000, name: "イベントストーリー9話" },
  { pt: 190000, name: "シュウマイ3個", shumai: 3 },
  { pt: 200000, name: "Rカード2枚目" },
  { pt: 210000, name: "イベントストーリー10話" },
  { pt: 250000, name: "イベントストーリー11話" },
  { pt: 280000, name: "シュウマイ3個", shumai: 3 },
  { pt: 340000, name: "Rカード3枚目" },
  { pt: 400000, name: "SRカード1枚目" },
  { pt: 460000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 530000, name: "Rカード4枚目" },
  { pt: 560000, name: "シュウマイ3個", shumai: 3 },
  { pt: 740000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 770000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 790000, name: "無償ダイヤ10個", diamonds: 10 },
  { pt: 800000, name: "Rカード5枚目" },
  { pt: 845000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 900000, name: "SRカード2枚目" },
  { pt: 1000000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 1200000, name: "Rカード6枚目" },
  { pt: 1450000, name: "シュウマイ弁当1個", bento: 1 },
  { pt: 1500000, name: "TRIPアチーブ1個" },
  { pt: 1600000, name: "無償ダイヤ20個", diamonds: 20 },
  { pt: 2000000, name: "SRカード3枚目" },
  { pt: 2200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 3000000, name: "SRカード4枚目" },
  { pt: 3200000, name: "無償ダイヤ30個", diamonds: 30 },
  { pt: 3500000, name: "TRIPアチーブ1個" },
  { pt: 4000000, name: "SRカード5枚目" },
  { pt: 4200000, name: "シュウマイ5個", shumai: 5 },
  { pt: 5000000, name: "シュウマイ5個", shumai: 5 },
  { pt: 5500000, name: "SRカード6枚目" },
  { pt: 5500018, name: "完走称号" },
];

// --- デフォルトの報酬パターン一覧 ---
export const DEFAULT_PATTERNS: RewardPattern[] = [
  { id: "feature", name: "フィーチャー", rewards: FEATURE_REWARDS, loginBonus: { bento: 3, shumai: 8 }, isDefault: true },
  { id: "normal_season", name: "通常シーズン", rewards: NORMAL_SEASON_REWARDS, loginBonus: { bento: 3, shumai: 8 }, isDefault: true },
  { id: "team_season", name: "班シーズン", rewards: TEAM_SEASON_REWARDS, loginBonus: { bento: 3, shumai: 8 }, isDefault: true },
];

// 旧 API との互換 export (参照用)
export const REWARDS: RewardEntry[] = FEATURE_REWARDS;

// --- LocalStorage 管理用ヘルパ ---
const STORAGE_KEY = "18trip_reward_patterns_v4";
const ACTIVE_KEY = "18trip_active_pattern_v4";

export function loadPatterns(): RewardPattern[] {
  if (typeof window === "undefined") return DEFAULT_PATTERNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PATTERNS;
    const parsed = JSON.parse(raw) as RewardPattern[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PATTERNS;
    // loginBonus が無い古いデータなら補完. isDefault はデフォルトIDのものに付与
    const defaultIds = new Set(DEFAULT_PATTERNS.map((p) => p.id));
    return parsed.map((p) => ({
      ...p,
      loginBonus: p.loginBonus ?? { bento: 0, shumai: 0 },
      isDefault: defaultIds.has(p.id),
    }));
  } catch {
    return DEFAULT_PATTERNS;
  }
}

export function savePatterns(patterns: RewardPattern[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  } catch {
    // ignore
  }
}

export function loadActivePatternId(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(ACTIVE_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function saveActivePatternId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}

export function genPatternId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// --- バックアップ＆リストア ---
export function exportPatterns(patterns: RewardPattern[]): string {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), patterns }, null, 2);
}

export function importPatterns(json: string): RewardPattern[] | null {
  try {
    const parsed = JSON.parse(json);
    const arr = Array.isArray(parsed) ? parsed : parsed.patterns;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((p: Partial<RewardPattern>) => ({
      id: p.id ?? genPatternId(),
      name: p.name ?? "インポート報酬表",
      rewards: Array.isArray(p.rewards) ? p.rewards : [],
      loginBonus: p.loginBonus ?? { bento: 0, shumai: 0 },
    }));
  } catch {
    return null;
  }
}
