const appSettingsKey = 'exlocal.appSettings';

export type ThemePreset = 'warm' | 'sage' | 'porcelain' | 'midnight' | 'graphite' | 'plum';

export interface AppSettings {
  autoFavoriteWrong: boolean;
  removeWrongWhenCorrect: boolean;
  themePreset: ThemePreset;
}

export const defaultAppSettings: AppSettings = {
  autoFavoriteWrong: false,
  removeWrongWhenCorrect: true,
  themePreset: 'warm',
};

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

export function saveAppSettings(settings: AppSettings): AppSettings {
  window.localStorage.setItem(appSettingsKey, JSON.stringify(settings));
  applyThemePreset(settings.themePreset);
  return settings;
}

export function applyThemePreset(preset: ThemePreset): void {
  document.documentElement.dataset.themePreset = preset;
  document.documentElement.setAttribute('data-mantine-color-scheme', themePresetColorScheme(preset));
}
