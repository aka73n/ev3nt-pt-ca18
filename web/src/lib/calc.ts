// 18TRIP イベントpt計算 — ゲーム仕様に基づく定数 & 計算ロジック
//
// 【仕様】
//  通常 (AP消費): 1AP あたり base 1,800pt × (1 + 旬倍率)
//  イベント (切符消費): 10切符 あたり base 10,900pt × (1 + 旬倍率)
//    タイムボーナス 300pt は計算から完全除外 (キリ番調整時のみ全探索で使用)
//  通常 1AP 消費で切符を 1枚 獲得 (= 1 AP : 1 切符)
//  切符は10枚単位で使用可能。1回のイベント周回で10〜200枚消費できる
//  現在の切符は全て使用する前提。不足分をAP消費で補う
//
// 【自然回復AP】
//  30分に1AP回復 → 1時間2AP → 1日48AP
//  初日 16時開始、最終日 21時終了
//  開催日数のみ: 現在日+現在時から終了までの残り時間を計算
//
// 【アイテムAP回復】
//  シュウマイ弁当 1個 = 10AP
//  シュウマイ 1個 = 1AP
//
// 【ダイヤ → AP 換算】 2ダイヤ = 1AP
// 【1日10AP割引】 スイッチON時、使用ダイヤから開催日数×10を減算(下限0)
// 【課金額】 (不足ダイヤ ÷ 1418) × 10000, 1000の位で切り上げ

// --- 基本パラメータ ---
export const BASE_NORMAL_PT_PER_AP = 1800;
export const BASE_EVENT_PT_PER_10_TICKETS = 10900;
export const TIME_BONUS = 300;
export const AP_PER_HOUR = 2;
export const AP_PER_DAY = 48;
export const FIRST_DAY_AP = 16;
export const LAST_DAY_AP = 42;
export const BENTO_AP = 10;
export const SHUMAI_AP = 1;
export const DIAMONDS_PER_AP = 2;
export const TICKETS_PER_AP = 1;
export const MAX_TICKETS_PER_EVENT_RUN = 200;
export const MIN_TICKETS_PER_EVENT_RUN = 10;
export const DIAMONDS_PER_CHARGE = 1418;
export const YEN_PER_CHARGE = 10000;
export const EVENT_START_HOUR = 16;
export const EVENT_END_HOUR = 21;

// --- 初回難易度解放pt (特効0%時の基本値) ---
export const DIFFICULTY_CLEAR_PT: Record<string, number> = {
  EASY: 10500,
  NORMAL: 10600,
  HARD: 10800,
};
export const DIFFICULTY_CLEAR_AP = 10; // 各難易度1回あたり10AP

// --- 所要時間デフォルト ---
export const DEFAULT_NORMAL_MIN_PER_RUN = 1;
export const DEFAULT_EVENT_MIN_PER_RUN = 1;

// --- 特効ボーナステーブル (0凸〜5凸/完凸) ---
export type Rarity = "SSR" | "SR" | "R";

export const BONUS_TABLE: Record<Rarity, number[]> = {
  SSR: [20, 40, 60, 80, 110, 150],
  SR: [8, 18, 30, 40, 50, 60],
  R: [2, 3, 4, 5, 7, 10],
};

export const LIMIT_BREAK_LABELS = [
  "無凸 (1枚)",
  "1凸 (2枚)",
  "2凸 (3枚)",
  "3凸 (4枚)",
  "4凸 (5枚)",
  "完凸 (6枚)",
] as const;

// 「なし(0枚)」を含めたプルダウン用ラベル (index 0 = なし)
export const LIMIT_BREAK_LABELS_WITH_NONE = [
  "なし (0枚)",
  ...LIMIT_BREAK_LABELS,
] as const;
// limitBreak値: -1 = なし(0枚), 0〜5 = 無凸〜完凸

// --- 目標プリセット ---
export const TARGET_PRESETS: { value: number; label: string }[] = [
  { value: 1_000_000, label: "100万" },
  { value: 1_500_000, label: "150万" },
  { value: 3_000_000, label: "300万" },
  { value: 4_500_000, label: "450万" },
  { value: 5_500_000, label: "550万" },
  { value: 18_000_000, label: "1800万" },
];

// --- ログインボーナススケジュール ---
export interface LoginBonusScheduleEntry {
  day: number;
  bento?: number;
  shumai?: number;
}

export interface LoginBonusPattern {
  id: string;
  name: string;
  schedule: LoginBonusScheduleEntry[];
}

// デフォルト配布スケジュール
export const DEFAULT_LOGIN_BONUS_PATTERNS: LoginBonusPattern[] = [
  {
    id: "basic_logbo",
    name: "基本ログインボーナス",
    schedule: [
      { day: 2, bento: 1 },
      { day: 4, shumai: 5 },
      { day: 6, bento: 1 },
      { day: 7, shumai: 3 },
      { day: 8, bento: 1 },
    ],
  },
];

// スケジュールから総量を計算
export function sumLoginBonusSchedule(
  schedule: LoginBonusScheduleEntry[],
): { bento: number; shumai: number } {
  let bento = 0;
  let shumai = 0;
  for (const e of schedule) {
    bento += e.bento ?? 0;
    shumai += e.shumai ?? 0;
  }
  return { bento, shumai };
}

