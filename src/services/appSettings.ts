const appSettingsKey = 'exlocal.appSettings';
const appSettingsChangedEvent = 'exlocal.appSettingsChanged';

export type ThemePreset = 'warm' | 'sage' | 'porcelain' | 'midnight' | 'graphite' | 'plum';
export type QuizChineseFont = 'song' | 'hei' | 'kai' | 'serif';
export type QuizEnglishFont = 'geist' | 'lora' | 'system' | 'serif';
export type QuizFontStyle = 'academic' | 'system';

export interface AppSettings {
  autoFavoriteWrong: boolean;
  removeWrongWhenCorrect: boolean;
  themePreset: ThemePreset;
  quizChineseFont: QuizChineseFont;
  quizEnglishFont: QuizEnglishFont;
  quizFontSize: number;
}

export const defaultAppSettings: AppSettings = {
  autoFavoriteWrong: false,
  removeWrongWhenCorrect: true,
  themePreset: 'warm',
  quizChineseFont: 'hei',
  quizEnglishFont: 'geist',
  quizFontSize: 16,
};

export const themePresetOptions: Array<{
  value: ThemePreset;
  label: string;
  description: string;
  swatches: string[];
}> = [
  { value: 'warm', label: '温润学术', description: '奶油纸面、靛蓝强调', swatches: ['#faf7f2', '#ffffff', '#3b4b6b', '#c4823d'] },
  { value: 'sage', label: '青榆书桌', description: '浅青底色、墨绿强调', swatches: ['#f5f7f0', '#ffffff', '#466655', '#b88a55'] },
  { value: 'porcelain', label: '瓷白清晨', description: '冷白留白、海蓝强调', swatches: ['#f7fafb', '#ffffff', '#2f5d7c', '#c58b5a'] },
  { value: 'midnight', label: '夜读蓝调', description: '深墨蓝、柔和高亮', swatches: ['#121821', '#1b2430', '#8fb6df', '#d7a85f'] },
  { value: 'graphite', label: '石墨专注', description: '中性深灰、青绿点缀', swatches: ['#171817', '#222422', '#9ab9ac', '#d0a96a'] },
  { value: 'plum', label: '梅影夜色', description: '深紫灰、玫瑰金点缀', swatches: ['#1d1720', '#29212d', '#c5a6d8', '#d49b86'] },
];

export const quizChineseFontOptions: Array<{ value: QuizChineseFont; label: string; fontFamily: string }> = [
  { value: 'hei', label: '黑体 / 清晰阅读', fontFamily: "'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { value: 'song', label: '宋体 / 试卷感', fontFamily: "'Noto Serif SC', 'Songti SC', SimSun, serif" },
  { value: 'kai', label: '楷体 / 笔记感', fontFamily: "'Kaiti SC', KaiTi, 'Noto Serif SC', serif" },
  { value: 'serif', label: '衬线 / 学术', fontFamily: "'Noto Serif SC', serif" },
];

export const quizEnglishFontOptions: Array<{ value: QuizEnglishFont; label: string; fontFamily: string }> = [
  { value: 'geist', label: 'Geist / 现代', fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif' },
  { value: 'lora', label: 'Lora / 学术', fontFamily: 'Lora, Georgia, serif' },
  { value: 'system', label: 'System / 系统', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { value: 'serif', label: 'Serif / 传统', fontFamily: 'Georgia, Times, serif' },
];

export const quizFontStyleOptions: Array<{
  value: QuizFontStyle;
  label: string;
  description: string;
  fontFamily: string;
  chineseFont: QuizChineseFont;
  englishFont: QuizEnglishFont;
}> = [
  {
    value: 'academic',
    label: '学术',
    description: 'Lora + 宋体/衬线，适合试卷、笔记和长文本阅读。',
    fontFamily: "'Lora', 'Noto Serif SC', 'Songti SC', SimSun, Georgia, serif",
    chineseFont: 'song',
    englishFont: 'lora',
  },
  {
    value: 'system',
    label: '系统',
    description: '系统无衬线字体，适合高密度刷题和屏幕阅读。',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    chineseFont: 'hei',
    englishFont: 'system',
  },
];

export function themePresetColorScheme(preset: ThemePreset): 'light' | 'dark' {
  return preset === 'midnight' || preset === 'graphite' || preset === 'plum' ? 'dark' : 'light';
}

export function getAppSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(appSettingsKey);
    if (!raw) {
      return defaultAppSettings;
    }

    return { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return defaultAppSettings;
  }
}

export function getQuizFontStyle(settings: Pick<AppSettings, 'quizChineseFont' | 'quizEnglishFont'>): QuizFontStyle {
  return settings.quizEnglishFont === 'lora' || settings.quizChineseFont === 'song' || settings.quizChineseFont === 'serif' ? 'academic' : 'system';
}

export function applyQuizFontStyle(settings: AppSettings, style: QuizFontStyle): AppSettings {
  const option = quizFontStyleOptions.find((item) => item.value === style) ?? quizFontStyleOptions[0];
  return { ...settings, quizChineseFont: option.chineseFont, quizEnglishFont: option.englishFont };
}

export function getQuizFontFamily(settings: Pick<AppSettings, 'quizChineseFont' | 'quizEnglishFont'>): string {
  const style = getQuizFontStyle(settings);
  return quizFontStyleOptions.find((item) => item.value === style)?.fontFamily ?? quizFontStyleOptions[0].fontFamily;
}

export function saveAppSettings(settings: AppSettings): AppSettings {
  const next = { ...defaultAppSettings, ...settings };
  window.localStorage.setItem(appSettingsKey, JSON.stringify(next));
  applyThemePreset(next.themePreset);
  window.dispatchEvent(new CustomEvent<AppSettings>(appSettingsChangedEvent, { detail: next }));
  return next;
}

export function applyThemePreset(preset: ThemePreset): void {
  document.documentElement.dataset.themePreset = preset;
  document.documentElement.setAttribute('data-mantine-color-scheme', themePresetColorScheme(preset));
}

export function subscribeAppSettings(listener: (settings: AppSettings) => void): () => void {
  const handleSettingsChanged = (event: Event) => {
    listener((event as CustomEvent<AppSettings>).detail ?? getAppSettings());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === appSettingsKey) {
      listener(getAppSettings());
    }
  };

  window.addEventListener(appSettingsChangedEvent, handleSettingsChanged);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(appSettingsChangedEvent, handleSettingsChanged);
    window.removeEventListener('storage', handleStorage);
  };
}
