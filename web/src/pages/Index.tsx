import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Ticket,
  Plane,
  Calculator,
  Star,
  Gem,
  Compass,
  Briefcase,
  FileChartLine,
  ChevronDown,
  ChevronRight,
  Check,
  RotateCcw,
  Award,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Copy,
  Calendar,
  Zap,
  Gift,
  Settings,
  Upload,
  Download,
  AlertTriangle,
  Save,
  Timer,
  CreditCard,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

import {
  BONUS_TABLE,
  LIMIT_BREAK_LABELS,
  LIMIT_BREAK_LABELS_WITH_NONE,
  TARGET_PRESETS,
  DEFAULT_NORMAL_MIN_PER_RUN,
  DEFAULT_EVENT_MIN_PER_RUN,
  DEFAULT_LOGIN_BONUS_PATTERNS,
  BASE_NORMAL_PT_PER_AP,
  BASE_EVENT_PT_PER_10_TICKETS,
  TIME_BONUS,
  AP_PER_HOUR,
  AP_PER_DAY,
  FIRST_DAY_AP,
  EVENT_START_HOUR,
  EVENT_END_HOUR,
  BENTO_AP,
  SHUMAI_AP,
  DIAMONDS_PER_AP,
  DIAMONDS_PER_CHARGE,
  YEN_PER_CHARGE,
  MAX_TICKETS_PER_EVENT_RUN,
  MIN_TICKETS_PER_EVENT_RUN,
  type BonusSlot,
  type CalcInput,
  type Rarity,
  type LoginBonusPattern,
  type LoginBonusScheduleEntry,
  aggregateRewards,
  calcBonusTotal,
  calcAPToPoints,
  calcNaturalAPByDaysAndHour,
  calcNaturalAPSubtract,
  calcAchieveDaySubtract,
  DIFFICULTY_CLEAR_PT,
  DIFFICULTY_CLEAR_AP,
  calcProgressFromDateStart,
  calcEventEndDateTime,
  calcCountdown,
  calcTicketOnlyPoints,
  calculateResources,
  formatCompact,
  formatNumber,
  formatComma,
  parseCommaNum,
  getRemainingLoginBonus,
  sumLoginBonusSchedule,
  type Countdown,
} from "@/lib/calc";
import {
  DEFAULT_PATTERNS,
  type RewardEntry,
  type RewardPattern,
  genPatternId,
  loadActivePatternId,
  loadPatterns,
  saveActivePatternId,
  savePatterns,
  exportPatterns,
  importPatterns,
} from "@/lib/rewards";

type TabKey = "calc" | "apcalc" | "rewards";

// --- Themeable color tokens (driven by CSS Custom Properties) ---
const C = {
  primary: "var(--theme-base)",
  primaryLight: "var(--theme-gradient-start)",
  primaryDark: "var(--theme-gradient-end)",
  bg: "var(--theme-light)",
  text: "#3d3229",
  muted: "#8c7e6b",
  border: "var(--theme-border)",
  cardBg: "#ffffff",
  accent: "var(--theme-color)",
  base: "var(--theme-base)",
};

// --- LocalStorage keys ---
const SETTINGS_KEY = "18trip_settings_v3";
const FORM_KEY = "18trip_form_v3";
const SWITCHES_KEY = "18trip_switches_v3";
const SAVED_CALC_KEY = "18trip_saved_calc_v3";
const LOGIN_BONUS_PATTERNS_KEY = "18trip_logbo_patterns_v3";
const BONUS_SLOTS_KEY = "18trip_bonus_slots_v3";

interface AppSettings {
  normalMinPerRun: number;
  eventMinPerRun: number;
}

interface SwitchState {
  naturalAPSimplify: boolean;
  naturalAPSubtract: number;
  showBilling: boolean;
  exactMatch: boolean;
  discountDiamonds: boolean;
  showCountdown: boolean;
}

const DEFAULT_BONUS_SLOTS: BonusSlot[] = [
  { rarity: "SSR", limitBreak: -1 },
  { rarity: "SR", limitBreak: -1 },
  { rarity: "R", limitBreak: -1 },
];

const DEFAULT_SWITCHES: SwitchState = {
  naturalAPSimplify: false,
  naturalAPSubtract: 100,
  showBilling: false,
  exactMatch: false,
  discountDiamonds: false,
  showCountdown: false,
};

interface FormState {
  targetPt: string;
  currentPt: string;
  bonusPercent: string;
  currentTickets: string;
  bentoCount: string;
  shumai: string;
  ownedDiamonds: string;
  eventDays: string;
  currentDay: string;
  currentHour: string;
  eventStartDate: string;
  loginBonusPatternId: string;
  apCalc: string;
  apCalcBonus: string;
  targetAchieveDay: string;
}

function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return { normalMinPerRun: DEFAULT_NORMAL_MIN_PER_RUN, eventMinPerRun: DEFAULT_EVENT_MIN_PER_RUN };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { normalMinPerRun: DEFAULT_NORMAL_MIN_PER_RUN, eventMinPerRun: DEFAULT_EVENT_MIN_PER_RUN };
    const p = JSON.parse(raw) as Partial<AppSettings>;
    return {
      normalMinPerRun: p.normalMinPerRun ?? DEFAULT_NORMAL_MIN_PER_RUN,
      eventMinPerRun: p.eventMinPerRun ?? DEFAULT_EVENT_MIN_PER_RUN,
    };
  } catch {
    return { normalMinPerRun: DEFAULT_NORMAL_MIN_PER_RUN, eventMinPerRun: DEFAULT_EVENT_MIN_PER_RUN };
  }
}

function saveSettings(s: AppSettings): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* */ }
}

function loadSwitches(): SwitchState {
  if (typeof window === "undefined") return DEFAULT_SWITCHES;
  try {
    const raw = window.localStorage.getItem(SWITCHES_KEY);
    if (!raw) return DEFAULT_SWITCHES;
    return { ...DEFAULT_SWITCHES, ...(JSON.parse(raw) as Partial<SwitchState>) };
  } catch { return DEFAULT_SWITCHES; }
}

function saveSwitches(s: SwitchState): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SWITCHES_KEY, JSON.stringify(s)); } catch { /* */ }
}

function loadForm(): Partial<FormState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FORM_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<FormState>;
  } catch { return {}; }
}

function saveForm(s: FormState): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FORM_KEY, JSON.stringify(s)); } catch { /* */ }
}

interface SavedCalcData extends Partial<FormState> {
  diffClearApplied?: boolean;
  diffClearChecked?: Record<string, boolean>;
  targetAchieveDay?: string;
}

function loadSavedCalc(): SavedCalcData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_CALC_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCalcData;
  } catch { return null; }
}

function saveSavedCalc(s: Partial<FormState> & { diffClearApplied?: boolean; diffClearChecked?: Record<string, boolean> }): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SAVED_CALC_KEY, JSON.stringify(s)); } catch { /* */ }
}

function loadLoginBonusPatterns(): LoginBonusPattern[] {
  if (typeof window === "undefined") return DEFAULT_LOGIN_BONUS_PATTERNS;
  try {
    const raw = window.localStorage.getItem(LOGIN_BONUS_PATTERNS_KEY);
    if (!raw) return DEFAULT_LOGIN_BONUS_PATTERNS;
    const parsed = JSON.parse(raw) as LoginBonusPattern[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOGIN_BONUS_PATTERNS;
    return parsed;
  } catch { return DEFAULT_LOGIN_BONUS_PATTERNS; }
}

function saveLoginBonusPatterns(patterns: LoginBonusPattern[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LOGIN_BONUS_PATTERNS_KEY, JSON.stringify(patterns)); } catch { /* */ }
}

function loadBonusSlots(): BonusSlot[] {
  if (typeof window === "undefined") return DEFAULT_BONUS_SLOTS;
  try {
    const raw = window.localStorage.getItem(BONUS_SLOTS_KEY);
    if (!raw) return DEFAULT_BONUS_SLOTS;
    const parsed = JSON.parse(raw) as BonusSlot[];
    if (!Array.isArray(parsed) || parsed.length !== 3) return DEFAULT_BONUS_SLOTS;
    return parsed;
  } catch { return DEFAULT_BONUS_SLOTS; }
}

function saveBonusSlots(slots: BonusSlot[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(BONUS_SLOTS_KEY, JSON.stringify(slots)); } catch { /* */ }
}

// --- CommaInput: フォーカス時は純粋数字、ブラー時にカンマ表示 ---
interface CommaInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  suffix?: string;
  style?: React.CSSProperties;
}

const CommaInput = ({ value, onChange, placeholder, className, suffix, style }: CommaInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // フォーカス中は純粋数字、非フォーカス時はカンマ区切り
  const displayValue = isFocused
    ? value.replace(/,/g, "")
    : value;

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw === "") { onChange(""); return; }
    // フォーカス中はカンマなし、ブラー時にカンマ付与
    onChange(Number(raw).toLocaleString("ja-JP"));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // カンマを除去して全選択
    const clean = e.target.value.replace(/,/g, "");
    if (clean) {
      onChange(clean);
      requestAnimationFrame(() => {
        e.target.select();
      });
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // カンマ区切りに再変換
    if (value) {
      const num = Number(value.replace(/,/g, ""));
      if (Number.isFinite(num) && num > 0) {
        onChange(num.toLocaleString("ja-JP"));
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handle}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        style={style}
      />
      {suffix && (
        <span className="absolute right-3 text-lg pointer-events-none font-normal" style={{ color: C.muted }}>
          {suffix}
        </span>
      )}
    </div>
  );
};