// currentDay以降に取得される分(未獲得分)を計算
export function getRemainingLoginBonus(
  schedule: LoginBonusScheduleEntry[],
  currentDay: number,
): { bento: number; shumai: number } {
  let bento = 0;
  let shumai = 0;
  for (const e of schedule) {
    if (e.day > currentDay) {
      bento += e.bento ?? 0;
      shumai += e.shumai ?? 0;
    }
  }
  return { bento, shumai };
}

// --- 計算入力 ---
export interface CalcInput {
  targetPt: number;
  currentPt: number;
  bonusPercent: number;
  currentTickets: number;
  bentoCount: number;
  shumaiCount: number;
  // 期間
  eventDays: number;
  currentDay: number;
  currentHour: number;
  // 自然回復
  naturalAPSimplify: boolean;
  naturalAPSubtract: number;
  // 所持
  ownedDiamonds: number;
  // キリ番
  exactMatch: boolean;
  // 1日10AP割引
  discountDiamonds: boolean;
  // ログボスケジュール(未獲得分は呼び出し側で計算済み)
  loginBonusRemaining: { bento: number; shumai: number };
  // 初回クリアコストAP (未クリア数 × 10AP) — 必要APに加算
  initialReleaseApCost?: number;
  // 初回難易度解放pt (currentPtに加算済みの分)
  firstClearPoints?: number;
  // 報酬テーブル (ダイヤ追加なし計算の反復用)
  rewardEntries?: { pt: number; bento?: number; shumai?: number }[];
  // 達成日目標 (達成日以降の自然回復・ログボをマイナス値に自動反映)
  targetAchieveDay?: number;
  // ログインボーナススケジュール (達成日目標の自動計算用)
  loginBonusSchedule?: LoginBonusScheduleEntry[];
}

// --- イベント周回チャンク ---
export interface EventRunChunk {
  tickets: number;
}

// --- ルート情報 ---
export interface RouteInfo {
  totalAP: number;
  totalTickets: number;
  usableTickets: number;
  totalPoints: number;
  excess: number;
  normalRuns: number;
  eventRunChunks: EventRunChunk[];
  eventRunCount: number;
  fullBlocks: number;
  halfBlocks: number;
  remainderAP: number;
  apBreakdownLabel: string;
  eventChunkLabel: string;
}

// --- キリ番調整情報 ---
export interface ExactMatchInfo {
  enabled: boolean;
  isExact: boolean;
  underAP: number;
  underPoints: number;
  gap: number;
  closestPoints: number[];
  timeBonusRunsNeeded: number;
  timeBonusPoints: number;
  finalPoints: number;
  finalExcess: number;
  eventRunCount: number;
  // 詳細ルート情報
  baseSets: number;
  normal10Runs: number;
  eventFragmentTickets: number;
  normalFragmentAP: number;
  // 各項目の獲得pt内訳
  baseSetPt: number;
  baseSetTotalPt: number;
  normal10Pt: number;
  normal10TotalPt: number;
  eventFragPt: number;
  normalFragPt: number;
  ticketPt: number;
  totalAP: number;
  // ボーナス調整情報 (最後の1回で特効カード編成を変更した場合)
  bonusAdjustmentUsed: boolean;
  bonusAdjustmentPercent: number;
  bonusAdjustmentSlots: BonusSlot[] | null;
}

// --- 所要時間 ---
export interface TimeEstimate {
  normalRuns: number;
  eventRuns: number;
  normalMinPerRun: number;
  eventMinPerRun: number;
  normalMin: number;
  eventMin: number;
  totalMin: number;
  totalHourStr: string;
}

// --- 計算結果 ---
export interface CalcResult {
  remainingPt: number;
  effMult: number;
  normalPtPerAP: number;
  eventPtPer10Ticket: number;
  ptPer10AP: number;
  ptPer200AP: number;
  route: RouteInfo;
  exactMatchInfo: ExactMatchInfo | null;
  requiredTotalAP: number;
  naturalAP: number;
  naturalAPRaw: number;
  ownedItemAP: number;
  loginBonusAP: number;
  rewardItemAP: number;
  nonDiamondAP: number;
  // ダイヤ関連
  diamondRecoveryAP: number;
  usedDiamonds: number;
  shortfallDiamonds: number;
  remainingDiamonds: number;
  discountApplied: number;
  billingYen: number;
  alreadyReached: boolean;
  ownedDiamonds: number;
  rewardBentoAP: number;
  rewardShumaiAP: number;
  estimatedTime: TimeEstimate;
  ticketOnlyPoints: number;
  ticketOnlyReached: boolean;
  nonDiamondPoints: number;
  noExtraDiamondAP: number;
}

// --- 切符をイベント周回チャンクに分割 ---
export function chunkEventRuns(tickets: number): EventRunChunk[] {
  const usable = Math.floor(tickets / 10) * 10;
  if (usable < MIN_TICKETS_PER_EVENT_RUN) return [];
  const chunks: EventRunChunk[] = [];
  let remaining = usable;
  while (remaining >= MIN_TICKETS_PER_EVENT_RUN) {
    const chunk = Math.min(MAX_TICKETS_PER_EVENT_RUN, remaining);
    chunks.push({ tickets: chunk });
    remaining -= chunk;
  }
  return chunks;
}

