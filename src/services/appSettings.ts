const appSettingsKey = 'exlocal.appSettings';

export interface AppSettings {
  autoFavoriteWrong: boolean;
  removeWrongWhenCorrect: boolean;
}

export const defaultAppSettings: AppSettings = {
  autoFavoriteWrong: false,
  removeWrongWhenCorrect: true,
};

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
  return settings;
}