// --- DigitBadges: 末尾に「0000」/「00000」/「000000」を追加するボタン ---
interface DigitBadgesProps {
  value: string;
  onChange: (v: string) => void;
}
const DigitBadges = ({ value, onChange }: DigitBadgesProps) => {
  const append = (zeros: number) => {
    const raw = value.replace(/[^\d]/g, "");
    const combined = raw + "0".repeat(zeros);
    if (combined === "") return;
    onChange(Number(combined).toLocaleString("ja-JP"));
  };
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => append(5)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >10万</button>
      <button
        type="button"
        onClick={() => append(6)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >100万</button>
      <button
        type="button"
        onClick={() => append(7)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >1000万</button>
    </div>
  );
};

// --- DigitBadgesInline: 行内配置用 (mtなし) ---
const DigitBadgesInline = ({ value, onChange }: DigitBadgesProps) => {
  const append = (zeros: number) => {
    const raw = value.replace(/[^\d]/g, "");
    const combined = raw + "0".repeat(zeros);
    if (combined === "") return;
    onChange(Number(combined).toLocaleString("ja-JP"));
  };
  return (
    <>
      <button
        type="button"
        onClick={() => append(5)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >10万</button>
      <button
        type="button"
        onClick={() => append(6)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >100万</button>
      <button
        type="button"
        onClick={() => append(7)}
        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.7)", color: C.muted }}
      >1000万</button>
    </>
  );
};

const Index = () => {
  const savedForm = loadForm();

  // --- 利用規約モーダル ---
  const [termsOpen, setTermsOpen] = useState<boolean>(false);
  useEffect(() => {
    if (termsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [termsOpen]);
  // --- 入力状態 (カンマ付き文字列) ---
  const [targetPtStr, setTargetPtStr] = useState<string>(savedForm.targetPt ?? "");
  const [targetPointMode, setTargetPointMode] = useState<string>("manual");
  const [currentPtStr, setCurrentPtStr] = useState<string>(savedForm.currentPt ?? "");
  const [bonusPercentStr, setBonusPercentStr] = useState<string>(savedForm.bonusPercent ?? "");
  const [currentTicketsStr, setCurrentTicketsStr] = useState<string>(savedForm.currentTickets ?? "");
  const [bentoCountStr, setBentoCountStr] = useState<string>(savedForm.bentoCount ?? "");
  const [shumaiCountStr, setShumaiCountStr] = useState<string>(savedForm.shumai ?? "");
  const [ownedDiamondsStr, setOwnedDiamondsStr] = useState<string>(savedForm.ownedDiamonds ?? "");

  // --- 期間 (手動入力) ---
  const [eventDaysStr, setEventDaysStr] = useState<string>(savedForm.eventDays ?? "9");
  const [currentDayStr, setCurrentDayStr] = useState<string>(savedForm.currentDay ?? "1");
  const [currentHourStr, setCurrentHourStr] = useState<string>(savedForm.currentHour ?? "16");

  // --- イベント開始日 (date picker: YYYY-MM-DD) ---
  const [eventStartDate, setEventStartDate] = useState<string>(savedForm.eventStartDate ?? "");

  // --- ログインボーナスパターン ---
  const [loginBonusPatterns, setLoginBonusPatterns] = useState<LoginBonusPattern[]>(() => loadLoginBonusPatterns());
  const [loginBonusPatternId, setLoginBonusPatternId] = useState<string>(savedForm.loginBonusPatternId ?? DEFAULT_LOGIN_BONUS_PATTERNS[0].id);

  // --- AP計算機 ---
  const [apCalcStr, setApCalcStr] = useState<string>(savedForm.apCalc ?? "200");
  const [apCalcBonusStr, setApCalcBonusStr] = useState<string>(savedForm.apCalcBonus ?? "");

  // --- 達成日目標 (自然回復AP試算用) ---
  const [targetAchieveDayStr, setTargetAchieveDayStr] = useState<string>(savedForm.targetAchieveDay ?? "");

  // --- 初回難易度解放 ---
  const [diffClearChecked, setDiffClearChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return { EASY: false, NORMAL: false, HARD: false };
    try {
      const raw = window.localStorage.getItem("18trip_diff_clear_v3");
      if (!raw) return { EASY: false, NORMAL: false, HARD: false };
      return JSON.parse(raw) as Record<string, boolean>;
    } catch { return { EASY: false, NORMAL: false, HARD: false }; }
  });
  const [diffClearApplied, setDiffClearApplied] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("18trip_diff_applied_v3") === "true"; } catch { return false; }
  });
  const [initialReleaseApCost, setInitialReleaseApCost] = useState<number>(0);
  const [diffClearPopoverOpen, setDiffClearPopoverOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("18trip_diff_clear_v3", JSON.stringify(diffClearChecked)); } catch { /* */ }
  }, [diffClearChecked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("18trip_diff_applied_v3", String(diffClearApplied)); } catch { /* */ }
  }, [diffClearApplied]);

  // --- スイッチ ---
  const [sw, setSw] = useState<SwitchState>(() => loadSwitches());

  // --- モーダル ---
  const [bonusModalOpen, setBonusModalOpen] = useState<boolean>(false);
  const [bonusSlots, setBonusSlots] = useState<BonusSlot[]>(() => loadBonusSlots());
  const [diffClearBonusSlots, setDiffClearBonusSlots] = useState<BonusSlot[]>(() => loadBonusSlots());
  const [isDiffClearBonusCustomized, setIsDiffClearBonusCustomized] = useState<boolean>(false);

  // --- 報酬パターン ---
  const [patterns, setPatterns] = useState<RewardPattern[]>(() => loadPatterns());
  const [activePatternId, setActivePatternId] = useState<string>(() => loadActivePatternId("normal_season"));
  const [rewardEditOpen, setRewardEditOpen] = useState<boolean>(false);
  const [editingPattern, setEditingPattern] = useState<RewardPattern | null>(null);

  // --- 設定 ---
  const initialSettings = loadSettings();
  const [normalMinStr, setNormalMinStr] = useState<string>(String(initialSettings.normalMinPerRun));
  const [eventMinStr, setEventMinStr] = useState<string>(String(initialSettings.eventMinPerRun));

  // --- 詳細バックアップ ---
  const [detailBackupOpen, setDetailBackupOpen] = useState<boolean>(false);
  const [detailBackupSel, setDetailBackupSel] = useState<Record<string, boolean>>({
    rewards: true,
    basePoints: true,
    bonusRate: true,
    calcDetail: true,
    formulas: true,
  });

  // --- 結果 ---
  const [result, setResult] = useState<ReturnType<typeof calculateResources> | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("calc");

  // --- カウントダウン ---
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  // --- 永続化 ---
  useEffect(() => { savePatterns(patterns); }, [patterns]);
  useEffect(() => { saveActivePatternId(activePatternId); }, [activePatternId]);
  useEffect(() => { saveSwitches(sw); }, [sw]);
  useEffect(() => { saveLoginBonusPatterns(loginBonusPatterns); }, [loginBonusPatterns]);
  useEffect(() => { saveBonusSlots(bonusSlots); }, [bonusSlots]);
  useEffect(() => {
    saveForm({
      targetPt: targetPtStr, currentPt: currentPtStr, bonusPercent: bonusPercentStr,
      currentTickets: currentTicketsStr, bentoCount: bentoCountStr, shumai: shumaiCountStr,
      ownedDiamonds: ownedDiamondsStr, eventDays: eventDaysStr,
      currentDay: currentDayStr, currentHour: currentHourStr,
      eventStartDate, loginBonusPatternId,
      apCalc: apCalcStr, apCalcBonus: apCalcBonusStr,
      targetAchieveDay: targetAchieveDayStr,
    });
  }, [targetPtStr, currentPtStr, bonusPercentStr, currentTicketsStr, bentoCountStr, shumaiCountStr, ownedDiamondsStr, eventDaysStr, currentDayStr, currentHourStr, eventStartDate, loginBonusPatternId, apCalcStr, apCalcBonusStr, targetAchieveDayStr]);

  const activePattern = useMemo(
    () => patterns.find((p) => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );

  const activeLoginBonusPattern = useMemo(
    () => loginBonusPatterns.find((p) => p.id === loginBonusPatternId) ?? loginBonusPatterns[0],
    [loginBonusPatterns, loginBonusPatternId],
  );

  // --- 数値パース ---
  const targetPt = parseCommaNum(targetPtStr);
  const currentPt = parseCommaNum(currentPtStr);
  const bonusPercent = parseCommaNum(bonusPercentStr);
  const currentTickets = parseCommaNum(currentTicketsStr);
  const eventDays = parseCommaNum(eventDaysStr);
  const currentDay = parseCommaNum(currentDayStr);
  const currentHour = parseCommaNum(currentHourStr);
  const targetAchieveDay = parseCommaNum(targetAchieveDayStr);

  // --- 達成日目標から自然回復・ログボの自動マイナス値を個別計算 ---
  const achieveDaySubtract = useMemo(() => {
    if (targetAchieveDay <= 0 || eventDays <= 0) {
      return { naturalLoss: 0, loginBonusLoss: 0, total: 0 };
    }
    return calcAchieveDaySubtract(eventDays, targetAchieveDay, activeLoginBonusPattern.schedule);
  }, [targetAchieveDay, eventDays, activeLoginBonusPattern]);

  // --- 初回難易度解放pt計算 ---
  // 未変更時はメインの特効%を使用し、カード枚数を変更した後だけ初回クリア専用%を使用する
  const diffClearBonusPercent = useMemo(
    () => isDiffClearBonusCustomized ? calcBonusTotal(diffClearBonusSlots) : bonusPercent,
    [isDiffClearBonusCustomized, diffClearBonusSlots, bonusPercent],
  );
  const visibleDiffClearBonusSlots = isDiffClearBonusCustomized ? diffClearBonusSlots : bonusSlots;
  const diffClearPts = useMemo(() => {
    const effMult = 1 + diffClearBonusPercent / 100;
    return (Object.keys(DIFFICULTY_CLEAR_PT) as string[]).map((name) => ({
      name,
      pt: Math.floor(DIFFICULTY_CLEAR_PT[name] * effMult),
      checked: diffClearChecked[name] ?? false,
    }));
  }, [diffClearBonusPercent, diffClearChecked]);

  const diffClearUnclearedCount = useMemo(
    () => diffClearPts.filter((d) => !d.checked).length,
    [diffClearPts],
  );

  // 未クリア難易度のpt合計 (10AP分の通常獲得pt + 各難易度初回クリアpt)
  const diffClearTotalPt = useMemo(() => {
    const npp = Math.floor(1800 * (1 + diffClearBonusPercent / 100));
    const uncleared = diffClearPts.filter((d) => !d.checked);
    const apPt = uncleared.length * 10 * npp; // 未クリア数 × 10AP分の通常獲得pt
    const clearPt = uncleared.reduce((sum, d) => sum + d.pt, 0);
    return apPt + clearPt;
  }, [diffClearPts, diffClearBonusPercent]);

  // 初回クリアコストAP (未クリア数 × 10AP) — 必要APに加算
  const initialReleaseApCostValue = useMemo(
    () => diffClearUnclearedCount * DIFFICULTY_CLEAR_AP,
    [diffClearUnclearedCount],
  );

  // すべてチェック済み（VERY HARD解放済み）かどうか
  const allDiffCleared = diffClearPts.length > 0 && diffClearPts.every((d) => d.checked);

  // バッジ非表示条件: 獲得ポイントに反映済み(ボタン押下後のみ非表示)
  // allDiffCleared(全チェック)時はバッジを表示したままにし、ボタン押下で非表示にする
  const diffBadgeHidden = diffClearApplied;

  // 獲得ポイントに反映する
  const handleApplyDiffClear = () => {
    if (allDiffCleared) {
      toast.success("初回クリア完了済み/バッジを非表示に変更");
      setDiffClearApplied(true);
      setDiffClearPopoverOpen(false);
      return;
    }
    if (diffClearTotalPt <= 0) return;
    const currentNum = parseCommaNum(currentPtStr);
    const newPt = currentNum + diffClearTotalPt;
    setCurrentPtStr(formatComma(newPt) || String(newPt));
    setInitialReleaseApCost(initialReleaseApCostValue);
    setDiffClearApplied(true);
    setDiffClearPopoverOpen(false);
    const unclearedCount = diffClearUnclearedCount;
    toast.success(
      `通常${unclearedCount}回分含め${formatNumber(diffClearTotalPt)}pt獲得\n初回クリア用の${initialReleaseApCostValue}APを必要コストに追加`,
    );
  };

  // --- ログインボーナス未獲得分 (自動除外) ---
  const loginBonusRemaining = useMemo(() => {
    return getRemainingLoginBonus(activeLoginBonusPattern.schedule, currentDay);
  }, [activeLoginBonusPattern, currentDay]);

  const loginBonusTotal = useMemo(() => {
    return sumLoginBonusSchedule(activeLoginBonusPattern.schedule);
  }, [activeLoginBonusPattern]);

  // --- 切符リアルタイム見積もり ---
  const ticketEstimate = useMemo(() => {
    if (currentTickets <= 0) return null;
    return calcTicketOnlyPoints(currentTickets, bonusPercent);
  }, [currentTickets, bonusPercent]);

  // --- 報酬集計 ---
  const rewardAgg = useMemo(
    () => aggregateRewards(currentPt, activePattern?.rewards ?? []),
    [currentPt, activePattern],
  );
  const targetRewardAgg = useMemo(
    () => aggregateRewards(targetPt, activePattern?.rewards ?? []),
    [targetPt, activePattern],
  );

  // 報酬アイテムAP: 現在pt〜目標ptの間に獲得する分のみ (自動除外)
  const remainingRewardBentoAP = useMemo(
    () => Math.max(0, targetRewardAgg.bentoAP - rewardAgg.bentoAP),
    [targetRewardAgg, rewardAgg],
  );
  const remainingRewardShumaiAP = useMemo(
    () => Math.max(0, targetRewardAgg.shumaiAP - rewardAgg.shumaiAP),
    [targetRewardAgg, rewardAgg],
  );

  // --- AP計算機 ---
  const apCalcResult = useMemo(() => {
    const ap = parseCommaNum(apCalcStr);
    const bonus = parseCommaNum(apCalcBonusStr);
    if (ap <= 0) return null;
    return calcAPToPoints(ap, bonus, sw.showBilling);
  }, [apCalcStr, apCalcBonusStr, sw.showBilling]);

  // --- 自然回復AP 計算 ---
  const naturalAPRaw = useMemo(() => {
    return calcNaturalAPByDaysAndHour(eventDays, currentDay, currentHour);
  }, [eventDays, currentDay, currentHour]);

  // --- カウントダウン (1秒更新) ---
  useEffect(() => {
    if (!sw.showCountdown || !eventStartDate || eventDays < 1) {
      setCountdown(null);
      return;
    }
    const endDT = calcEventEndDateTime(eventStartDate, eventDays);
    if (!endDT) {
      setCountdown(null);
      return;
    }
    const update = () => {
      setCountdown(calcCountdown(endDT, new Date()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sw.showCountdown, eventStartDate, eventDays]);

  // --- 計算実行 ---
  const runCalculation = useCallback((options?: { showToast?: boolean; scrollToResult?: boolean; overrideBonusPercent?: number }) => {
    if (targetPt <= 0 || eventDays < 1) return null;

    // 未入力時は1日目16時として扱う
    const useCurrentDay = currentDay >= 1 ? currentDay : 1;
    const useCurrentHour = currentHour >= 0 && currentHour <= 23 ? currentHour : 16;

    const newSettings: AppSettings = {
      normalMinPerRun: parseCommaNum(normalMinStr) || DEFAULT_NORMAL_MIN_PER_RUN,
      eventMinPerRun: parseCommaNum(eventMinStr) || DEFAULT_EVENT_MIN_PER_RUN,
    };
    saveSettings(newSettings);

    const input: CalcInput = {
      targetPt,
      currentPt,
      bonusPercent: options?.overrideBonusPercent ?? bonusPercent,
      currentTickets,
      bentoCount: parseCommaNum(bentoCountStr),
      shumaiCount: parseCommaNum(shumaiCountStr),
      eventDays,
      currentDay: useCurrentDay,
      currentHour: useCurrentHour,
      naturalAPSimplify: sw.naturalAPSimplify,
      naturalAPSubtract: sw.naturalAPSubtract,
      ownedDiamonds: parseCommaNum(ownedDiamondsStr),
      exactMatch: sw.exactMatch,
      discountDiamonds: sw.discountDiamonds,
      loginBonusRemaining,
      initialReleaseApCost: initialReleaseApCost,
      rewardEntries: activePattern?.rewards ?? [],
      targetAchieveDay: parseCommaNum(targetAchieveDayStr) || 0,
      loginBonusSchedule: activeLoginBonusPattern.schedule,
    };

    const res = calculateResources(
      input,
      remainingRewardBentoAP,
      remainingRewardShumaiAP,
      newSettings.normalMinPerRun,
      newSettings.eventMinPerRun,
      sw.showBilling,
    );
    setResult(res);

    if (options?.showToast) {
      if (res.alreadyReached) {
        toast.success("すでに目標ポイントに到達しています！");
      } else {
        toast.success("計算完了！", { description: `使用ダイヤ目安: ${formatNumber(res.usedDiamonds)} 個` });
      }
    }

    if (options?.scrollToResult) {
      requestAnimationFrame(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    return res;
  }, [
    targetPt,
    eventDays,
    currentDay,
    currentHour,
    normalMinStr,
    eventMinStr,
    currentPt,
    bonusPercent,
    currentTickets,
    bentoCountStr,
    shumaiCountStr,
    sw,
    ownedDiamondsStr,
    loginBonusRemaining,
    initialReleaseApCost,
    activePattern,
    targetAchieveDayStr,
    activeLoginBonusPattern,
    remainingRewardBentoAP,
    remainingRewardShumaiAP,
  ]);

  const handleCalculate = () => {
    if (targetPt <= 0) { toast.error("目標ポイントを入力してください"); return; }
    if (eventDays < 1) { toast.error("開催日数を入力してください"); return; }
    runCalculation({ showToast: true, scrollToResult: true });
  };

  const handleBonusPercentChange = useCallback((value: string) => {
    if (value === "") {
      setBonusPercentStr("");
      return;
    }

    const parsed = parseInt(value.replace(/,/g, ""), 10);
    if (Number.isNaN(parsed)) {
      setBonusPercentStr("");
      return;
    }

    setBonusPercentStr(parsed.toLocaleString("ja-JP"));
  }, []);

  const hasCalculated = result !== null;

  useEffect(() => {
    if (!hasCalculated) return;
    runCalculation();
  }, [bonusPercentStr, hasCalculated, runCalculation]);

  // --- 進捗更新: date pickerから現在日時を逆算 ---
  const handleProgressUpdate = () => {
    const result = calcProgressFromDateStart(eventStartDate);
    if (!result) {
      toast.error("イベント開始日を入力してください");
      return;
    }
    setCurrentDayStr(String(result.currentDay));
    setCurrentHourStr(String(result.currentHour));
    toast.success(`進捗を更新しました: ${result.currentDay}日目 ${result.currentHour}時`);
  };

  // --- 計算タブ入力保存 ---
  const handleSaveCalcInputs = () => {
    saveSavedCalc({
      targetPt: targetPtStr, currentPt: currentPtStr, bonusPercent: bonusPercentStr,
      currentTickets: currentTicketsStr, bentoCount: bentoCountStr, shumai: shumaiCountStr,
      ownedDiamonds: ownedDiamondsStr, eventDays: eventDaysStr,
      currentDay: currentDayStr, currentHour: currentHourStr,
      eventStartDate, loginBonusPatternId,
      apCalc: apCalcStr, apCalcBonus: apCalcBonusStr,
      targetAchieveDay: targetAchieveDayStr,
      diffClearApplied,
      diffClearChecked,
    });
    toast.success("計算タブの入力を保存しました");
  };

  const handleRestoreCalcInputs = () => {
    const saved = loadSavedCalc();
    if (!saved) { toast.error("保存されたデータがありません"); return; }
    if (saved.targetPt !== undefined) setTargetPtStr(saved.targetPt);
    if (saved.currentPt !== undefined) setCurrentPtStr(saved.currentPt);
    if (saved.bonusPercent !== undefined) setBonusPercentStr(saved.bonusPercent);
    if (saved.currentTickets !== undefined) setCurrentTicketsStr(saved.currentTickets);
    if (saved.bentoCount !== undefined) setBentoCountStr(saved.bentoCount);
    if (saved.shumai !== undefined) setShumaiCountStr(saved.shumai);
    if (saved.ownedDiamonds !== undefined) setOwnedDiamondsStr(saved.ownedDiamonds);
    if (saved.eventDays !== undefined) setEventDaysStr(saved.eventDays);
    if (saved.currentDay !== undefined) setCurrentDayStr(saved.currentDay);
    if (saved.currentHour !== undefined) setCurrentHourStr(saved.currentHour);
    if (saved.eventStartDate !== undefined) setEventStartDate(saved.eventStartDate);
    if (saved.loginBonusPatternId !== undefined) setLoginBonusPatternId(saved.loginBonusPatternId);
    if (saved.apCalc !== undefined) setApCalcStr(saved.apCalc);
    if (saved.apCalcBonus !== undefined) setApCalcBonusStr(saved.apCalcBonus);
    if (saved.targetAchieveDay !== undefined) setTargetAchieveDayStr(saved.targetAchieveDay);
    if (saved.diffClearApplied !== undefined) setDiffClearApplied(saved.diffClearApplied);
    if (saved.diffClearChecked !== undefined) setDiffClearChecked(saved.diffClearChecked);
    toast.success("保存した入力を復元しました");
  };

  const handleReset = () => {
    setActivePatternId("normal_season");
    setTargetPtStr("0");
    setTargetPointMode("manual");
    setCurrentPtStr("");
    setBonusPercentStr("");
    setCurrentTicketsStr("");
    setBentoCountStr("");
    setShumaiCountStr("");
    setOwnedDiamondsStr("");
    setEventDaysStr("9");
    setCurrentDayStr("1");
    setCurrentHourStr("16");
    setEventStartDate("");
    setTargetAchieveDayStr("");
    setBonusSlots(DEFAULT_BONUS_SLOTS.map(s => ({ ...s })));
    setDiffClearBonusSlots(DEFAULT_BONUS_SLOTS.map(s => ({ ...s })));
    setIsDiffClearBonusCustomized(false);
    setSw(DEFAULT_SWITCHES);
    setResult(null);
    setDiffClearChecked({ EASY: false, NORMAL: false, HARD: false });
    setDiffClearApplied(false);
    setInitialReleaseApCost(0);
    try { window.localStorage.removeItem("18trip_diff_applied_v3"); } catch { /* */ }
    toast("入力をリセットしました");
  };

  // --- 特効モーダル ---
  const modalTotal = useMemo(() => calcBonusTotal(bonusSlots), [bonusSlots]);
  const updateSlot = (idx: number, patch: Partial<BonusSlot>) => {
    setBonusSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const applyBonus = () => {
    setBonusPercentStr(String(modalTotal));
    setBonusModalOpen(false);
    toast.success(`特効ボーナス ${modalTotal}% を適用しました`);
  };

  // --- 報酬パターン操作 ---
  const handleSelectPattern = (id: string) => {
    setActivePatternId(id);
    // パターン変更時に開催日数を自動設定: フィーチャー=10, 通常/班=9
    const p = patterns.find((x) => x.id === id) ?? patterns[0];
    const autoDays = p.id === "feature" ? 10 : 9;
    setEventDaysStr(String(autoDays));
    // 現在日が開催日数を超える場合は補正
    const cd = parseCommaNum(currentDayStr);
    if (cd > autoDays) setCurrentDayStr(String(autoDays));
  };
  const handleAddPattern = () => {
    const np: RewardPattern = { id: genPatternId(), name: `新しい報酬表 ${patterns.length + 1}`, rewards: [], loginBonus: { bento: 0, shumai: 0 } };
    setPatterns((prev) => [...prev, np]);
    setActivePatternId(np.id);
    setEditingPattern(np);
    setRewardEditOpen(true);
    toast("新しい報酬表を作成しました");
  };
  const handleEditPattern = (p: RewardPattern) => {
    setEditingPattern({ ...p, rewards: p.rewards.map((r) => ({ ...r })) });
    setRewardEditOpen(true);
  };
  const handleDuplicatePattern = (p: RewardPattern) => {
    const copy: RewardPattern = { id: genPatternId(), name: `${p.name} のコピー`, rewards: p.rewards.map((r) => ({ ...r })), loginBonus: { ...p.loginBonus } };
    setPatterns((prev) => [...prev, copy]);
    setActivePatternId(copy.id);
    toast("報酬表を複製しました");
  };
  const handleDeletePattern = (p: RewardPattern) => {
    if (p.isDefault) { toast.error("デフォルトの報酬表は削除できません"); return; }
    if (patterns.length <= 1) { toast.error("すべての報酬表を削除することはできません"); return; }
    setPatterns((prev) => prev.filter((x) => x.id !== p.id));
    if (activePatternId === p.id) setActivePatternId(patterns[0].id);
    toast("報酬表を削除しました");
  };
  const handleSavePattern = () => {
    if (!editingPattern) return;
    if (!editingPattern.name.trim()) { toast.error("報酬表名を入力してください"); return; }
    const sorted: RewardPattern = { ...editingPattern, rewards: [...editingPattern.rewards].sort((a, b) => a.pt - b.pt) };
    setPatterns((prev) => prev.some((p) => p.id === sorted.id) ? prev.map((p) => (p.id === sorted.id ? sorted : p)) : [...prev, sorted]);
    setActivePatternId(sorted.id);
    setRewardEditOpen(false);
    setEditingPattern(null);
    toast.success("報酬表を保存しました");
  };
  const updateEditingReward = (idx: number, patch: Partial<RewardEntry>) => {
    if (!editingPattern) return;
    setEditingPattern({ ...editingPattern, rewards: editingPattern.rewards.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  };
  const addEditingReward = () => {
    if (!editingPattern) return;
    setEditingPattern({ ...editingPattern, rewards: [...editingPattern.rewards, { pt: 0, name: "新規報酬" }] });
  };
  const removeEditingReward = (idx: number) => {
    if (!editingPattern) return;
    setEditingPattern({ ...editingPattern, rewards: editingPattern.rewards.filter((_, i) => i !== idx) });
  };

  // --- ログインボーナス編集 ---
  const [loginBonusEditOpen, setLoginBonusEditOpen] = useState<boolean>(false);
  const [editingLoginBonusPattern, setEditingLoginBonusPattern] = useState<LoginBonusPattern | null>(null);

  const handleEditLoginBonusPattern = (p: LoginBonusPattern) => {
    setEditingLoginBonusPattern({ ...p, schedule: p.schedule.map((e) => ({ ...e })) });
    setLoginBonusEditOpen(true);
  };
  const handleSaveLoginBonusPattern = () => {
    if (!editingLoginBonusPattern) return;
    if (!editingLoginBonusPattern.name.trim()) { toast.error("名前を入力してください"); return; }
    const sorted: LoginBonusPattern = {
      ...editingLoginBonusPattern,
      schedule: [...editingLoginBonusPattern.schedule].sort((a, b) => a.day - b.day),
    };
    setLoginBonusPatterns((prev) =>
      prev.some((p) => p.id === sorted.id)
        ? prev.map((p) => (p.id === sorted.id ? sorted : p))
        : [...prev, sorted],
    );
    setLoginBonusPatternId(sorted.id);
    setLoginBonusEditOpen(false);
    setEditingLoginBonusPattern(null);
    toast.success("ログインボーナスを保存しました");
  };
  const handleAddLoginBonusPattern = () => {
    const np: LoginBonusPattern = {
      id: `logbo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: `新しいログインボーナス ${loginBonusPatterns.length + 1}`,
      schedule: [],
    };
    setLoginBonusPatterns((prev) => [...prev, np]);
    setLoginBonusPatternId(np.id);
    setEditingLoginBonusPattern(np);
    setLoginBonusEditOpen(true);
    toast("新しいログインボーナスを作成しました");
  };
  const handleDeleteLoginBonusPattern = (p: LoginBonusPattern) => {
    if (p.id === DEFAULT_LOGIN_BONUS_PATTERNS[0].id) {
      toast.error("基本ログインボーナスは削除できません");
      return;
    }
    setLoginBonusPatterns((prev) => prev.filter((x) => x.id !== p.id));
    if (loginBonusPatternId === p.id) setLoginBonusPatternId(DEFAULT_LOGIN_BONUS_PATTERNS[0].id);
    toast("ログインボーナスを削除しました");
  };
  const updateEditingLogBonusEntry = (idx: number, patch: Partial<LoginBonusScheduleEntry>) => {
    if (!editingLoginBonusPattern) return;
    setEditingLoginBonusPattern({
      ...editingLoginBonusPattern,
      schedule: editingLoginBonusPattern.schedule.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    });
  };
  const addEditingLogBonusEntry = () => {
    if (!editingLoginBonusPattern) return;
    setEditingLoginBonusPattern({
      ...editingLoginBonusPattern,
      schedule: [...editingLoginBonusPattern.schedule, { day: 1 }],
    });
  };
  const removeEditingLogBonusEntry = (idx: number) => {
    if (!editingLoginBonusPattern) return;
    setEditingLoginBonusPattern({
      ...editingLoginBonusPattern,
      schedule: editingLoginBonusPattern.schedule.filter((_, i) => i !== idx),
    });
  };

  // --- データバックアップ ---
  const handleExport = () => {
    const json = exportPatterns(patterns);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reward_patterns_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("報酬表をエクスポートしました");
  };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importPatterns(String(reader.result));
      if (!imported) { toast.error("インポートに失敗しました"); return; }
      setPatterns(imported);
      setActivePatternId(imported[0].id);
      toast.success(`${imported.length}件の報酬表をインポートしました`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- 詳細バックアップ(エクスポート専用) ---
  const handleDetailExport = () => {
    const lines: string[] = [];
    lines.push("========================================");
    lines.push("18TRIP イベントpt計算機(非公式) 詳細バックアップ");
    lines.push(`出力日時: ${new Date().toLocaleString("ja-JP")}`);
    lines.push("========================================");
    lines.push("");

    if (detailBackupSel.rewards) {
      lines.push("■ 報酬表データ");
      lines.push("----------------------------------------");
      for (const p of patterns) {
        lines.push(`
【${p.name}】 (ID: ${p.id}${p.isDefault ? ", デフォルト" : ""})`);
        lines.push(`  ログインボーナス: 弁当${p.loginBonus.bento}個, シュウマイ${p.loginBonus.shumai}個`);
        lines.push(`  報酬件数: ${p.rewards.length}件`);
        for (const r of p.rewards) {
          const extras: string[] = [];
          if (r.diamonds) extras.push(`ダイヤ${r.diamonds}`);
          if (r.bento) extras.push(`弁当${r.bento}`);
          if (r.shumai) extras.push(`シュウマイ${r.shumai}`);
          lines.push(`  ${r.pt.toLocaleString("ja-JP")}pt: ${r.name}${extras.length > 0 ? ` [${extras.join(", ")}]` : ""}`);
        }
      }
      lines.push("");
    }

    if (detailBackupSel.basePoints) {
      lines.push("■ 基本ポイント");
      lines.push("----------------------------------------");
      lines.push(`  通常1APあたり: ${BASE_NORMAL_PT_PER_AP.toLocaleString("ja-JP")}pt (特効0%時)`);
      lines.push(`  イベント切符10枚あたり: ${BASE_EVENT_PT_PER_10_TICKETS.toLocaleString("ja-JP")}pt (特効0%時, VERY HARD)`);
      lines.push(`  タイムボーナス: ${TIME_BONUS.toLocaleString("ja-JP")}pt`);
      lines.push(`  自然回復: 1時間${AP_PER_HOUR}AP / 1日${AP_PER_DAY}AP`);
      lines.push(`  初日開始: ${FIRST_DAY_AP}時 / 最終日終了: ${EVENT_END_HOUR}時`);
      lines.push(`  ダイヤ→AP: ${DIAMONDS_PER_AP}ダイヤ=1AP`);
      lines.push(`  課金額計算: ${DIAMONDS_PER_CHARGE}ダイヤ=${YEN_PER_CHARGE.toLocaleString("ja-JP")}円 (1000の位で切り上げ)`);
      lines.push("");
    }

    if (detailBackupSel.bonusRate) {
      lines.push("■ ユーザーが選択した特効の倍率");
      lines.push("----------------------------------------");
      lines.push(`  設定中の特効ボーナス: ${bonusPercent}%`);
      lines.push(`  有効倍率: ×${(1 + bonusPercent / 100).toFixed(3)}`);
      lines.push(`  通常1APあたり(特効込み): ${Math.floor(BASE_NORMAL_PT_PER_AP * (1 + bonusPercent / 100)).toLocaleString("ja-JP")}pt`);
      lines.push(`  イベント切符10枚あたり(特効込み): ${Math.floor(BASE_EVENT_PT_PER_10_TICKETS * (1 + bonusPercent / 100)).toLocaleString("ja-JP")}pt`);
      lines.push("  特効カード編成:");
      for (const s of bonusSlots) {
        const lbl = s.limitBreak < 0 ? "なし" : LIMIT_BREAK_LABELS[s.limitBreak];
        const val = s.limitBreak < 0 ? 0 : BONUS_TABLE[s.rarity][s.limitBreak];
        lines.push(`    ${s.rarity}: ${lbl} (${val}%)`);
      }
      lines.push(`  合計特効: ${calcBonusTotal(bonusSlots)}%`);
      lines.push("");
    }

    if (detailBackupSel.calcDetail) {
      lines.push("■ 計算詳細の項目");
      lines.push("----------------------------------------");
      lines.push(`  目標ポイント: ${targetPt.toLocaleString("ja-JP")}pt`);
      lines.push(`  現在の獲得ポイント: ${currentPt.toLocaleString("ja-JP")}pt`);
      lines.push(`  不足ポイント: ${Math.max(0, targetPt - currentPt).toLocaleString("ja-JP")}pt`);
      lines.push(`  所持切符: ${currentTickets.toLocaleString("ja-JP")}枚`);
      lines.push(`  所持ダイヤ: ${parseCommaNum(ownedDiamondsStr).toLocaleString("ja-JP")}個`);
      lines.push(`  シュウマイ弁当: ${parseCommaNum(bentoCountStr).toLocaleString("ja-JP")}個`);
      lines.push(`  シュウマイ: ${parseCommaNum(shumaiCountStr).toLocaleString("ja-JP")}個`);
      lines.push(`  開催日数: ${eventDays}日`);
      lines.push(`  現在: ${currentDay}日目 ${currentHour}時`);
      lines.push(`  所要時間設定: 通常${parseCommaNum(normalMinStr) || DEFAULT_NORMAL_MIN_PER_RUN}分/回, イベント${parseCommaNum(eventMinStr) || DEFAULT_EVENT_MIN_PER_RUN}分/回`);
      lines.push("");
    }

    if (detailBackupSel.formulas) {
      lines.push("■ 計算式データ");
      lines.push("----------------------------------------");
      lines.push("  【通常ポイント計算式】");
      lines.push(`    通常pt = 消費AP × floor(${BASE_NORMAL_PT_PER_AP} × (1 + 特効% / 100))`);
      lines.push(`    例: 10AP消費時 = 10 × floor(${BASE_NORMAL_PT_PER_AP} × (1 + ${bonusPercent} / 100)) = ${(10 * Math.floor(BASE_NORMAL_PT_PER_AP * (1 + bonusPercent / 100))).toLocaleString("ja-JP")}pt`);
      lines.push("");
      lines.push("  【イベントポイント計算式】");
      lines.push(`    イベントpt = (使用切符 / 10) × floor(${BASE_EVENT_PT_PER_10_TICKETS} × (1 + 特効% / 100))`);
      lines.push(`    切符は10枚単位で使用、1回10〜${MAX_TICKETS_PER_EVENT_RUN}枚`);
      lines.push(`    1AP消費で切符1枚獲得`);
      lines.push("");
      lines.push("  【自然回復AP計算式】");
      lines.push(`    30分に1AP回復 → 1時間${AP_PER_HOUR}AP → 1日${AP_PER_DAY}AP`);
      lines.push(`    初日: 開始${EVENT_START_HOUR}時からの残り時間 × ${AP_PER_HOUR}AP`);
      lines.push(`    最終日: 終了${EVENT_END_HOUR}時までの残り時間 × ${AP_PER_HOUR}AP`);
      lines.push(`    中間日: (開催日数 - 現在日 - 1) × ${AP_PER_DAY}AP`);
      lines.push("");
      lines.push("  【アイテムAP換算】");
      lines.push(`    シュウマイ弁当 1個 = ${BENTO_AP}AP`);
      lines.push(`    シュウマイ 1個 = ${SHUMAI_AP}AP`);
      lines.push("");
      lines.push("  【ダイヤ→AP換算】");
      lines.push(`    ${DIAMONDS_PER_AP}ダイヤ = 1AP`);
      lines.push(`    使用ダイヤ = ダイヤ回復AP × ${DIAMONDS_PER_AP}`);
      lines.push("");
      lines.push("  【課金額計算式】");
      lines.push(`    課金額 = ceil((不足ダイヤ / ${DIAMONDS_PER_CHARGE}) × ${YEN_PER_CHARGE.toLocaleString("ja-JP")} / 1000) × 1000`);
      lines.push("");
      lines.push("  【ルート探索アルゴリズム】");
      lines.push("    切符優先: 所持切符を全て使用後、不足分をAP消費で補う");
      lines.push(`    切符10枚単位でイベント周回、1回${MIN_TICKETS_PER_EVENT_RUN}〜${MAX_TICKETS_PER_EVENT_RUN}枚`);
      lines.push("    キリ番調整: タイムボーナス300pt単位で目標ptに一致させる全探索");
      lines.push("");
      lines.push("  【初回難易度解放pt】");
      for (const [name, pt] of Object.entries(DIFFICULTY_CLEAR_PT)) {
        lines.push(`    ${name}: ${pt.toLocaleString("ja-JP")}pt (特効0%時) / 各難易度${DIFFICULTY_CLEAR_AP}AP消費`);
      }
      lines.push("");
    }

    lines.push("========================================");
    lines.push("※このファイルは計算根根拠確認用です");
    lines.push("※インポートには対応していません");
    lines.push("========================================");

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calculation_detail_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDetailBackupOpen(false);
    toast.success("詳細バックアップをエクスポートしました");
  };

  const progressPct = targetPt > 0 ? Math.min(100, (currentPt / targetPt) * 100) : 0;

  // 目標ptで獲得予定の最高報酬
  const targetHighlight = useMemo(() => {
    const rewards = activePattern?.rewards ?? [];
    let highest: RewardEntry | null = null;
    for (const r of rewards) {
      if (targetPt >= r.pt) {
        if (!highest || r.pt > highest.pt) highest = r;
      }
    }
    return highest;
  }, [targetPt, activePattern]);

  // カウントダウン表示テキスト
  const countdownText = countdown
    ? countdown.ended
      ? "イベントは終了しました"
      : `あと ${countdown.days}日 ${countdown.hours}時間 ${countdown.minutes}分 ${countdown.seconds}秒`
    : "";

  return (
    <div className="min-h-screen w-full flex justify-center safe-pt safe-pb" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-md px-4 pb-24 pt-4">
        {/* ヘッダー */}
        <header className="relative mb-5">
          <div
            className="relative overflow-hidden rounded-2xl p-4 shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))",
              boxShadow: `0 8px 24px var(--theme-shadow-color)`,
            }}
          >
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full" style={{ backgroundColor: C.bg }} />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full" style={{ backgroundColor: C.bg }} />
            <div className="absolute left-14 right-6 top-1/2 -translate-y-1/2 border-t-2 border-dashed" style={{ borderColor: C.primary }} />
            <div className="relative flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm"
                style={{ border: `2px solid ${C.primary}` }}
              >
                <Plane className="h-5 w-5" style={{ color: C.accent }} />
              </div>
              <div className="text-left">
                <h1 className="text-base font-bold tracking-wider text-white leading-tight">18TRIP</h1>
                <p className="text-xs font-medium text-white/80 leading-tight">イベントpt計算機(非公式)</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl p-1 shadow-sm" style={{ backgroundColor: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
            <TabButton active={activeTab === "calc"} onClick={() => setActiveTab("calc")} label="計算" />
            <TabButton active={activeTab === "apcalc"} onClick={() => setActiveTab("apcalc")} label="AP基準" />
            <TabButton active={activeTab === "rewards"} onClick={() => setActiveTab("rewards")} label="設定" />
          </div>
        </header>

        {activeTab === "calc" && (
          <>
            <ProgressCard currentPt={currentPt} targetPt={targetPt} progressPct={progressPct} nextReward={rewardAgg.nextReward} currentDay={currentDay} eventDays={eventDays} currentHour={currentHour} />

            <Section icon={<Plane className="h-4 w-4" />} title="目標と現在のポイント">
              <div className="space-y-3">
                <div>
                  <Label className="form-label">目標ポイント</Label>
                  <div className="mb-2 flex items-center gap-2">
                    <Select
                      value={targetPointMode}
                      onValueChange={(value) => {
                        setTargetPointMode(value);
                        if (value !== "manual") setTargetPtStr(value);
                      }}
                    >
                      <SelectTrigger className="h-9 w-28 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">手入力</SelectItem>
                        {TARGET_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={String(preset.value)}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1">
                      <CommaInput
                        value={targetPtStr}
                        onChange={(value) => {
                          setTargetPtStr(value);
                          setTargetPointMode("manual");
                        }}
                        className="bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <DigitBadges value={targetPtStr} onChange={(value) => {
                    setTargetPtStr(value);
                    setTargetPointMode("manual");
                  }} />
                </div>
                <div>
                  <Label className="form-label">現在の獲得ポイント</Label>
                  <CommaInput
                    value={currentPtStr}
                    onChange={setCurrentPtStr}
                    className="bg-white"
                    placeholder="0"
                  />
                  <div className="relative mt-1 flex flex-wrap gap-1.5">
                    <DigitBadgesInline value={currentPtStr} onChange={setCurrentPtStr} />
                    {/* 初回クリア計算バッジ — 非表示条件: 全クリア済み or 反映済み */}
                    {!diffBadgeHidden && (
                      <button
                        type="button"
                        onClick={() => setDiffClearPopoverOpen(!diffClearPopoverOpen)}
                        className="rounded-lg px-2 py-0.5 text-[0.6rem] font-bold transition-colors"
                        style={{ border: `1px solid ${C.primaryLight}40`, backgroundColor: "rgba(var(--theme-base-rgb), 0.08)", color: C.accent }}
                      >
                        初回クリア計算
                      </button>
                    )}
                    {diffClearPopoverOpen && !diffBadgeHidden && (
                      <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-xl p-3 shadow-lg" style={{ border: `1px solid ${C.border}`, backgroundColor: "#ffffff" }}>
                        <p className="mb-2 text-[0.7rem] font-bold" style={{ color: C.accent }}>
                          初回クリアpt計算
                        </p>
                        {/* 特効カードスロット */}
                        <div className="mb-2 space-y-1.5">
                          <p className="text-[0.6rem] font-bold" style={{ color: C.muted }}>特効カード編成(％入力時は％のみ反映/選択は枚数変更時のみ使用)</p>
                          {visibleDiffClearBonusSlots.map((slot, idx) => {
                            const rarityLabels: Rarity[] = ["SSR", "SR", "R"];
                            return (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="w-8 shrink-0 text-center text-[0.65rem] font-bold" style={{ color: C.accent }}>{rarityLabels[idx]}</span>
                                <Select
                                  value={String(slot.limitBreak)}
                                  onValueChange={(v) => {
                                    const sourceSlots = isDiffClearBonusCustomized ? diffClearBonusSlots : bonusSlots;
                                    setDiffClearBonusSlots(sourceSlots.map((item, slotIndex) => (
                                      slotIndex === idx ? { ...item, limitBreak: parseInt(v, 10) } : { ...item }
                                    )));
                                    setIsDiffClearBonusCustomized(true);
                                  }}
                                >
                                  <SelectTrigger className="h-7 flex-1 text-[0.65rem]" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LIMIT_BREAK_LABELS_WITH_NONE.map((lbl, i) => (
                                      <SelectItem key={i} value={String(i - 1)}>{lbl}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                          <p className="text-[0.6rem]" style={{ color: C.muted }}>
                            合計特効: <span className="font-bold" style={{ color: C.accent }}>{diffClearBonusPercent}%</span>
                            {!isDiffClearBonusCustomized && <span>（旬ボーナスの入力値）</span>}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {diffClearPts.map((d) => (
                            <label key={d.name} className="flex items-center gap-2 text-[0.7rem]" style={{ color: C.text }}>
                              <input
                                type="checkbox"
                                checked={d.checked}
                                onChange={(e) => setDiffClearChecked({ ...diffClearChecked, [d.name]: e.target.checked })}
                                className="h-3.5 w-3.5"
                              />
                              <span className="flex-1">{d.name} ({formatNumber(d.pt)} pt)</span>
                              <span style={{ color: d.checked ? C.muted : C.accent }}>
                                {d.checked ? "クリア済" : "未クリア"}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-2 rounded-lg p-2 text-center" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.06)" }}>
                          <p className="text-[0.65rem]" style={{ color: C.muted }}>
                            加算pt: <span className="font-bold" style={{ color: C.accent }}>{formatNumber(diffClearTotalPt)} pt</span>
                          </p>
                          <p className="text-[0.6rem]" style={{ color: C.muted }}>
                            初回クリアコスト追加: {initialReleaseApCostValue} AP
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleApplyDiffClear}
                          className="mt-2 w-full rounded-xl text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${C.primaryLight}, ${C.primaryDark})` }}
                        >
                          {allDiffCleared ? "VERY HARD解放済み" : "獲得ポイントに反映する"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {/* 保存・復元ボタン */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveCalcInputs}
                    className="h-7 flex-1 rounded-xl text-[0.65rem] font-bold"
                    style={{ borderColor: C.border, backgroundColor: "rgba(255,255,255,0.9)", color: C.accent }}>
                    <Save className="mr-1 h-3 w-3" />入力を保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRestoreCalcInputs}
                    className="h-7 flex-1 rounded-xl text-[0.65rem] font-bold"
                    style={{ borderColor: C.border, backgroundColor: "rgba(255,255,255,0.9)", color: C.accent }}>
                    <RotateCcw className="mr-1 h-3 w-3" />保存を復元
                  </Button>
                </div>
              </div>
            </Section>

            <Section
              icon={<Star className="h-4 w-4" />}
              title="旬(特効)ボーナス"
              action={
                <Button size="sm" variant="outline" onClick={() => setBonusModalOpen(true)}
                  className="h-8 rounded-full px-3 text-xs font-bold"
                  style={{ borderColor: C.border, backgroundColor: "rgba(255,255,255,0.9)", color: C.accent }}>
                  ＋ 凸数から計算
                </Button>
              }
            >
              <div>
                <div className="flex items-center gap-2">
                  <CommaInput
                    value={bonusPercentStr}
                    onChange={handleBonusPercentChange}
                    className="bg-white"
                    placeholder="0"
                    suffix="%"
                  />
                </div>
                <p className="mt-1 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
                  %を直接入力するか上のボタンから計算
                </p>
              </div>
            </Section>

            <Section icon={<Calendar className="h-4 w-4" />} title="開催期間/所持アイテム設定">
              {/* 開催期間 — カウントダウン + 手動入力 */}
              <div className="mb-3 rounded-xl p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ color: C.accent }}>開催期間</span>
                  {/* カウントダウン */}
                  {sw.showCountdown && countdown && (
                    <span className="mini-badge ml-auto px-2 py-0.5 text-[0.65rem] font-bold" style={{ color: countdown.ended ? C.muted : C.accent }}>
                      <Timer className="mr-0.5 inline h-3 w-3" />{countdownText}
                    </span>
                  )}
                </div>

                {/* イベント開始日 (date picker) + クリアボタン + 進捗更新ボタン */}
                <div className="mb-2">
                  <Label className="form-label text-[0.6rem]">イベント開始日</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                      className="compact-input h-8 flex-1 bg-white text-[0.7rem]"
                      style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
                    />
                    {eventStartDate && (
                      <button
                        type="button"
                        onClick={() => setEventStartDate("")}
                        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.8)", color: C.muted }}
                        aria-label="クリア"
                      >
                        ×
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleProgressUpdate}
                      className="h-8 shrink-0 rounded-lg px-2 text-[0.6rem] whitespace-nowrap"
                      style={{ borderColor: C.primaryLight, backgroundColor: "rgba(var(--theme-base-rgb), 0.08)", color: C.accent }}
                    >
                      進捗更新
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="form-label text-[0.6rem]">開催日数</Label>
                    <CommaInput value={eventDaysStr} onChange={(v) => {
                        setEventDaysStr(v);
                        const n = parseCommaNum(v);
                        if (n < 1) return;
                        const cd = parseCommaNum(currentDayStr);
                        if (cd > n) setCurrentDayStr(String(n));
                      }}
                      className="compact-input h-8 bg-white text-[0.7rem]" placeholder="0" />
                  </div>
                  <div>
                    <Label className="form-label text-[0.6rem]">現在</Label>
                    <div className="flex items-center gap-0.5">
                      <CommaInput value={currentDayStr} onChange={setCurrentDayStr}
                        className="compact-input h-8 bg-white text-[0.7rem]" placeholder="0" />
                      <span className="text-[0.6rem] whitespace-nowrap" style={{ color: C.muted }}>日目</span>
                    </div>
                  </div>
                  <div>
                    <Label className="form-label text-[0.6rem]">現在の時間</Label>
                    <Select value={currentHourStr} onValueChange={setCurrentHourStr}>
                      <SelectTrigger className="compact-input h-8 flex-1 text-[0.7rem]" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>{i}時</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="mt-2 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
                  開催日数と現在日時から自然回復APを計算(1時間未満切り捨て)<br />デフォルトは1日目16時として設定
                </p>
                <p className="mt-1 text-[0.65rem]" style={{ color: C.accent }}>
                  {sw.naturalAPSimplify ? `自然回復(ロス込み試算): ${formatNumber(Math.max(0, naturalAPRaw - calcNaturalAPSubtract(eventDays, currentDay, sw.naturalAPSubtract)))} AP` : `自然回復:${formatNumber(naturalAPRaw)} AP`}
                </p>
              </div>

              {/* 所持アイテム・獲得ポイント調整 (アコーディオン) */}
              <Accordion type="single" collapsible className="mt-1">
                <AccordionItem value="items" className="border-0">
                  <AccordionTrigger className="pl-3 py-2.5 text-xs font-bold hover:no-underline" style={{ color: C.text }}>
                    所持アイテム・獲得ポイント調整
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {/* 所持アイテム — 並び順: 1行目 切符/ダイヤ, 2行目 弁当/シュウマイ */}
                    <div className="grid grid-cols-2 gap-3">
                      <ResourceField label="所持切符" value={currentTicketsStr} onChange={setCurrentTicketsStr} />
                      <ResourceField label="所持ダイヤ" value={ownedDiamondsStr} onChange={setOwnedDiamondsStr} />
                      <ResourceField label="シュウマイ弁当 (1個10AP)" value={bentoCountStr} onChange={setBentoCountStr} />
                      <ResourceField label="シュウマイ (1個1AP)" value={shumaiCountStr} onChange={setShumaiCountStr} />
                    </div>

                    {/* キリ番調整 */}
                    <div className="mt-3 flex items-center justify-between rounded-xl p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: C.accent }} />
                        <div className="text-[0.7rem] leading-relaxed" style={{ color: C.text }}>
                          <p className="font-bold">獲得ポイント調整</p>
                          <p style={{ color: C.muted }}>目標ポイントと一致させる</p>
                        </div>
                      </div>
                      <Switch checked={sw.exactMatch} onCheckedChange={(v) => setSw({ ...sw, exactMatch: v })} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Section>

            {/* 切符リアルタイム見積もり */}
            {ticketEstimate !== null && ticketEstimate > 0 && (
              <div className="mt-3 rounded-xl p-3" style={{ border: `1px solid ${C.primaryLight}40`, backgroundColor: "rgba(var(--theme-base-rgb), 0.06)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5" style={{ color: C.accent }} />
                    <p className="text-[0.7rem] font-bold" style={{ color: C.accent }}>
                      現在の所持切符{formatNumber(currentTickets)}枚→獲得pt
                    </p>
                  </div>
                  <p className="text-base font-bold" style={{ color: C.accent }}>
                    {formatNumber(ticketEstimate)} pt
                  </p>
                </div>
              </div>
            )}

            <div className="sticky bottom-3 z-30 mt-5 flex gap-2">
              <Button onClick={handleCalculate} className="glass-btn h-12 flex-1 rounded-2xl text-base font-bold text-white transition-all">
                <Calculator className="mr-1.5 h-5 w-5" />
                計算する
              </Button>
              <Button onClick={handleReset} variant="outline" className="h-12 w-12 rounded-2xl p-0"
                style={{ borderColor: C.border, backgroundColor: "rgba(255,255,255,0.9)", color: C.text }} aria-label="リセット">
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>

            {result && (
              <ResultSection
                result={result}
                targetPt={targetPt}
                currentPt={currentPt}
                ownedDiamonds={parseCommaNum(ownedDiamondsStr)}
                exactMatch={sw.exactMatch}
                showBilling={sw.showBilling}
                currentTickets={currentTickets}
                initialReleaseApCost={initialReleaseApCost}
              />
            )}
          </>
        )}

        {activeTab === "apcalc" && (
          <APCalcTab
            apCalcStr={apCalcStr}
            setApCalcStr={setApCalcStr}
            apCalcBonusStr={apCalcBonusStr}
            setApCalcBonusStr={setApCalcBonusStr}
            apCalcResult={apCalcResult}
            showBilling={sw.showBilling}
            normalMinStr={normalMinStr}
            eventMinStr={eventMinStr}
          />
        )}

        {activeTab === "rewards" && (
          <RewardsTab
            currentPt={currentPt}
            targetPt={targetPt}
            rewardAgg={rewardAgg}
            targetRewardAgg={targetRewardAgg}
            targetHighlight={targetHighlight}
            patterns={patterns}
            activePatternId={activePatternId}
            onSelectPattern={handleSelectPattern}
            onAddPattern={handleAddPattern}
            onEditPattern={handleEditPattern}
            onDuplicatePattern={handleDuplicatePattern}
            onDeletePattern={handleDeletePattern}
            loginBonusPatterns={loginBonusPatterns}
            loginBonusPatternId={loginBonusPatternId}
            onSelectLoginBonusPattern={setLoginBonusPatternId}
            onEditLoginBonusPattern={handleEditLoginBonusPattern}
            onAddLoginBonusPattern={handleAddLoginBonusPattern}
            onDeleteLoginBonusPattern={handleDeleteLoginBonusPattern}
            loginBonusTotal={loginBonusTotal}
            normalMinStr={normalMinStr}
            setNormalMinStr={setNormalMinStr}
            eventMinStr={eventMinStr}
            setEventMinStr={setEventMinStr}
            sw={sw}
            setSw={setSw}
            onExport={handleExport}
            onImport={handleImport}
            onDetailExport={() => setDetailBackupOpen(true)}
            targetAchieveDayStr={targetAchieveDayStr}
            setTargetAchieveDayStr={setTargetAchieveDayStr}
            targetAchieveDay={targetAchieveDay}
            achieveDayNaturalSubtract={achieveDaySubtract.naturalLoss}
            achieveDayLoginBonusSubtract={achieveDaySubtract.loginBonusLoss}
          />
        )}

        <footer className="mt-8 pb-4 text-center">
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="inline-flex flex-col items-center text-[0.65rem] leading-relaxed"
            style={{ color: C.muted }}
          >
            <span className="inline-flex items-center gap-0.5">
              18TRIPイベントpt計算機(非公式)
              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
            </span>
            <span>個人作成のWebアプリです/最終更新日:2026/07/10</span>
          </button>
        </footer>
      </div>

      {/* 詳細バックアップダイアログ */}
      <Dialog open={detailBackupOpen} onOpenChange={setDetailBackupOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl p-5 sm:max-w-sm" style={{ border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: C.text }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
                <FileText className="h-4 w-4" style={{ color: C.accent }} />
              </span>
              詳細バックアップ
            </DialogTitle>
            <p className="text-xs" style={{ color: C.muted }}>
              エクスポートする項目を選択してください（テキスト形式・エクスポート専用）
            </p>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { key: "rewards", label: "報酬表データ" },
              { key: "basePoints", label: "基本ポイント" },
              { key: "bonusRate", label: "特効の倍率" },
              { key: "calcDetail", label: "計算詳細の項目" },
              { key: "formulas", label: "計算式データ" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 rounded-xl border bg-white p-2.5 text-sm" style={{ borderColor: C.border, color: C.text }}>
                <input
                  type="checkbox"
                  checked={detailBackupSel[item.key] ?? false}
                  onChange={(e) => setDetailBackupSel({ ...detailBackupSel, [item.key]: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="font-bold">{item.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDetailBackupOpen(false)} className="flex-1 rounded-xl font-bold"
              style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
              キャンセル
            </Button>
            <Button onClick={handleDetailExport} className="glass-btn flex-1 rounded-xl font-bold text-white">
              <Download className="mr-1 h-4 w-4" />
              エクスポート
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 特効計算モーダル */}
      <Dialog open={bonusModalOpen} onOpenChange={setBonusModalOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl p-5 sm:max-w-sm" style={{ border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: C.text }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
                <Star className="h-4 w-4" style={{ color: C.accent }} />
              </span>
              特効ボーナス計算
            </DialogTitle>
            <p className="text-xs" style={{ color: C.muted }}>
              編成している特効カード(SSR・SR・R)の凸数を選んでください
            </p>
          </DialogHeader>

          <div className="space-y-2">
            {bonusSlots.map((slot, idx) => {
              const rarityLabels: Rarity[] = ["SSR", "SR", "R"];
              return (
                <div key={idx} className="flex items-center gap-2 rounded-xl border bg-white p-2" style={{ borderColor: C.border }}>
                  <span className="w-10 shrink-0 text-center text-sm font-bold" style={{ color: C.accent }}>{rarityLabels[idx]}</span>
                  <Select value={String(slot.limitBreak)} onValueChange={(v) => updateSlot(idx, { limitBreak: parseInt(v, 10) })}>
                    <SelectTrigger className="h-9 flex-1 text-sm" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIMIT_BREAK_LABELS_WITH_NONE.map((lbl, i) => (
                        <SelectItem key={i} value={String(i - 1)}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <Accordion type="single" collapsible className="rounded-xl px-3" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)" }}>
            <AccordionItem value="table" className="border-0">
              <AccordionTrigger className="py-2.5 text-xs font-bold hover:no-underline" style={{ color: C.text }}>
                ボーナス表を見る
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <BonusTable />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="rounded-xl p-3 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)" }}>
            <span className="text-sm font-bold" style={{ color: C.muted }}>合計ボーナス: </span>
            <span className="text-xl font-bold" style={{ color: C.accent }}>{modalTotal}</span>
            <span className="font-bold" style={{ color: C.accent }}>%</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setBonusModalOpen(false)} className="flex-1 rounded-xl font-bold"
              style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
              キャンセル
            </Button>
            <Button onClick={applyBonus} className="glass-btn flex-1 rounded-xl font-bold text-white">
              適用する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 報酬表編集モーダル */}
      <Dialog open={rewardEditOpen} onOpenChange={setRewardEditOpen}>
        <DialogContent className="max-w-[92vw] rounded-3xl p-5 sm:max-w-md" style={{ border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: C.text }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
                <Pencil className="h-4 w-4" style={{ color: C.accent }} />
              </span>
              報酬表の編集
            </DialogTitle>
            <p className="text-xs" style={{ color: C.muted }}>
              報酬名・到達pt・ダイヤ・弁当・シュウマイを編集できます。
            </p>
          </DialogHeader>

          {editingPattern && (
            <div className="space-y-3">
              <div>
                <Label className="form-label">報酬表名</Label>
                <Input value={editingPattern.name}
                  onChange={(e) => setEditingPattern({ ...editingPattern, name: e.target.value })}
                  className="bg-white" />
              </div>

              <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {editingPattern.rewards.length === 0 && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs"
                    style={{ borderColor: C.border, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.muted }}>
                    報酬がありません。「＋ 報酬を追加」から追加してください。
                  </p>
                )}
                {editingPattern.rewards.map((r, idx) => (
                  <div key={idx} className="rounded-xl border bg-white p-2" style={{ borderColor: C.border }}>
                    <div className="flex items-center gap-1.5">
                      <Input type="number" inputMode="numeric" value={String(r.pt)}
                        onChange={(e) => updateEditingReward(idx, { pt: parseCommaNum(e.target.value) })}
                        className="h-8 w-24 text-xs" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }} />
                      <Input value={r.name}
                        onChange={(e) => updateEditingReward(idx, { name: e.target.value })}
                        className="h-8 flex-1 text-xs" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }} />
                      <button onClick={() => removeEditingReward(idx)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: C.accent }} aria-label="削除">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      <RewardMiniInput label="ダイヤ" value={r.diamonds} onChange={(v) => updateEditingReward(idx, { diamonds: v })} />
                      <RewardMiniInput label="弁当" value={r.bento} onChange={(v) => updateEditingReward(idx, { bento: v })} />
                      <RewardMiniInput label="シュウマイ" value={r.shumai} onChange={(v) => updateEditingReward(idx, { shumai: v })} />
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addEditingReward}
                className="w-full rounded-xl border-dashed text-xs font-bold"
                style={{ borderColor: C.border, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.accent }}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                報酬を追加
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setRewardEditOpen(false); setEditingPattern(null); }}
              className="flex-1 rounded-xl font-bold"
              style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
              キャンセル
            </Button>
            <Button onClick={handleSavePattern} className="glass-btn flex-1 rounded-xl font-bold text-white">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ログインボーナス編集モーダル */}
      <Dialog open={loginBonusEditOpen} onOpenChange={setLoginBonusEditOpen}>
        <DialogContent className="max-w-[92vw] rounded-3xl p-5 sm:max-w-md" style={{ border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: C.text }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
                <Gift className="h-4 w-4" style={{ color: C.accent }} />
              </span>
              ログインボーナス編集
            </DialogTitle>
          </DialogHeader>

          {editingLoginBonusPattern && (
            <div className="space-y-3">
              <div>
                <Label className="form-label">名前</Label>
                <Input value={editingLoginBonusPattern.name}
                  onChange={(e) => setEditingLoginBonusPattern({ ...editingLoginBonusPattern, name: e.target.value })}
                  className="bg-white" />
              </div>

              <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {editingLoginBonusPattern.schedule.length === 0 && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs"
                    style={{ borderColor: C.border, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.muted }}>
                    スケジュールがありません「＋ 追加」から追加してください
                  </p>
                )}
                {editingLoginBonusPattern.schedule.map((e, idx) => {
                  const itemType = e.bento !== undefined ? "bento" : e.shumai !== undefined ? "shumai" : "none";
                  return (
                  <div key={idx} className="rounded-xl border bg-white p-2" style={{ borderColor: C.border }}>
                    <div className="flex items-center gap-1.5">
                      <Input type="number" inputMode="numeric" value={String(e.day)}
                        onChange={(ev) => updateEditingLogBonusEntry(idx, { day: parseCommaNum(ev.target.value) || 1 })}
                        className="h-8 w-16 text-xs" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }} />
                      <span className="text-[0.65rem] font-bold whitespace-nowrap" style={{ color: C.accent }}>日目</span>
                      <Select value={itemType} onValueChange={(v) => {
                        if (v === "none") {
                          updateEditingLogBonusEntry(idx, { bento: undefined, shumai: undefined });
                        } else if (v === "bento") {
                          updateEditingLogBonusEntry(idx, { bento: e.bento ?? 1, shumai: undefined });
                        } else {
                          updateEditingLogBonusEntry(idx, { shumai: e.shumai ?? 1, bento: undefined });
                        }
                      }}>
                        <SelectTrigger className="h-8 w-28 text-[0.7rem]" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">なし</SelectItem>
                          <SelectItem value="bento">シュウマイ弁当</SelectItem>
                          <SelectItem value="shumai">シュウマイ</SelectItem>
                        </SelectContent>
                      </Select>
                      {itemType !== "none" && (
                        <Input type="number" inputMode="numeric"
                          value={String(itemType === "bento" ? (e.bento ?? 0) : (e.shumai ?? 0))}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            const n = v === "" ? 0 : parseCommaNum(v);
                            if (itemType === "bento") updateEditingLogBonusEntry(idx, { bento: n });
                            else updateEditingLogBonusEntry(idx, { shumai: n });
                          }}
                          className="h-8 w-16 text-xs" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }} placeholder="個数" />
                      )}
                      <button onClick={() => removeEditingLogBonusEntry(idx)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: C.accent }} aria-label="削除">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              <Button variant="outline" onClick={addEditingLogBonusEntry}
                className="w-full rounded-xl border-dashed text-xs font-bold"
                style={{ borderColor: C.border, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.accent }}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                追加
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setLoginBonusEditOpen(false); setEditingLoginBonusPattern(null); }}
              className="flex-1 rounded-xl font-bold"
              style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
              キャンセル
            </Button>
            <Button onClick={handleSaveLoginBonusPattern} className="glass-btn flex-1 rounded-xl font-bold text-white">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 利用規約モーダル */}
      {termsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setTermsOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: C.accent }}>利用規約</h2>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* 本文 */}
            <div className="max-h-[70vh] overflow-y-auto pr-1 text-[0.7rem] leading-relaxed" style={{ color: C.text }}>
              <p>本ページは『18TRIP』イベントpt計算のため個人で作成した</p>
              <p>非公式・非営利目的のファンサイトです</p>
              <p className="mt-2 font-bold">■データの取り扱い</p>
              <p>サイト内のデータや名称等の知的財産権は</p>
              <p>すべて権利者(©18TRIP PROJECT)に帰属します</p>
              <p className="mt-2 font-bold">■免責事項</p>
              <p>仕様変更等による計算結果の誤差</p>
              <p>それにより生じた損害等について</p>
              <p>製作者は一切の責任を負いません</p>
              <p className="mt-2 font-bold">■連絡先(不具合・削除要請等)</p>
              <p>お手数ですが下記までご連絡ください</p>
              <p>
                X(旧Twitter):
                <a
                  href="https://x.com/z7g47"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold"
                  style={{ color: C.accent }}
                >@z7g47</a>
              </p>
            </div>
            {/* フッター */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95"
                style={{ background: "linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end))" }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

interface TabButtonProps { active: boolean; onClick: () => void; label: string; }
const TabButton = ({ active, onClick, label }: TabButtonProps) => (
  <button onClick={onClick}
    className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition-all"
    style={{
      backgroundColor: active ? C.primary : "transparent",
      color: active ? "#ffffff" : C.muted,
      boxShadow: active ? "0 2px 8px var(--theme-shadow-color)" : "none",
    }}>
    {label}
  </button>
);

interface SectionProps { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode; }
const Section = ({ icon, title, action, children }: SectionProps) => (
  <section className="mt-4 frost-card p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.text }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
          <span style={{ color: C.accent }}>{icon}</span>
        </span>
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

interface ResourceFieldProps {
  label: string; value: string; onChange: (v: string) => void; icon?: ReactNode;
}
const ResourceField = ({ label, value, onChange, icon }: ResourceFieldProps) => (
  <div>
    <Label className="form-label flex items-center gap-1">{icon}{label}</Label>
    <CommaInput value={value} onChange={onChange} className="bg-white" placeholder="0" />
  </div>
);

interface RewardMiniInputProps { label: string; value?: number; onChange: (v: number | undefined) => void; }
const RewardMiniInput = ({ label, value, onChange }: RewardMiniInputProps) => (
  <div>
    <Label className="form-label text-[0.6rem]">{label}</Label>
    <Input type="number" inputMode="numeric" value={value === undefined ? "" : String(value)}
      onChange={(e) => { const v = e.target.value; onChange(v === "" ? undefined : parseCommaNum(v)); }}
      className="h-7 text-[0.7rem]" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }} />
  </div>
);

interface ProgressCardProps {
  currentPt: number; targetPt: number; progressPct: number;
  nextReward: { pt: number; name: string } | null;
  currentDay: number; eventDays: number; currentHour: number;
}
const ProgressCard = ({ currentPt, targetPt, progressPct, nextReward, currentDay, eventDays, currentHour }: ProgressCardProps) => {
  const isDefault = currentDay === 1 && currentHour === 16;
  const isLastDay = eventDays > 0 && currentDay > 0 && currentDay >= eventDays;
  const showDayInfo = !isDefault && currentDay > 0;
  return (
  <div className="frost-card p-4">
    <div className="mb-3 flex items-end justify-between">
      <div>
        <p className="flex items-center gap-2 text-[0.6rem] font-semibold tracking-[0.15em] uppercase" style={{ color: C.accent }}>
          INFORMATION
          {showDayInfo && (
            <span className="font-bold" style={{ color: C.base }}>
              {isLastDay ? "本日最終日" : `本日${currentDay}日目`}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[0.75rem] font-bold" style={{ color: C.text }}>
          {formatCompact(currentPt)} / {formatCompact(targetPt)} pt
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-bold leading-none" style={{ color: C.accent }}>
          {progressPct.toFixed(1)}<span className="text-xs">%</span>
        </p>
      </div>
    </div>
    <div className="mb-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.15)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})` }} />
    </div>
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[0.65rem] font-bold" style={{ color: C.muted }}>現在のポイント</p>
        <p className="text-base font-bold" style={{ color: C.text }}>{formatCompact(currentPt)}<span className="text-[0.65rem] font-normal">pt</span></p>
      </div>
      {nextReward && (
        <p className="text-[0.6rem] font-bold" style={{ color: C.accent }}>
          次のピックアップ報酬まで {formatCompact(nextReward.pt - currentPt)} pt
        </p>
      )}
    </div>
  </div>
  );
};

interface APCalcTabProps {
  apCalcStr: string; setApCalcStr: (v: string) => void;
  apCalcBonusStr: string; setApCalcBonusStr: (v: string) => void;
  apCalcResult: ReturnType<typeof calcAPToPoints> | null;
  showBilling: boolean;
  normalMinStr: string; eventMinStr: string;
}
const APCalcTab = ({ apCalcStr, setApCalcStr, apCalcBonusStr, setApCalcBonusStr, apCalcResult, showBilling, normalMinStr, eventMinStr }: APCalcTabProps) => {
  const normalMin = parseCommaNum(normalMinStr) || DEFAULT_NORMAL_MIN_PER_RUN;
  const eventMin = parseCommaNum(eventMinStr) || DEFAULT_EVENT_MIN_PER_RUN;
  return (
    <div className="space-y-4">
      <Section icon={<Zap className="h-4 w-4" />} title="AP → 獲得ポイント計算">
        <div className="space-y-3">
          <div>
            <Label className="form-label">消費AP</Label>
            <CommaInput value={apCalcStr} onChange={setApCalcStr} className="bg-white text-lg" placeholder="0" />
            <p className="mt-1 text-[0.7rem]" style={{ color: C.muted }}>
              1AP = 1切符 切符は10枚単位でイベントに使用 (1回: 10〜200枚)<br />イベント難易度はVERY HARD
            </p>
          </div>
          <div>
            <Label className="form-label">旬(特効)ボーナス (%)</Label>
            <CommaInput value={apCalcBonusStr} onChange={setApCalcBonusStr} className="bg-white" placeholder="0" suffix="%" />
          </div>
        </div>
      </Section>

      {apCalcResult && (
        <div className="frost-card p-5" style={{ border: `2px solid ${C.primaryLight}` }}>
          <h3 className="mb-4 text-center text-sm font-bold" style={{ color: C.accent }}>獲得ポイント</h3>
          <div className="space-y-3">
            <div className="rounded-xl p-3 text-center" style={{ background: `linear-gradient(135deg, ${C.primaryLight}, ${C.primaryDark})` }}>
              <p className="text-xs font-medium text-white/80">合計獲得pt</p>
              <p className="text-3xl font-bold text-white">
                {formatNumber(apCalcResult.totalPoints)}<span className="ml-1 text-base font-normal">pt</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-2.5 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                <p className="text-[0.65rem]" style={{ color: C.muted }}>
                  通常分
                </p>
                <p className="text-base font-bold" style={{ color: C.text }}>{formatNumber(apCalcResult.normalPoints)}<span className="ml-0.5 text-[0.65rem] font-normal">pt</span></p>
              </div>
              <div className="rounded-xl p-2.5 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                <p className="text-[0.65rem]" style={{ color: C.muted }}>
                  イベント分
                </p>
                <p className="text-base font-bold" style={{ color: C.text }}>{formatNumber(apCalcResult.eventPoints)}<span className="ml-0.5 text-[0.65rem] font-normal">pt</span></p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(var(--theme-base-rgb), 0.06)" }}>
              <div className="flex items-center gap-1.5">
                <Gem className="h-4 w-4" style={{ color: C.accent }} />
                <p className="text-sm font-bold" style={{ color: C.accent }}>AP回復に必要なダイヤ</p>
              </div>
              <p className="text-xl font-bold" style={{ color: C.accent }}>
                {formatNumber(apCalcResult.diamondsNeeded)}<span className="ml-1 text-xs font-normal">個</span>
              </p>
            </div>
            {showBilling && apCalcResult.billingYen > 0 && (
              <div className="flex items-center justify-between rounded-xl p-3" style={{ border: `1px solid ${C.accent}`, backgroundColor: "rgba(var(--theme-base-rgb), 0.1)" }}>
                <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.accent }}><CreditCard className="h-4 w-4" />課金額目安</p>
                <p className="text-xl font-bold" style={{ color: C.accent }}>
                  {formatNumber(apCalcResult.billingYen)}<span className="ml-1 text-xs font-normal">円</span>
                </p>
              </div>
            )}
            {/* 所要時間 */}
            {(() => {
              const ap = parseCommaNum(apCalcStr);
              const usableTickets = Math.floor(ap / 10) * 10;
              return (
            <div className="rounded-xl p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold" style={{ color: C.accent }}>
                <Clock className="h-3.5 w-3.5" />
                所要時間の目安
              </div>
              <ul className="space-y-1 text-[0.7rem]" style={{ color: C.text }}>
                <li className="flex justify-between">
                  <span>通常 {formatNumber(ap)}AP ({normalMin}分×{apCalcResult.normalRuns}回)</span>
                  <span>{Math.floor(apCalcResult.normalRuns * normalMin)}分</span>
                </li>
                <li className="flex justify-between">
                  <span>イベント 切符{formatNumber(usableTickets)}枚 ({eventMin}分×{apCalcResult.eventRunCount}回)</span>
                  <span>{Math.floor(apCalcResult.eventRunCount * eventMin)}分</span>
                </li>
                <li className="flex justify-between font-bold border-t pt-1" style={{ borderColor: C.border }}>
                  <span>合計</span>
                  <span>{(() => {
                    const total = Math.floor(apCalcResult.normalRuns * normalMin) + Math.floor(apCalcResult.eventRunCount * eventMin);
                    const h = Math.floor(total / 60);
                    const m = total % 60;
                    return h > 0 ? `${h}時間${m}分` : `${m}分`;
                  })()}</span>
                </li>
              </ul>
            </div>
              );
            })()}
            <p className="text-center text-[0.7rem]" style={{ color: C.muted }}>
              ※2ダイヤ = 1APで計算
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface ResultSectionProps {
  result: ReturnType<typeof calculateResources>;
  targetPt: number; currentPt: number; ownedDiamonds: number;
  exactMatch: boolean; showBilling: boolean;
  currentTickets: number;
  initialReleaseApCost: number;
}
const ResultSection = ({ result, targetPt, currentPt, ownedDiamonds, exactMatch, showBilling, currentTickets, initialReleaseApCost }: ResultSectionProps) => {
  if (result.alreadyReached) {
    return (
      <section id="result-section" className="mt-6 frost-card p-5 text-center"
        style={{ border: `2px solid ${C.accent}`, backgroundColor: "rgba(var(--theme-base-rgb), 0.06)" }}>
        <Check className="mx-auto mb-2 h-10 w-10" style={{ color: C.accent }} />
        <h3 className="text-lg font-bold" style={{ color: C.accent }}>目標ポイントに到達しています！</h3>
        <p className="mt-1 text-sm" style={{ color: C.text }}>
          現在 {formatNumber(currentPt)} pt / 目標 {formatNumber(targetPt)} pt
        </p>
      </section>
    );
  }

  return (
    <section id="result-section" className="mt-6 space-y-4 pt-5" style={{ borderTop: `2px dashed ${C.border}` }}>
      {/* サマリー */}
      <div className="frost-card p-5">
        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.text }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Calculator className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          計算結果
        </h3>
        <div className="space-y-3">
          <ResultRow icon={<ChevronRight className="h-3.5 w-3.5" />} label="不足ポイント" value={formatNumber(result.remainingPt)} unit="pt" color={C.text} />
          <div className="h-px" style={{ backgroundColor: C.border }} />
          <div>
            <ResultRow icon={<Zap className="h-3.5 w-3.5" />} label="必要AP" value={formatNumber(result.requiredTotalAP)} unit="AP" color={C.accent} />
            {initialReleaseApCost > 0 && (
              <p className="mt-0.5 text-right text-[0.6rem]" style={{ color: C.muted }}>初回クリア分{initialReleaseApCost}APを含む</p>
            )}
          </div>
          <div className="h-px" style={{ backgroundColor: C.border }} />
          {/* 使用ダイヤ目安 — 不足ダイヤと同値の場合は非表示 */}
          {result.usedDiamonds !== result.shortfallDiamonds && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)", border: `1px solid ${C.border}` }}>
              <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.accent }}>
                <Gem className="h-3.5 w-3.5" />使用ダイヤ目安
              </p>
              <p className="text-2xl font-bold" style={{ color: C.accent }}>
                {formatNumber(result.usedDiamonds)}<span className="ml-1 text-sm font-normal">個</span>
              </p>
            </div>
          )}
          {/* 不足ダイヤ目安 (0の時は非表示) — タップで展開 */}
          {result.shortfallDiamonds > 0 && (
            <Accordion type="single" collapsible className="rounded-xl" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)", border: `1px solid ${C.border}` }}>
              <AccordionItem value="shortfall" className="border-0">
                <AccordionTrigger className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold hover:no-underline" style={{ color: C.accent }}>
                  <span className="mr-auto flex items-center gap-1.5">
                    <Gem className="h-3.5 w-3.5" />不足ダイヤ目安
                  </span>
                  <span className="text-2xl font-bold" style={{ color: C.accent }}>
                    {formatNumber(result.shortfallDiamonds)}<span className="ml-1 text-sm font-normal">個</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2.5 pt-0 px-3 text-[0.7rem]" style={{ color: C.muted }}>
                  <div className="grid justify-end gap-x-1" style={{ gridTemplateColumns: "auto auto auto" }}>
                    <span className="text-left">ダイヤ追加なし:</span>
                    <span className="tabular-nums text-right">{formatNumber(result.nonDiamondPoints)}</span>
                    <span className="text-left">pt獲得可能</span>
                    <span className="text-left">目標まであと:</span>
                    <span className="tabular-nums text-right">{formatNumber(Math.max(0, result.remainingPt - result.nonDiamondPoints))}</span>
                    <span className="text-left">pt必要</span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {showBilling && result.billingYen > 0 && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)", border: `1px solid ${C.border}` }}>
              <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.accent }}><CreditCard className="h-3.5 w-3.5" />課金額目安</p>
              <p className="text-2xl font-bold" style={{ color: C.accent }}>
                {formatNumber(result.billingYen)}<span className="ml-1 text-sm font-normal">円</span>
              </p>
            </div>
          )}
        </div>
        {/* 下部注釈 */}
        <p className="mt-3 text-center text-[0.7rem]" style={{ color: C.muted }}>
          {result.shortfallDiamonds > 0
            ? "ダイヤ換算: 2ダイヤ = 1AP"
            : `ダイヤ換算: 2ダイヤ = 1AP · 所持ダイヤ残り ${formatNumber(result.remainingDiamonds)}個`
          }
        </p>
      </div>

      <RouteCard result={result} currentTickets={currentTickets} />

      {exactMatch && result.exactMatchInfo && <ExactMatchCard info={result.exactMatchInfo} targetRemaining={result.remainingPt} currentPt={currentPt} targetPt={targetPt} />}

      {/* 内訳 */}
      <div className="grid grid-cols-1 gap-3">
        <div className="frost-card p-4">
          <h4 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
              <Briefcase className="h-3.5 w-3.5" style={{ color: C.accent }} />
            </span>
            リソース
          </h4>
          {/* サマリー: 利用AP(左)・必要AP(右) ※同値時は必要AP非表示 */}
          {(() => {
            const totalAvail = result.nonDiamondAP + (result.usedDiamonds > 0 ? result.diamondRecoveryAP : 0);
            const sameAP = totalAvail === result.requiredTotalAP;
            const availLabel = result.usedDiamonds > 0 ? "利用AP合計" : "利用可能AP";
            if (sameAP) {
              return (
                <div className="mb-3 rounded-xl p-3 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                  <p className="text-[0.65rem] font-bold" style={{ color: C.muted }}>{availLabel}</p>
                  <p className="text-xl font-bold" style={{ color: C.accent }}>
                    {formatNumber(totalAvail)}<span className="ml-0.5 text-xs font-normal">AP</span>
                  </p>
                </div>
              );
            }
            return (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                  <p className="text-[0.65rem] font-bold" style={{ color: C.muted }}>{availLabel}</p>
                  <p className="text-xl font-bold" style={{ color: C.accent }}>
                    {formatNumber(totalAvail)}<span className="ml-0.5 text-xs font-normal">AP</span>
                  </p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.6)" }}>
                  <p className="text-[0.65rem] font-bold" style={{ color: C.muted }}>必要AP</p>
                  <p className="text-xl font-bold" style={{ color: C.accent }}>
                    {formatNumber(result.requiredTotalAP)}<span className="ml-0.5 text-xs font-normal">AP</span>
                  </p>
                </div>
              </div>
            );
          })()}
          {/* 内訳: インデント+リスト記号 */}
          <ul className="space-y-1 text-[0.7rem]" style={{ color: C.muted }}>
            <li className="flex justify-between pl-3">
              <span>├ 自然回復使用可能予測分</span>
              <span>{formatNumber(result.naturalAP)} AP</span>
            </li>
            {result.ownedItemAP > 0 && (
              <li className="flex justify-between pl-3">
                <span>├ 所持アイテム:AP換算</span>
                <span>{formatNumber(result.ownedItemAP)} AP</span>
              </li>
            )}
            {result.loginBonusAP > 0 && (
              <li className="flex justify-between pl-3">
                <span>├ ログボ:AP換算</span>
                <span>{formatNumber(result.loginBonusAP)} AP</span>
              </li>
            )}
            {result.rewardItemAP > 0 && (
              <li className="flex justify-between pl-3">
                <span>├ 報酬アイテム:AP換算</span>
                <span>{formatNumber(result.rewardItemAP)} AP</span>
              </li>
            )}
            {result.usedDiamonds > 0 && (
              <li className="flex justify-between pl-3">
                <span>└ ダイヤ回復AP</span>
                <span>{formatNumber(result.diamondRecoveryAP)} AP</span>
              </li>
            )}
          </ul>
          {/* 収支判定 */}
          {(() => {
            const totalAvail = result.nonDiamondAP + (result.usedDiamonds > 0 ? result.diamondRecoveryAP : 0);
            // ダイヤ不要判定: 非ダイヤAPのみで必要APを満たす場合のみ
            if (result.nonDiamondAP >= result.requiredTotalAP) {
              const surplus = result.nonDiamondAP - result.requiredTotalAP;
              return (
                <div className="mt-3 rounded-xl px-3 py-2 text-center" style={{ border: `1px solid ${C.primaryLight}40`, backgroundColor: "rgba(var(--theme-base-rgb), 0.08)" }}>
                  <p className="text-[0.75rem] font-bold" style={{ color: C.accent }}>
                    ダイヤなしで達成可能（{formatNumber(surplus)}AP余裕あり）
                  </p>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* 所要時間 */}
        <div className="frost-card p-4">
          <h4 className="mb-2 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
              <Clock className="h-3.5 w-3.5" style={{ color: C.accent }} />
            </span>
            所要時間目安
          </h4>
          <ul className="space-y-1.5 text-xs" style={{ color: C.text }}>
            <DetailRow label={`通常 (${result.estimatedTime.normalMinPerRun}分×${result.estimatedTime.normalRuns}回)`} value={`${result.estimatedTime.normalMin}分`} />
            <DetailRow label={`イベント (${result.estimatedTime.eventMinPerRun}分×${result.estimatedTime.eventRuns}回)`} value={`${result.estimatedTime.eventMin}分`} />
            <DetailRow label="合計所要時間" value={result.estimatedTime.totalHourStr} bold />
          </ul>
          <p className="mt-2 text-[0.65rem]" style={{ color: C.muted }}>ファストブーストパス使用前提/1回あたりの時間は設定で変更可能</p>
        </div>

        {/* 計算詳細 (一番下) */}
        <div className="frost-card p-4">
          <h4 className="mb-2 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
              <FileChartLine className="h-3.5 w-3.5" style={{ color: C.accent }} />
            </span>
            計算詳細
          </h4>
          <ul className="space-y-1.5 text-xs" style={{ color: C.text }}>
            <DetailRow label="獲得pt倍率" value={`×${result.effMult.toFixed(3)}`} />
            <DetailRow label="通常1APあたり" value={`${formatNumber(result.normalPtPerAP)} pt`} />
            <DetailRow label="イベント切符10枚あたり(VERY HARD)" value={`${formatNumber(result.eventPtPer10Ticket)} pt`} />
          </ul>
          <p className="mt-2 text-[0.6rem] leading-tight" style={{ color: C.muted }}>
            現在日時と獲得ポイントを参照し<br />獲得済みのログボ・報酬はリソース計算に含めない<br />未使用分があれば所持アイテムに記載すること
          </p>
        </div>
      </div>
    </section>
  );
};

interface ResultRowProps { icon?: ReactNode; label: string; value: string; unit: string; color: string; }
const ResultRow = ({ icon, label, value, unit, color }: ResultRowProps) => (
  <div className="flex items-center justify-between">
    <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.muted }}>
      {icon && <span style={{ color: C.accent }}>{icon}</span>}{label}
    </p>
    <p className="text-xl font-bold" style={{ color }}>{value}<span className="ml-1 text-xs font-normal">{unit}</span></p>
  </div>
);

interface DetailRowProps { label: string; value: string; bold?: boolean; muted?: boolean; }
const DetailRow = ({ label, value, bold, muted }: DetailRowProps) => (
  <li className="flex justify-between" style={{
    borderTop: bold ? `1px solid ${C.border}` : "none",
    paddingTop: bold ? "6px" : "0",
    fontWeight: bold ? "bold" : "normal",
    color: muted ? C.muted : C.text,
  }}>
    <span>{label}</span><span>{value}</span>
  </li>
);

// --- 通常pt計算フォーマット生成 ---
function makeNormalFormula(ap: number, npp: number): string {
  if (ap <= 0) return "";
  const full10 = Math.floor(ap / 10);
  const rem = ap % 10;
  const pt10 = 10 * npp;
  const ptRem = rem * npp;
  const parts: string[] = [];
  if (full10 > 0) {
    parts.push(`(${formatNumber(pt10)}×${full10})`);
  }
  if (rem > 0) {
    parts.push(`＋${formatNumber(ptRem)}`);
  }
  return parts.join("");
}

// --- イベントpt計算フォーマット生成 ---
function makeEventFormula(chunks: { tickets: number }[], epp: number): string {
  if (chunks.length === 0) return "";
  const counts: Record<number, number> = {};
  const order: number[] = [];
  for (const c of chunks) {
    if (!counts[c.tickets]) {
      counts[c.tickets] = 0;
      order.push(c.tickets);
    }
    counts[c.tickets] += 1;
  }
  const parts: string[] = [];
  for (const t of order) {
    const mult = t / 10;
    const pt = mult * epp;
    parts.push(`${counts[t] > 1 ? `(${formatNumber(pt)}×${counts[t]})` : formatNumber(pt)}`);
  }
  return parts.join("＋");
}

interface RouteCardProps { result: ReturnType<typeof calculateResources>; currentTickets: number; }
const RouteCard = ({ result, currentTickets }: RouteCardProps) => {
  const r = result.route;
  const ownedTicketsUsed = Math.min(currentTickets, r.usableTickets);
  const normalPt = r.totalAP * result.normalPtPerAP;
  const eventPt = (r.usableTickets / 10) * result.eventPtPer10Ticket;
  const totalPt = normalPt + eventPt;
  const normalFormula = makeNormalFormula(r.totalAP, result.normalPtPerAP);
  const eventFormula = makeEventFormula(r.eventRunChunks, result.eventPtPer10Ticket);
  // 消費AP/切符用シンプルフォーマット: normalPt＋eventPt
  const simpleParts: string[] = [];
  if (normalPt > 0) simpleParts.push(formatNumber(normalPt));
  if (eventPt > 0) simpleParts.push(formatNumber(eventPt));
  const simpleFormula = simpleParts.join("＋");
  return (
    <div className="frost-card p-4">
      <h4 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
          <Compass className="h-3.5 w-3.5" style={{ color: C.accent }} />
        </span>
        最短ルート
      </h4>
      <ul className="space-y-1.5 text-xs" style={{ color: C.text }}>
        <li className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(250,246,235,0.5)" }}>
          <div className="flex items-center">
            <span className="font-bold shrink-0" style={{ color: C.muted }}>消費AP/切符</span>
            <span className="ml-auto font-bold text-right" style={{ color: C.text }}>
              {r.totalAP > 0 ? `${formatNumber(r.totalAP)}AP` : "0AP"}{" / 切符"}{formatNumber(r.usableTickets)}枚{ownedTicketsUsed > 0 && `(内所持切符${formatNumber(ownedTicketsUsed)}枚)`}
            </span>
          </div>
          <CollapsiblePt formula={simpleFormula} total={totalPt} />
        </li>
        <li className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(250,246,235,0.5)" }}>
          <div className="flex items-center">
            <span className="font-bold shrink-0" style={{ color: C.muted }}>通常</span>
            <span className="ml-auto font-bold text-right whitespace-nowrap" style={{ color: C.text }}>
              {r.totalAP > 0 ? r.apBreakdownLabel : "なし"}
            </span>
          </div>
          <CollapsiblePt formula={normalFormula} total={normalPt} />
        </li>
        <li className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(250,246,235,0.5)" }}>
          <div className="flex items-center">
            <span className="font-bold shrink-0" style={{ color: C.muted }}>イベント</span>
            <span className="ml-auto font-bold text-[0.65rem] text-right whitespace-nowrap overflow-hidden" style={{ color: C.text }}>
              {r.eventChunkLabel}
            </span>
          </div>
          <CollapsiblePt formula={eventFormula} total={eventPt} />
        </li>
        <li className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(250,246,235,0.5)" }}>
          <span className="font-bold shrink-0" style={{ color: C.muted }}>獲得pt</span>
          <span className="ml-auto font-bold text-right whitespace-nowrap" style={{ color: C.text }}>
            {formatNumber(totalPt)} pt
            {r.excess > 0 && (
              <span className="ml-1 text-[0.65rem] font-normal" style={{ color: C.muted }}>
                (+{formatNumber(r.excess)} 過剰)
              </span>
            )}
          </span>
        </li>
      </ul>
    </div>
  );
};

// 折り畳み可能な獲得pt表示 (デフォルト折り畳み)
// formula文字列とtotalを受け取り、1行で表示
interface CollapsiblePtProps { formula: string; total: number; }
const CollapsiblePt = ({ formula, total }: CollapsiblePtProps) => {
  const [open, setOpen] = useState<boolean>(false);
  if (total <= 0 || !formula) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[0.6rem] font-normal transition-colors"
        style={{ color: C.muted }}
      >
        {open ? "▾ 隠す" : "▸ 獲得pt"}
      </button>
      {open && (
        <p className="mt-0.5 text-[0.5rem] leading-tight whitespace-nowrap overflow-x-auto" style={{ color: C.muted }}>
          {formula}={formatNumber(total)}pt
        </p>
      )}
    </div>
  );
};

interface ExactMatchCardProps {
  info: NonNullable<ReturnType<typeof calculateResources>["exactMatchInfo"]>;
  targetRemaining: number;
  currentPt: number;
  targetPt: number;
}
const ExactMatchCard = ({ info, targetRemaining, currentPt, targetPt }: ExactMatchCardProps) => {
  if (!info.enabled) return null;
  return (
    <div className="frost-card p-4" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", border: `1px solid var(--theme-base)` }}>
      <h4 className="mb-2 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid rgba(var(--theme-base-rgb), 0.25)` }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
          <Check className="h-3.5 w-3.5" style={{ color: C.base }} />
        </span>
        獲得ポイント調整
      </h4>
      {info.isExact ? (
        <div className="space-y-1 text-[0.65rem]" style={{ color: C.accent }}>
          <p className="text-[0.75rem] leading-relaxed font-bold">
            目標{formatNumber(targetPt)}pt 一致で調整可能
          </p>
          {info.ticketPt > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              所持切符 = {formatNumber(info.ticketPt)}pt
            </p>
          )}
          {info.baseSets > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              ベース(通常200AP+切符200枚)×{info.baseSets}回 = {formatNumber(info.baseSetTotalPt)}pt
            </p>
          )}
          {info.normal10Runs > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              通常10AP×{info.normal10Runs}回 = {formatNumber(info.normal10TotalPt)}pt
            </p>
          )}
          {info.eventFragmentTickets > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              切符端数{info.eventFragmentTickets}枚 = {formatNumber(info.eventFragPt)}pt
            </p>
          )}
          {info.normalFragmentAP > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              通常端数 AP{info.normalFragmentAP} = {formatNumber(info.normalFragPt)}pt
            </p>
          )}
          {info.timeBonusRunsNeeded > 0 && (
            <p className="leading-relaxed" style={{ color: C.text }}>
              タイムボーナス{info.timeBonusRunsNeeded}回 ({formatNumber(info.timeBonusPoints)}pt)
            </p>
          )}
          <p className="leading-relaxed font-bold" style={{ color: C.text }}>
            合計: {currentPt > 0 ? `${formatNumber(currentPt)}pt+` : ""}{formatNumber(info.finalPoints)}pt = 目標と一致
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 text-xs" style={{ color: C.text }}>
          <p className="leading-relaxed font-bold" style={{ color: C.base }}>
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            ポイント調整不可
          </p>
          <p className="leading-relaxed" style={{ color: C.muted }}>
            目標pt一致で調整不可
          </p>
        </div>
      )}
    </div>
  );
};