// --- チャンクラベル生成 "200枚×3回・170枚" ---
export function makeEventChunkLabel(chunks: EventRunChunk[]): string {
  if (chunks.length === 0) return "0回";
  const counts: Record<number, number> = {};
  const order: number[] = [];
  for (const c of chunks) {
    if (!counts[c.tickets]) {
      counts[c.tickets] = 0;
      order.push(c.tickets);
    }
    counts[c.tickets] += 1;
  }
  const parts = order.map((t) =>
    counts[t] > 1 ? `切符${t}枚×${counts[t]}回` : `切符${t}枚1回`,
  );
  return `${parts.join("＋")}:計${chunks.length}回`;
}

// --- AP消費内訳ラベル "AP10×N回+AP M" ---
export function makeAPBreakdownLabel(ap: number): string {
  if (ap <= 0) return "0AP";
  const full10 = Math.floor(ap / 10);
  const rem = ap % 10;
  if (rem === 0) return `10AP×${full10}回`;
  if (full10 === 0) return `${rem}AP`;
  return `10AP×${full10}回+${rem}AP`;
}

// --- 所要時間計算 ---
export function calcEstimatedTime(
  normalRuns: number,
  eventRuns: number,
  normalMinPerRun: number,
  eventMinPerRun: number,
): TimeEstimate {
  // 小数点以下(秒数に相当)は切り捨てて分単位で計算
  const normalMin = Math.floor(normalRuns * normalMinPerRun);
  const eventMin = Math.floor(eventRuns * eventMinPerRun);
  const totalMin = normalMin + eventMin;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const totalHourStr = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
  return { normalRuns, eventRuns, normalMinPerRun, eventMinPerRun, normalMin, eventMin, totalMin, totalHourStr };
}

// --- 開催日数 + 現在日 + 現在時 から自然回復APを計算 ---
export function calcNaturalAPByDaysAndHour(
  eventDays: number,
  currentDay: number,
  currentHour: number,
): number {
  if (eventDays <= 0) return 0;
  const D = Math.max(1, Math.min(eventDays, currentDay));
  const N = eventDays;
  const H = Math.max(0, Math.min(23, currentHour));

  if (D === N) {
    return Math.max(0, (21 - H)) * AP_PER_HOUR;
  }

  const remainingToday = (24 - H) * AP_PER_HOUR;
  const middleDays = N - D - 1;
  const middleAP = middleDays * AP_PER_DAY;
  const lastDayAP = LAST_DAY_AP;
  return remainingToday + middleAP + lastDayAP;
}

// --- 自然回復AP簡易計算のマイナス値 ---
export function calcNaturalAPSubtract(
  eventDays: number,
  currentDay: number,
  subtractValue: number,
): number {
  if (eventDays <= 1) return 0;
  if (currentDay <= 1) return subtractValue;
  if (currentDay >= eventDays) return 0;
  const midDays = eventDays - 2;
  if (midDays <= 0) return 0;
  const perDay = Math.floor(subtractValue / midDays);
  return Math.max(0, subtractValue - perDay * (currentDay - 2));
}

// --- 達成日目標による自動マイナス計算 ---
// 達成日目標以降の自然回復・ログボを受け取れない分を計算
export interface AchieveDaySubtractResult {
  naturalLoss: number; // 自然回復のロス分
  loginBonusLoss: number; // ログボのロス分(AP換算)
  total: number; // 合計ロス
}
export function calcAchieveDaySubtract(
  eventDays: number,
  targetAchieveDay: number,
  loginBonusSchedule: LoginBonusScheduleEntry[],
): AchieveDaySubtractResult {
  if (eventDays <= 0 || targetAchieveDay <= 0 || targetAchieveDay >= eventDays) {
    return { naturalLoss: 0, loginBonusLoss: 0, total: 0 };
  }
  // 達成日目標の日〜最終日までの自然回復を計算
  // その日からの残り = 達成日当日から最終日まで
  // 例: 通常9日、達成日7 → 8日目と9日目の自然回復
  // 中間日 = eventDays - targetAchieveDay - 1 (8日目が中間)
  // 最終日 = 42AP
  const lastDayAP = LAST_DAY_AP;
  const middleDays = Math.max(0, eventDays - targetAchieveDay - 1);
  const naturalLoss = middleDays * AP_PER_DAY + lastDayAP;

  // 達成日以降のログボを計算
  let bentoLoss = 0;
  let shumaiLoss = 0;
  for (const e of loginBonusSchedule) {
    if (e.day > targetAchieveDay) {
      bentoLoss += e.bento ?? 0;
      shumaiLoss += e.shumai ?? 0;
    }
  }
  const loginBonusLoss = bentoLoss * BENTO_AP + shumaiLoss * SHUMAI_AP;
  return { naturalLoss, loginBonusLoss, total: naturalLoss + loginBonusLoss };
}

// --- 切符のみで獲得できるpt ---
export function calcTicketOnlyPoints(tickets: number, bonusPercent: number): number {
  const effMult = 1 + bonusPercent / 100;
  const epp = Math.floor(BASE_EVENT_PT_PER_10_TICKETS * effMult);
  const usable = Math.floor(tickets / 10) * 10;
  return (usable / 10) * epp;
}

