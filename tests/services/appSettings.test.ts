import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAppSettings, saveAppSettings, subscribeAppSettings } from '../../src/services/appSettings';

describe('appSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme-preset');
    document.documentElement.removeAttribute('data-mantine-color-scheme');
  });

  it('notifies same-tab subscribers when app settings change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppSettings(listener);

    saveAppSettings({ ...defaultAppSettings, themePreset: 'plum' });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ themePreset: 'plum' }));
    expect(document.documentElement.dataset.themePreset).toBe('plum');
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');

    unsubscribe();
  });
});