interface LoginBonusScheduleListProps {
  patterns: LoginBonusPattern[];
  activeId: string;
}
const LoginBonusScheduleList = ({ patterns, activeId }: LoginBonusScheduleListProps) => {
  const active = patterns.find((p) => p.id === activeId) ?? patterns[0];
  if (!active || active.schedule.length === 0) {
    return (
      <p className="text-[0.7rem]" style={{ color: C.muted }}>スケジュールがありません</p>
    );
  }
  const sorted = [...active.schedule].sort((a, b) => a.day - b.day);
  return (
    <div className="space-y-1">
      {sorted.map((e) => {
        const items: string[] = [];
        if (e.bento) items.push(`弁当${e.bento}個`);
        if (e.shumai) items.push(`シュウマイ${e.shumai}個`);
        return (
          <div key={e.day} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.6)" }}>
            <span className="text-[0.7rem] font-bold" style={{ color: C.accent }}>{e.day}日目</span>
            <span className="text-[0.7rem]" style={{ color: C.text }}>{items.join(" / ")}</span>
          </div>
        );
      })}
    </div>
  );
};

const BonusTable = () => {
  const rows: { rarity: Rarity; values: number[] }[] = [
    { rarity: "SSR", values: BONUS_TABLE.SSR },
    { rarity: "SR", values: BONUS_TABLE.SR },
    { rarity: "R", values: BONUS_TABLE.R },
  ];
  return (
    <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${C.border}` }}>
      <table className="w-full text-[0.7rem]">
        <thead style={{ backgroundColor: `${C.border}60`, color: C.text }}>
          <tr>
            <th className="px-2 py-1.5 text-left font-bold">レア</th>
            {LIMIT_BREAK_LABELS_WITH_NONE.slice(1).map((_, i) => (
              <th key={i} className="px-1 py-1.5 text-center font-bold">{i}凸</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rarity} style={{ borderTop: `1px solid ${C.border}` }}>
              <td className="px-2 py-1.5 font-bold" style={{ color: C.accent }}>{r.rarity}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-1 py-1.5 text-center" style={{ color: C.text }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2 py-1.5 text-[0.65rem]" style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.muted }}>
        単位: % · 5凸=完凸 (6枚)
      </p>
    </div>
  );
};

interface RewardsTabProps {
  currentPt: number; targetPt: number;
  rewardAgg: ReturnType<typeof aggregateRewards>;
  targetRewardAgg: ReturnType<typeof aggregateRewards>;
  targetHighlight: RewardEntry | null;
  patterns: RewardPattern[]; activePatternId: string;
  onSelectPattern: (id: string) => void;
  onAddPattern: () => void;
  onEditPattern: (p: RewardPattern) => void;
  onDuplicatePattern: (p: RewardPattern) => void;
  onDeletePattern: (p: RewardPattern) => void;
  loginBonusPatterns: LoginBonusPattern[];
  loginBonusPatternId: string;
  onSelectLoginBonusPattern: (id: string) => void;
  onEditLoginBonusPattern: (p: LoginBonusPattern) => void;
  onAddLoginBonusPattern: () => void;
  onDeleteLoginBonusPattern: (p: LoginBonusPattern) => void;
  loginBonusTotal: { bento: number; shumai: number };
  normalMinStr: string; setNormalMinStr: (v: string) => void;
  eventMinStr: string; setEventMinStr: (v: string) => void;
  sw: SwitchState; setSw: (s: SwitchState) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDetailExport: () => void;
  targetAchieveDayStr: string; setTargetAchieveDayStr: (v: string) => void;
  targetAchieveDay: number;
  achieveDayNaturalSubtract: number;
  achieveDayLoginBonusSubtract: number;
}

const RewardsTab = ({
  currentPt, targetPt, rewardAgg, targetRewardAgg, targetHighlight,
  patterns, activePatternId, onSelectPattern, onAddPattern, onEditPattern,
  onDuplicatePattern, onDeletePattern,
  loginBonusPatterns, loginBonusPatternId, onSelectLoginBonusPattern,
  onEditLoginBonusPattern, onAddLoginBonusPattern, onDeleteLoginBonusPattern,
  loginBonusTotal,
  normalMinStr, setNormalMinStr, eventMinStr, setEventMinStr,
  sw, setSw, onExport, onImport, onDetailExport,
  targetAchieveDayStr, setTargetAchieveDayStr, targetAchieveDay,
  achieveDayNaturalSubtract, achieveDayLoginBonusSubtract,
}: RewardsTabProps) => {
  const activePattern = patterns.find((p) => p.id === activePatternId) ?? patterns[0];
  const visibleRewards = useMemo(() => {
    const lower = Math.min(currentPt, targetPt) - 100000;
    const upper = Math.max(currentPt, targetPt) + 2000000;
    return (activePattern?.rewards ?? []).filter((r) => r.pt >= lower && r.pt <= upper);
  }, [currentPt, targetPt, activePattern]);

  return (
    <div className="space-y-4">
      {/* 報酬パターン切替 */}
      <div className="frost-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.text }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
              <Award className="h-3.5 w-3.5" style={{ color: C.accent }} />
            </span>
            報酬表パターン
          </h3>
          <Button size="sm" variant="outline" onClick={onAddPattern}
            className="h-7 rounded-full px-2.5 text-[0.65rem] font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }}>
            <Plus className="mr-0.5 h-3 w-3" />新規
          </Button>
        </div>
        <Select value={activePatternId} onValueChange={onSelectPattern}>
          <SelectTrigger style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}><SelectValue /></SelectTrigger>
          <SelectContent>
            {patterns.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} ({p.rewards.length}件)</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEditPattern(activePattern)}
            className="h-8 flex-1 rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
            <Pencil className="mr-1 h-3 w-3" />編集
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDuplicatePattern(activePattern)}
            className="h-8 flex-1 rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
            <Copy className="mr-1 h-3 w-3" />複製
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDeletePattern(activePattern)}
            className="h-8 w-9 rounded-xl p-0"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }} aria-label="削除">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 現在ptで獲得済み */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.text }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Award className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          現在ptで獲得済みの報酬
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile icon={<Gem className="h-4 w-4" />} value={formatNumber(rewardAgg.diamonds)} unit="個" label="ダイヤ" tint={C.accent} />
          <SummaryTile icon={<Briefcase className="h-4 w-4" />} value={formatNumber(rewardAgg.bentoCount + rewardAgg.shumaiCount)} unit="個" label="AP回復" tint={C.accent} />
          <SummaryTile icon={<Check className="h-4 w-4" />} value={formatNumber(rewardAgg.reachedCount)} unit="件" label="到達報酬" tint={C.text} />
        </div>
        <p className="mt-2 text-[0.65rem]" style={{ color: C.muted }}>
          AP回復内訳: 弁当 {rewardAgg.bentoCount}個 ({rewardAgg.bentoAP}AP) ・ シュウマイ {rewardAgg.shumaiCount}個 ({rewardAgg.shumaiAP}AP)
        </p>
      </div>

      {/* 目標ptで獲得予定 */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.text }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Award className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          目標ptで獲得予定の報酬
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile icon={<Gem className="h-4 w-4" />} value={formatNumber(targetRewardAgg.diamonds)} unit="個" label="ダイヤ" tint={C.accent} />
          <SummaryTile icon={<Briefcase className="h-4 w-4" />} value={formatNumber(targetRewardAgg.bentoCount + targetRewardAgg.shumaiCount)} unit="個" label="AP回復" tint={C.accent} />
          <SummaryTile icon={<Check className="h-4 w-4" />} value={formatNumber(targetRewardAgg.reachedCount)} unit="件" label="到達報酬" tint={C.text} />
        </div>
        <p className="mt-2 text-[0.65rem]" style={{ color: C.muted }}>
          AP回復内訳: 弁当 {targetRewardAgg.bentoCount}個 ({targetRewardAgg.bentoAP}AP) ・ シュウマイ {targetRewardAgg.shumaiCount}個 ({targetRewardAgg.shumaiAP}AP)
        </p>
      </div>

      {/* 報酬リスト (アコーディオン) */}
      <div className="frost-card p-3">
        <Accordion type="single" collapsible>
          <AccordionItem value="reward-list" className="border-0">
            <AccordionTrigger className="py-1 text-sm font-bold hover:no-underline" style={{ color: C.text }}>
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
                  <Award className="h-3.5 w-3.5" style={{ color: C.accent }} />
                </span>
                報酬一覧 (現在pt周辺)
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
                {visibleRewards.length === 0 && (
                  <p className="rounded-xl border border-dashed p-4 text-center text-xs"
                    style={{ borderColor: C.border, backgroundColor: "rgba(var(--theme-light-rgb), 0.6)", color: C.muted }}>
                    この範囲に報酬がありません。目標・現在ポイントを調整するか、報酬表を編集してください。
                  </p>
                )}
                {visibleRewards.map((r) => {
                  const reached = currentPt >= r.pt;
                  const isTargetHighlight = targetHighlight !== null && r.pt === targetHighlight.pt;
                  return (
                    <div key={r.pt} className="flex items-center justify-between rounded-xl border p-2.5 transition-colors"
                      style={{
                        borderColor: reached ? `${C.accent}40` : isTargetHighlight ? C.primaryLight : C.border,
                        backgroundColor: reached ? "rgba(var(--theme-base-rgb), 0.06)" : isTargetHighlight ? "rgba(var(--theme-base-rgb), 0.12)" : "rgba(255,255,255,0.6)",
                      }}>
                      <div className="flex items-center gap-2">
                        {reached ? (
                          <Check className="h-4 w-4 shrink-0" style={{ color: C.accent }} />
                        ) : isTargetHighlight ? (
                          <Award className="h-4 w-4 shrink-0" style={{ color: C.accent }} />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: C.muted }} />
                        )}
                        <div>
                          <p className="text-xs font-bold" style={{ color: reached ? C.accent : isTargetHighlight ? C.accent : C.text }}>
                            {formatCompact(r.pt)} pt
                          </p>
                          <p className="text-[0.7rem]" style={{ color: C.text }}>{r.name}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {r.diamonds && (
                          <RewardBadge tint="diamond"><Gem className="h-2.5 w-2.5" />{r.diamonds}</RewardBadge>
                        )}
                        {r.bento && <RewardBadge tint="bento">弁{r.bento}</RewardBadge>}
                        {r.shumai && <RewardBadge tint="shumai">焼{r.shumai}</RewardBadge>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 px-1 text-[0.65rem]" style={{ color: C.muted }}>
                全 {activePattern?.rewards.length ?? 0} 件中 {visibleRewards.length} 件を表示
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* ログインボーナス (リスト選択式 + 編集 + 折りたたみ可能な一覧) */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Gift className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          ログインボーナス
        </h3>
        <div className="mb-3 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
          全期間合計: 弁当{loginBonusTotal.bento}個 ・ シュウマイ{loginBonusTotal.shumai}個 (AP換算: {loginBonusTotal.bento * 10 + loginBonusTotal.shumai}AP)<br />
          未獲得分を(ログボ:AP換算)として反映
        </div>
        <div className="mb-2">
          <Select value={loginBonusPatternId} onValueChange={onSelectLoginBonusPattern}>
            <SelectTrigger style={{ backgroundColor: "rgba(var(--theme-light-rgb), 0.8)" }}><SelectValue /></SelectTrigger>
            <SelectContent>
              {loginBonusPatterns.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const p = loginBonusPatterns.find((x) => x.id === loginBonusPatternId) ?? loginBonusPatterns[0];
            onEditLoginBonusPattern(p);
          }}
            className="h-8 flex-1 rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.text }}>
            <Pencil className="mr-1 h-3 w-3" />編集
          </Button>
          <Button size="sm" variant="outline" onClick={onAddLoginBonusPattern}
            className="h-8 flex-1 rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }}>
            <Plus className="mr-1 h-3 w-3" />新規
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const p = loginBonusPatterns.find((x) => x.id === loginBonusPatternId) ?? loginBonusPatterns[0];
            onDeleteLoginBonusPattern(p);
          }}
            className="h-8 w-9 rounded-xl p-0"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }} aria-label="削除">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* ログインボーナス一覧 (折りたたみ可能) */}
        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="logbo-list" className="border-0">
            <AccordionTrigger className="py-2 text-[0.7rem] font-bold hover:no-underline" style={{ color: C.muted }}>
              配布スケジュール
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <LoginBonusScheduleList patterns={loginBonusPatterns} activeId={loginBonusPatternId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* 所要時間設定 */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Clock className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          所要時間設定
        </h3>
        <p className="mb-3 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
          1回あたりの所要時間(分) 所要時間目安に反映
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="form-label">通常1回 (分)</Label>
            <Input type="number" inputMode="numeric" value={normalMinStr}
              onChange={(e) => setNormalMinStr(e.target.value)} className="bg-white" />
          </div>
          <div>
            <Label className="form-label">イベント1回 (分)</Label>
            <Input type="number" inputMode="numeric" value={eventMinStr}
              onChange={(e) => setEventMinStr(e.target.value)} className="bg-white" />
          </div>
        </div>
      </div>

      {/* 設定スイッチ */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Settings className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          設定
        </h3>
        <div className="space-y-2.5">
          <SwitchRow
            label="実際に使用可能なAPを試算"
            desc="ロスを考慮しリソースから指定分マイナス"
            checked={sw.naturalAPSimplify}
            onChange={(v) => setSw({ ...sw, naturalAPSimplify: v })}
          />
          {sw.naturalAPSimplify && (
            <div className="grid grid-cols-4 gap-1.5 pl-3">
              <div>
                <Label className="form-label whitespace-nowrap text-[0.58rem]">達成日目標</Label>
                <Input type="number" inputMode="numeric" value={targetAchieveDayStr}
                  onChange={(e) => setTargetAchieveDayStr(e.target.value)}
                  className="h-8 bg-white px-2 text-xs" placeholder="0" />
              </div>
              <div>
                <Label className="form-label whitespace-nowrap text-[0.58rem]">マイナス値</Label>
                <Input type="number" inputMode="numeric" value={String(sw.naturalAPSubtract)}
                  onChange={(e) => setSw({ ...sw, naturalAPSubtract: parseCommaNum(e.target.value) || 0 })}
                  className="h-8 bg-white px-2 text-xs" />
              </div>
              <div>
                <Label className="form-label whitespace-nowrap text-[0.58rem]">自然回復</Label>
                <Input type="number" value={targetAchieveDay > 0 ? achieveDayNaturalSubtract : 0}
                  readOnly aria-readonly="true" tabIndex={-1}
                  className="h-8 cursor-default bg-gray-50 px-2 text-xs text-gray-500" />
              </div>
              <div>
                <Label className="form-label whitespace-nowrap text-[0.58rem]">ログボ</Label>
                <Input type="number" value={targetAchieveDay > 0 ? achieveDayLoginBonusSubtract : 0}
                  readOnly aria-readonly="true" tabIndex={-1}
                  className="h-8 cursor-default bg-gray-50 px-2 text-xs text-gray-500" />
              </div>
            </div>
          )}
          <SwitchRow
            label="課金額目安表示"
            desc="不足ダイヤから課金額を計算表示"
            checked={sw.showBilling}
            onChange={(v) => setSw({ ...sw, showBilling: v })}
          />
          <SwitchRow
            label="1日10APまで必要ダイヤ数を割引"
            desc="1日ごと10APまで必要ダイヤ数を割引"
            checked={sw.discountDiamonds}
            onChange={(v) => setSw({ ...sw, discountDiamonds: v })}
          />
          <SwitchRow
            label="イベント残り時間のカウントダウンを表示"
            desc="開催期間にカウントダウンを表示"
            checked={sw.showCountdown}
            onChange={(v) => setSw({ ...sw, showCountdown: v })}
          />
        </div>
      </div>

      {/* データバックアップ */}
      <div className="frost-card p-4">
        <h3 className="mb-3 flex items-center gap-1.5 pb-2 text-sm font-bold" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(var(--theme-base-rgb), 0.12)" }}>
            <Download className="h-3.5 w-3.5" style={{ color: C.accent }} />
          </span>
          データバックアップ
        </h3>
        <p className="mb-3 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
          使用データ出力・読み込み
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onExport}
            className="h-9 flex-1 rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }}>
            <Download className="mr-1 h-3.5 w-3.5" />
            エクスポート
          </Button>
          <label className="flex-1 cursor-pointer">
            <div
              className="flex h-9 w-full items-center justify-center rounded-xl border text-xs font-bold"
              style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              インポート
            </div>
            <input type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
          </label>
        </div>
        <div className="mt-3 border-t pt-3" style={{ borderColor: C.border }}>
          <p className="mb-2 text-[0.7rem] leading-relaxed" style={{ color: C.muted }}>
            詳細バックアップ(エクスポート専用)<br />報酬表・計算式データから項目を選択してテキスト形式で出力
          </p>
          <Button size="sm" variant="outline" onClick={onDetailExport}
            className="h-9 w-full rounded-xl text-xs font-bold"
            style={{ borderColor: C.border, backgroundColor: "white", color: C.accent }}>
            <FileText className="mr-1 h-3.5 w-3.5" />
            詳細バックアップ
          </Button>
        </div>
      </div>
    </div>
  );
};

interface SwitchRowProps {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}
const SwitchRow = ({ label, desc, checked, onChange }: SwitchRowProps) => (
  <div className="flex items-center justify-between rounded-xl p-2.5" style={{ border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.5)" }}>
    <div className="flex-1 pr-2">
      <p className="text-xs font-bold" style={{ color: C.text }}>{label}</p>
      <p className="text-[0.65rem] leading-tight" style={{ color: C.muted }}>{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

interface SummaryTileProps {
  icon: ReactNode; value: string; unit: string; label: string; tint: string;
}
const SummaryTile = ({ icon, value, unit, label, tint }: SummaryTileProps) => (
  <div className="rounded-xl border bg-white p-2.5 text-center" style={{ borderColor: C.border }}>
    <div className="mx-auto mb-1 flex justify-center" style={{ color: tint }}>{icon}</div>
    <p className="text-base font-bold" style={{ color: tint }}>
      {value}<span className="text-[0.65rem] font-normal">{unit}</span>
    </p>
    <p className="text-[0.65rem]" style={{ color: C.muted }}>{label}</p>
  </div>
);

interface RewardBadgeProps { tint: "diamond" | "bento" | "shumai"; children: ReactNode; }
const RewardBadge = ({ tint, children }: RewardBadgeProps) => {
  const styles: Record<RewardBadgeProps["tint"], string> = {
    diamond: "bg-[rgba(var(--theme-base-rgb), 0.15)] text-[var(--theme-base)]",
    bento: "bg-[rgba(var(--theme-base-rgb), 0.12)] text-[var(--theme-base)]",
    shumai: "bg-[rgba(var(--theme-base-rgb), 0.15)] text-[var(--theme-base)]",
  };
  return (
    <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${styles[tint]}`}>
      {children}
    </span>
  );
};

export default Index;