// --- ダイヤ追加なしで到達可能な報酬を反復計算 ---
// baseAP(自然回復+所持アイテム+ログボ+所持ダイヤ)から獲得できるptを計算し、
// そのpt到達で獲得できる報酬のAPを追加して再計算 → 収束するまで繰り返す
function calcNoExtraDiamondReachableAP(
  baseAP: number,
  currentPt: number,
  npp: number,
  epp: number,
  currentTickets: number,
  rewards: { pt: number; bento?: number; shumai?: number }[],
): number {
  if (rewards.length === 0) return baseAP;
  const sorted = [...rewards].sort((a, b) => a.pt - b.pt);
  let ap = baseAP;
  for (let iter = 0; iter < 30; iter++) {
    const points = computePoints(ap, npp, epp, currentTickets);
    const totalPt = currentPt + points;
    let newRewardBento = 0;
    let newRewardShumai = 0;
    for (const r of sorted) {
      if (totalPt >= r.pt && currentPt < r.pt) {
        newRewardBento += r.bento ?? 0;
        newRewardShumai += r.shumai ?? 0;
      } else if (totalPt < r.pt) break;
    }
    const newAP = baseAP + newRewardBento * BENTO_AP + newRewardShumai * SHUMAI_AP;
    if (newAP === ap) break;
    ap = newAP;
  }
  return ap;
}

// --- ポイント計算 (AP → pt) ---
function computePoints(ap: number, npp: number, epp: number, currentTickets: number): number {
  const totalTickets = currentTickets + ap;
  const eventUnits = Math.floor(totalTickets / 10);
  return ap * npp + eventUnits * epp;
}

// --- 切符優先ルート探索 ---
function findMinRoute(
  remainingPt: number,
  npp: number,
  epp: number,
  currentTickets: number,
): RouteInfo {
  const ticketUsable = Math.floor(currentTickets / 10) * 10;
  const ticketPts = (ticketUsable / 10) * epp;

  if (ticketPts >= remainingPt) {
    return buildRouteInfo(0, ticketPts, remainingPt, currentTickets);
  }

  const afterTicketPt = remainingPt - ticketPts;
  const effPerAP = npp + epp / 10;
  const maxAP = Math.ceil(afterTicketPt / effPerAP) + 200;

  let bestAP = 0;
  let bestPoints = 0;
  for (let ap = 0; ap <= maxAP; ap++) {
    const pts = computePoints(ap, npp, epp, currentTickets);
    if (pts >= remainingPt) {
      bestAP = ap;
      bestPoints = pts;
      break;
    }
  }
  if (bestAP === 0 && bestPoints < remainingPt) {
    bestAP = maxAP;
    bestPoints = computePoints(maxAP, npp, epp, currentTickets);
  }
  return buildRouteInfo(bestAP, bestPoints, remainingPt, currentTickets);
}

// --- 目標以下の最大AP (キリ番調整用) ---
function findUnderRoute(
  remainingPt: number,
  npp: number,
  epp: number,
  currentTickets: number,
): { ap: number; points: number } {
  const ticketUsable = Math.floor(currentTickets / 10) * 10;
  const ticketPts = (ticketUsable / 10) * epp;

  if (ticketPts >= remainingPt) {
    return { ap: 0, points: ticketPts };
  }

  const afterTicketPt = remainingPt - ticketPts;
  const effPerAP = npp + epp / 10;
  const maxAP = Math.ceil(afterTicketPt / effPerAP) + 200;

  let underAP = 0;
  let underPoints = 0;
  for (let ap = 0; ap <= maxAP; ap++) {
    const pts = computePoints(ap, npp, epp, currentTickets);
    if (pts > remainingPt) break;
    underAP = ap;
    underPoints = pts;
  }
  return { ap: underAP, points: underPoints };
}

// --- ルート情報構築 ---
function buildRouteInfo(
  ap: number,
  points: number,
  remainingPt: number,
  currentTickets: number,
): RouteInfo {
  const totalTickets = currentTickets + ap;
  const usableTickets = Math.floor(totalTickets / 10) * 10;
  const eventChunks = chunkEventRuns(totalTickets);
  const normalRuns = Math.ceil(ap / 10);
  const fullBlocks = Math.floor(ap / 200);
  const rem200 = ap % 200;
  const halfBlocks = Math.floor(rem200 / 100);
  const remainderAP = rem200 % 100;

  return {
    totalAP: ap,
    totalTickets,
    usableTickets,
    totalPoints: points,
    excess: Math.max(0, points - remainingPt),
    normalRuns,
    eventRunChunks: eventChunks,
    eventRunCount: eventChunks.length,
    fullBlocks,
    halfBlocks,
    remainderAP,
    apBreakdownLabel: makeAPBreakdownLabel(ap),
    eventChunkLabel: makeEventChunkLabel(eventChunks),
  };
}

// --- 課金額計算 ---
export function calcBillingYen(diamonds: number): number {
  if (diamonds <= 0) return 0;
  const raw = (diamonds / DIAMONDS_PER_CHARGE) * YEN_PER_CHARGE;
  return Math.ceil(raw / 1000) * 1000;
}

// --- キリ番調整: 難易度解放ptを端数調整に組み込む ---
// 未クリアの難易度の初回クリアptを端数調整の選択肢として追加
function getDifficultyClearPoints(bonusPercent: number): { name: string; pt: number }[] {
  const effMult = 1 + bonusPercent / 100;
  return (Object.keys(DIFFICULTY_CLEAR_PT) as string[]).map((name) => ({
    name,
    pt: Math.floor(DIFFICULTY_CLEAR_PT[name] * effMult),
  }));
}

// --- キリ番調整: 全探索アルゴリズム ---
function searchExactMatchCore(
  remainingPt: number,
  npp: number,
  epp: number,
  currentTickets: number,
  bonusPercent: number = 0,
): ExactMatchInfo | null {
  // 切符のみで獲得できるpt
  const ticketUsable = Math.floor(currentTickets / 10) * 10;
  const ticketPts = (ticketUsable / 10) * epp;
  const ticketChunks = chunkEventRuns(currentTickets);
  const ticketEventRuns = ticketChunks.length;

  // 切符で目標到達済みの場合
  if (ticketPts >= remainingPt) {
    return {
      enabled: true,
      isExact: ticketPts === remainingPt,
      underAP: 0,
      underPoints: ticketPts,
      gap: Math.max(0, remainingPt - ticketPts),
      closestPoints: [ticketPts],
      timeBonusRunsNeeded: 0,
      timeBonusPoints: 0,
      finalPoints: ticketPts,
      finalExcess: ticketPts - remainingPt,
      eventRunCount: ticketEventRuns,
      baseSets: 0,
      normal10Runs: 0,
      eventFragmentTickets: 0,
      normalFragmentAP: 0,
      baseSetPt: 0,
      baseSetTotalPt: 0,
      normal10Pt: 0,
      normal10TotalPt: 0,
      eventFragPt: 0,
      normalFragPt: 0,
      ticketPt: ticketPts,
      totalAP: 0,
      bonusAdjustmentUsed: false,
      bonusAdjustmentPercent: 0,
      bonusAdjustmentSlots: null,
    };
  }

  const remainingAfterTickets = remainingPt - ticketPts;

  // ベース1セットpt: 通常10AP×20回 + イベント切符200×1回
  const baseSetPt = 200 * npp + 20 * epp;
  const normal10Pt = 10 * npp;

  const maxX = Math.ceil(remainingAfterTickets / baseSetPt) + 1;

  interface Candidate {
    X: number; Y: number; M: number; Z: number; a: number; W: number;
    totalAP: number; totalRuns: number;
  }
  const candidates: Candidate[] = [];

  for (let X = 0; X <= maxX; X++) {
    const afterBase = remainingAfterTickets - X * baseSetPt;
    if (afterBase < 0) break;

    for (let Y = 0; Y <= 19; Y++) {
      const afterNormal = afterBase - Y * normal10Pt;
      if (afterNormal < 0) continue;

      const maxM = Math.min(190, Y * 10);
      // M = 0 or 10..maxM step 10
      const mValues: number[] = [0];
      for (let m = 10; m <= maxM; m += 10) mValues.push(m);

      for (const M of mValues) {
        const eventFragPt = (M / 10) * epp;
        const afterEvent = afterNormal - eventFragPt;
        if (afterEvent < 0) continue;

        const totalEventRuns = ticketEventRuns + X + (M > 0 ? 1 : 0);

        // Z = 0 (no normal fragment)
        {
          const gap = afterEvent;
          if (gap === 0) {
            const totalAP = X * 200 + Y * 10;
            candidates.push({ X, Y, M, Z: 0, a: 0, W: 0, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) });
          } else if (gap > 0 && gap % TIME_BONUS === 0) {
            const W = gap / TIME_BONUS;
            if (W <= totalEventRuns) {
              const totalAP = X * 200 + Y * 10;
              candidates.push({ X, Y, M, Z: 0, a: 0, W, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) });
            }
          }
        }

        // Z = 1 (normal fragment 1-9 AP)
        for (let a = 1; a <= 9; a++) {
          const fragPt = a * npp;
          const gap = afterEvent - fragPt;
          if (gap < 0) break;
          if (gap === 0) {
            const totalAP = X * 200 + Y * 10 + a;
            candidates.push({ X, Y, M, Z: 1, a, W: 0, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) + 1 });
          } else if (gap > 0 && gap % TIME_BONUS === 0) {
            const W = gap / TIME_BONUS;
            if (W <= totalEventRuns) {
              const totalAP = X * 200 + Y * 10 + a;
              candidates.push({ X, Y, M, Z: 1, a, W, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) + 1 });
            }
          }
        }

        // Z = 0 + 難易度解放pt (最初の30AP計算でのみ使用)
        // 難易度解放ptは端数調整の選択肢として活用
        if (X === 0 && Y <= 3) {
          const diffPts = getDifficultyClearPoints(bonusPercent);
          for (const dp of diffPts) {
            const gapWithDiff = afterEvent - dp.pt;
            if (gapWithDiff === 0) {
              const totalAP = X * 200 + Y * 10;
              candidates.push({ X, Y, M, Z: 0, a: 0, W: 0, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) });
            } else if (gapWithDiff > 0 && gapWithDiff % TIME_BONUS === 0) {
              const W = gapWithDiff / TIME_BONUS;
              if (W <= totalEventRuns) {
                const totalAP = X * 200 + Y * 10;
                candidates.push({ X, Y, M, Z: 0, a: 0, W, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) });
              }
            }
            // 難易度解放pt + 通常端数AP
            for (let a = 1; a <= 9; a++) {
              const fragPt = a * npp;
              const gapWithDiffFrag = afterEvent - dp.pt - fragPt;
              if (gapWithDiffFrag < 0) break;
              if (gapWithDiffFrag === 0) {
                const totalAP = X * 200 + Y * 10 + a;
                candidates.push({ X, Y, M, Z: 1, a, W: 0, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) + 1 });
              } else if (gapWithDiffFrag > 0 && gapWithDiffFrag % TIME_BONUS === 0) {
                const W = gapWithDiffFrag / TIME_BONUS;
                if (W <= totalEventRuns) {
                  const totalAP = X * 200 + Y * 10 + a;
                  candidates.push({ X, Y, M, Z: 1, a, W, totalAP, totalRuns: X + Y + (M > 0 ? 1 : 0) + 1 });
                }
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    // 調整不可 → 類似pt候補を生成
    const under = findUnderRoute(remainingPt, npp, epp, currentTickets);
    const underRoute = buildRouteInfo(under.ap, under.points, remainingPt, currentTickets);
    const eventRuns = underRoute.eventRunCount;
    const reachable: number[] = [];
    for (let k = 0; k <= eventRuns; k++) {
      reachable.push(under.points + k * TIME_BONUS);
    }
    const sorted = [...reachable].sort((a, b) => Math.abs(a - remainingPt) - Math.abs(b - remainingPt));
    const closest = sorted.slice(0, 3);
    const gap = remainingPt - under.points;
    const runsNeeded = Math.ceil(gap / TIME_BONUS);
    return {
      enabled: true,
      isExact: false,
      underAP: under.ap,
      underPoints: under.points,
      gap,
      closestPoints: closest,
      timeBonusRunsNeeded: runsNeeded,
      timeBonusPoints: runsNeeded * TIME_BONUS,
      finalPoints: under.points + runsNeeded * TIME_BONUS,
      finalExcess: under.points + runsNeeded * TIME_BONUS - remainingPt,
      eventRunCount: eventRuns,
      baseSets: 0,
      normal10Runs: 0,
      eventFragmentTickets: 0,
      normalFragmentAP: 0,
      baseSetPt: 0,
      baseSetTotalPt: 0,
      normal10Pt: 0,
      normal10TotalPt: 0,
      eventFragPt: 0,
      normalFragPt: 0,
      ticketPt: ticketPts,
      totalAP: under.ap,
      bonusAdjustmentUsed: false,
      bonusAdjustmentPercent: 0,
      bonusAdjustmentSlots: null,
    };
  }

  // 最適解を選択: W最小 → 総周回数最小
  candidates.sort((a, b) => {
    if (a.W !== b.W) return a.W - b.W;
    return a.totalRuns - b.totalRuns;
  });
  const best = candidates[0];
  const totalAP = best.totalAP;
  const totalEventRuns = ticketEventRuns + best.X + (best.M > 0 ? 1 : 0);
  const baseSetTotalPt = best.X * baseSetPt;
  const normal10TotalPt = best.Y * normal10Pt;
  const eventFragPt = (best.M / 10) * epp;
  const normalFragPt = best.Z === 1 ? best.a * npp : 0;

  return {
    enabled: true,
    isExact: true,
    underAP: totalAP,
    underPoints: remainingPt,
    gap: 0,
    closestPoints: [remainingPt],
    timeBonusRunsNeeded: best.W,
    timeBonusPoints: best.W * TIME_BONUS,
    finalPoints: remainingPt,
    finalExcess: 0,
    eventRunCount: totalEventRuns,
    baseSets: best.X,
    normal10Runs: best.Y,
    eventFragmentTickets: best.M,
    normalFragmentAP: best.Z === 1 ? best.a : 0,
    baseSetPt,
    baseSetTotalPt,
    normal10Pt,
    normal10TotalPt,
    eventFragPt,
    normalFragPt,
    ticketPt: ticketPts,
    totalAP,
    bonusAdjustmentUsed: false,
    bonusAdjustmentPercent: 0,
    bonusAdjustmentSlots: null,
  };
}

// --- キリ番調整: 全探索 (ボーナス調整なし) ---
function searchExactMatch(
  remainingPt: number,
  npp: number,
  epp: number,
  currentTickets: number,
  bonusPercent: number = 0,
): ExactMatchInfo | null {
  return searchExactMatchCore(remainingPt, npp, epp, currentTickets, bonusPercent);
}

// --- メイン計算 ---
export function calculateResources(
  input: CalcInput,
  rewardBentoAP: number,
  rewardShumaiAP: number,
  normalMinPerRun: number = DEFAULT_NORMAL_MIN_PER_RUN,
  eventMinPerRun: number = DEFAULT_EVENT_MIN_PER_RUN,
  showBilling: boolean = false,
): CalcResult {
  const {
    targetPt,
    currentPt,
    bonusPercent,
    currentTickets,
    bentoCount,
    shumaiCount,
    eventDays,
    currentDay,
    currentHour,
    naturalAPSimplify,
    naturalAPSubtract,
    ownedDiamonds,
    exactMatch,
    discountDiamonds,
    loginBonusRemaining,
    initialReleaseApCost = 0,
  } = input;

  const remainingPt = Math.max(0, targetPt - currentPt);
  const alreadyReached = targetPt <= currentPt;

  const effMult = 1 + bonusPercent / 100;
  const normalPtPerAP = Math.floor(BASE_NORMAL_PT_PER_AP * effMult);
  const eventPtPer10Ticket = Math.floor(BASE_EVENT_PT_PER_10_TICKETS * effMult);
  const ptPer10AP = 10 * normalPtPerAP + eventPtPer10Ticket;
  const ptPer200AP = 200 * normalPtPerAP + 20 * eventPtPer10Ticket;

  const ticketOnlyPoints = calcTicketOnlyPoints(currentTickets, bonusPercent);
  const ticketOnlyReached = ticketOnlyPoints >= remainingPt;

  const route = findMinRoute(remainingPt, normalPtPerAP, eventPtPer10Ticket, currentTickets);

  // 初回クリアコストAP: 必要APに加算する固定値
  const releaseApCost = Math.max(0, initialReleaseApCost);

  // キリ番調整 (全探索)
  let exactMatchInfo: ExactMatchInfo | null = null;
  if (exactMatch && !alreadyReached && remainingPt > 0) {
    exactMatchInfo = searchExactMatch(remainingPt, normalPtPerAP, eventPtPer10Ticket, currentTickets, bonusPercent);
  }

  // 初回クリアコストAPを必要APに加算
  const rawRequiredAP = exactMatch && exactMatchInfo ? exactMatchInfo.underAP : route.totalAP;
  const requiredTotalAP = rawRequiredAP + releaseApCost;

  // 自然回復AP
  const naturalAPRaw = calcNaturalAPByDaysAndHour(eventDays, currentDay, currentHour);
  let naturalAP = naturalAPRaw;

  // ログボAP (未獲得分のみ)
  let loginBonusAP = loginBonusRemaining.bento * BENTO_AP + loginBonusRemaining.shumai * SHUMAI_AP;

  if (naturalAPSimplify) {
    // 手動マイナス値は従来通り自然回復から差し引く
    const manualNaturalLoss = calcNaturalAPSubtract(eventDays, currentDay, naturalAPSubtract);
    naturalAP = Math.max(0, naturalAPRaw - manualNaturalLoss);

    // 達成日以降の自然回復とログボは、それぞれ対応する枠から独立して差し引く
    if (input.targetAchieveDay && input.targetAchieveDay > 0 && input.loginBonusSchedule) {
      const achieve = calcAchieveDaySubtract(eventDays, input.targetAchieveDay, input.loginBonusSchedule);
      naturalAP = Math.max(0, naturalAP - achieve.naturalLoss);
      loginBonusAP = Math.max(0, loginBonusAP - achieve.loginBonusLoss);
    }
  }
  // 所持アイテムAP
  const ownedItemAP = bentoCount * BENTO_AP + shumaiCount * SHUMAI_AP;
  // 報酬アイテムAP (現在pt以降〜目標ptまでに獲得予定の分)
  const rewardItemAP = rewardBentoAP + rewardShumaiAP;

  const nonDiamondAP = naturalAP + ownedItemAP + loginBonusAP + rewardItemAP;

  // ダイヤ回復AP = 必要AP - 非ダイヤAP
  const diamondRecoveryAP = Math.max(0, requiredTotalAP - nonDiamondAP);

  // 使用ダイヤ目安 = ダイヤ回復AP × 2
  let usedDiamonds = diamondRecoveryAP * DIAMONDS_PER_AP;
  let discountApplied = 0;
  if (discountDiamonds && diamondRecoveryAP > 0) {
    // 割引日数 = (現在日付から終了日までの日数) = eventDays - currentDay + 1
    // 開始日=1日目としてカウント、純粋な日付ベース
    const remainingDiscountDays = Math.max(0, eventDays - Math.max(1, currentDay) + 1);
    discountApplied = remainingDiscountDays * 10;
    usedDiamonds = Math.max(0, usedDiamonds - discountApplied);
  }

  // 不足ダイヤ目安 = max(0, 使用ダイヤ - 所持ダイヤ)
  const shortfallDiamonds = Math.max(0, usedDiamonds - ownedDiamonds);
  // 所持ダイヤ残り = max(0, 所持ダイヤ - 使用ダイヤ)
  const remainingDiamonds = Math.max(0, ownedDiamonds - usedDiamonds);

  const billingYen = showBilling ? calcBillingYen(shortfallDiamonds) : 0;

  // 所要時間
  const routeForTime = exactMatch && exactMatchInfo
    ? buildRouteInfo(exactMatchInfo.underAP, exactMatchInfo.underPoints, remainingPt, currentTickets)
    : route;
  const estimatedTime = calcEstimatedTime(
    routeForTime.normalRuns,
    routeForTime.eventRunCount,
    normalMinPerRun,
    eventMinPerRun,
  );

  // ダイヤ追加なし(所持ダイヤのみ使用)で獲得できるAP & ポイント
  // 報酬アイテムAPは目標ptまでの全報酬を含めず、実際に到達可能な報酬のみ反復計算で算出
  const nonDiamondBaseAP = naturalAP + ownedItemAP + loginBonusAP + Math.floor(ownedDiamonds / 2);
  const noExtraDiamondAP = calcNoExtraDiamondReachableAP(
    nonDiamondBaseAP, currentPt, normalPtPerAP, eventPtPer10Ticket, currentTickets,
    input.rewardEntries ?? [],
  );
  const nonDiamondPoints = computePoints(noExtraDiamondAP, normalPtPerAP, eventPtPer10Ticket, currentTickets);

  return {
    remainingPt,
    effMult,
    normalPtPerAP,
    eventPtPer10Ticket,
    ptPer10AP,
    ptPer200AP,
    route,
    exactMatchInfo,
    requiredTotalAP,
    naturalAP,
    naturalAPRaw,
    ownedItemAP,
    loginBonusAP,
    rewardItemAP,
    nonDiamondAP,
    diamondRecoveryAP,
    usedDiamonds,
    shortfallDiamonds,
    remainingDiamonds,
    discountApplied,
    billingYen,
    alreadyReached,
    ownedDiamonds,
    rewardBentoAP,
    rewardShumaiAP,
    estimatedTime,
    ticketOnlyPoints,
    ticketOnlyReached,
    nonDiamondPoints,
    noExtraDiamondAP,
  };
}

// --- AP → ポイント計算 (独立 Calculator) ---
export interface APToPointsResult {
  normalPoints: number;
  eventPoints: number;
  totalPoints: number;
  eventRunChunks: EventRunChunk[];
  eventRunCount: number;
  eventRunLabel: string;
  normalRuns: number;
  diamondsNeeded: number;
  billingYen: number;
}

export function calcAPToPoints(ap: number, bonusPercent: number, showBilling: boolean = false): APToPointsResult {
  const effMult = 1 + bonusPercent / 100;
  const npp = Math.floor(BASE_NORMAL_PT_PER_AP * effMult);
  const epp = Math.floor(BASE_EVENT_PT_PER_10_TICKETS * effMult);
  const totalTickets = ap;
  const usableTickets = Math.floor(totalTickets / 10) * 10;
  const chunks = chunkEventRuns(totalTickets);
  const normalPoints = ap * npp;
  const eventPoints = (usableTickets / 10) * epp;
  const diamondsNeeded = ap * DIAMONDS_PER_AP;

  return {
    normalPoints,
    eventPoints,
    totalPoints: normalPoints + eventPoints,
    eventRunChunks: chunks,
    eventRunCount: chunks.length,
    eventRunLabel: makeEventChunkLabel(chunks),
    normalRuns: Math.ceil(ap / 10),
    diamondsNeeded,
    billingYen: showBilling ? calcBillingYen(diamondsNeeded) : 0,
  };
}

// --- 報酬テーブルから所定pt以下の報酬を集計 ---
export interface RewardAggregation {
  diamonds: number;
  bentoAP: number;
  shumaiAP: number;
  bentoCount: number;
  shumaiCount: number;
  nextReward: { pt: number; name: string } | null;
  reachedCount: number;
  highestReached: { pt: number; name: string } | null;
}

export function aggregateRewards(
  pt: number,
  rewards: { pt: number; name: string; bento?: number; shumai?: number; diamonds?: number }[],
): RewardAggregation {
  let diamonds = 0;
  let bentoCount = 0;
  let shumaiCount = 0;
  let reachedCount = 0;
  let nextReward: { pt: number; name: string } | null = null;
  let highestReached: { pt: number; name: string } | null = null;

  for (const r of rewards) {
    if (pt >= r.pt) {
      reachedCount += 1;
      diamonds += r.diamonds ?? 0;
      bentoCount += r.bento ?? 0;
      shumaiCount += r.shumai ?? 0;
      if (!highestReached || r.pt > highestReached.pt) {
        highestReached = { pt: r.pt, name: r.name };
      }
    } else if (nextReward === null) {
      nextReward = { pt: r.pt, name: r.name };
    }
  }

  return {
    diamonds,
    bentoAP: bentoCount * BENTO_AP,
    shumaiAP: shumaiCount * SHUMAI_AP,
    bentoCount,
    shumaiCount,
    nextReward,
    reachedCount,
    highestReached,
  };
}

// --- 特効ボーナス計算 (3スロット固定: SSR, SR, R) ---
export interface BonusSlot {
  rarity: Rarity;
  limitBreak: number; // -1 = なし(0枚), 0〜5 = 無凸〜完凸
}

export function calcBonusTotal(slots: BonusSlot[]): number {
  return slots.reduce((sum, s) => {
    if (s.limitBreak < 0) return sum;
    const table = BONUS_TABLE[s.rarity];
    return sum + (table[s.limitBreak] ?? 0);
  }, 0);
}

// --- イベント開始日(date文字列)から現在日時を逆算 ---
// 現在〇日目: 純粋な日付ベース(開始日=1日目)
// 現在時: システム時刻の時間
export function calcProgressFromDateStart(
  startDateStr: string,
  now: Date = new Date(),
): { currentDay: number; currentHour: number } | null {
  if (!startDateStr.trim()) return null;
  const start = new Date(startDateStr + "T00:00:00");
  if (isNaN(start.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffMs = today.getTime() - startDay.getTime();
  if (diffMs < 0) return { currentDay: 1, currentHour: now.getHours() };
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return { currentDay: diffDays + 1, currentHour: now.getHours() };
}

// --- イベント終了日時を計算 (開始日 + 開催日数 - 1日, 終了21:00) ---
export function calcEventEndDateTime(startDateStr: string, eventDays: number): Date | null {
  if (!startDateStr.trim() || eventDays < 1) return null;
  const start = new Date(startDateStr + "T00:00:00");
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (eventDays - 1) * 24 * 60 * 60 * 1000);
  end.setHours(EVENT_END_HOUR, 0, 0, 0);
  return end;
}

// --- カウントダウン計算 ---
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  ended: boolean;
}

export function calcCountdown(endDate: Date, now: Date = new Date()): Countdown {
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, ended: true };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds, ended: false };
}

// --- 数値フォーマット ---
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("ja-JP");
}

export function formatCompact(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString("ja-JP");
}

// --- 3桁区切りカンマ表示用 (入力欄) ---
export function formatComma(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return Math.round(n).toLocaleString("ja-JP");
}

// --- カンマ付き文字列 → 数値 ---
export function parseCommaNum(s: string): number {
  const cleaned = s.replace(/,/g, "").trim();
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
