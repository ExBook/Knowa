import { Badge, Box, Button, Group, SimpleGrid, Stack, Switch, Text, TextInput, Title, UnstyledButton, useMantineColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconFolder, IconRefresh, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import { getAppSettings, saveAppSettings, themePresetColorScheme, type AppSettings, type ThemePreset } from '../../services/appSettings';
import { exportFullDataToFile, importFullDataFromFile } from '../../services/fullDataBackupService';
import {
  clearPreferredLocalDataDirectory,
  getLocalDataDirectory,
  setPreferredLocalDataDirectory,
  type LocalDataDirectoryState,
} from '../../services/localDataDirectory';

const themePresets: Array<{
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

export function SettingsPage() {
  const [directoryState, setDirectoryState] = useState<LocalDataDirectoryState>(() => getLocalDataDirectory());
  const [draftDirectory, setDraftDirectory] = useState(directoryState.directory);
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const { setColorScheme } = useMantineColorScheme();

  const saveDirectory = () => {
    setDirectoryState(setPreferredLocalDataDirectory(draftDirectory.trim()));
  };

  const resetDirectory = () => {
    const next = clearPreferredLocalDataDirectory();
    setDirectoryState(next);
    setDraftDirectory(next.directory);
  };

  const updateSettings = (next: AppSettings) => {
    setColorScheme(themePresetColorScheme(next.themePreset));
    setSettings(saveAppSettings(next));
  };

  const handleExportAllData = async () => {
    setExportingData(true);
    try {
      await exportFullDataToFile();
      notifications.show({ color: 'green', title: '已导出', message: '完整数据备份已生成。' });
    } catch (error) {
      notifications.show({ color: 'red', title: '导出失败', message: (error as Error).message });
    } finally {
      setExportingData(false);
    }
  };

  const handleImportAllData = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setImportingData(true);
    try {
      const result = await importFullDataFromFile(file);
      setSettings(getAppSettings());
      notifications.show({
        color: 'green',
        title: '导入成功',
        message: `已导入 ${result.bankCount} 个题库、${result.questionCount} 道题、${result.recordCount} 条记录。`,
      });
    } catch (error) {
      notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
    } finally {
      setImportingData(false);
    }
  };

  return (
    <Box>
      <Box className="page-header-sticky">
        <Title order={2}>设置</Title>
        <Text size="sm" c="dimmed" mt={4}>
          管理本地数据保存策略和桌面端预留能力。
        </Text>
      </Box>

      <Box className="page-body" style={{ maxWidth: 880 }}>
        <Stack gap="md">
          <Box className="settings-section">
            <Text fw={600} mb="sm">
              主题风格
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {themePresets.map((preset) => (
                <UnstyledButton
                  key={preset.value}
                  className={`theme-preset-card ${settings.themePreset === preset.value ? 'is-active' : ''}`}
                  onClick={() => updateSettings({ ...settings, themePreset: preset.value })}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box>
                      <Text fw={600} size="sm">
                        {preset.label}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {preset.description}
                      </Text>
                    </Box>
                    {settings.themePreset === preset.value && (
                      <Badge size="xs" variant="light">
                        当前
                      </Badge>
                    )}
                  </Group>
                  <Group gap={5} mt="md">
                    {preset.swatches.map((color) => (
                      <Box key={color} className="theme-swatch" style={{ background: color }} />
                    ))}
                  </Group>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Box>

          <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 18 }}>
            <Text fw={600} mb="sm">
              做题记录
            </Text>
            <Stack gap="sm">
              <Switch
                label="做错题后自动收藏"
                description="默认关闭；打开后，提交错误答案会自动把题目加入收藏。"
                checked={settings.autoFavoriteWrong}
                onChange={(event) => updateSettings({ ...settings, autoFavoriteWrong: event.currentTarget.checked })}
              />
              <Switch
                label="错题重做正确后移出错题记录"
                description="默认开启；关闭后，只要曾经做错过，就会保留在错题记录中。"
                checked={settings.removeWrongWhenCorrect}
                onChange={(event) => updateSettings({ ...settings, removeWrongWhenCorrect: event.currentTarget.checked })}
              />
            </Stack>
          </Box>

          <Box className="settings-section">
            <Text fw={600} mb="sm">
              数据迁移
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              导出会包含题库、题目、图片、收藏状态、笔记、做题记录和当前设置；导入会合并到当前设备，相同 ID 的数据会被备份覆盖。
            </Text>
            <Group>
              <Button leftSection={<IconDownload size={16} />} loading={exportingData} onClick={() => void handleExportAllData()}>
                导出全部数据
              </Button>
              <Button variant="default" component="label" leftSection={<IconUpload size={16} />} loading={importingData}>
                导入全部数据
                <input
                  type="file"
                  hidden
                  accept=".json,.exlocal.json,application/json"
                  onChange={(event) => {
                    void handleImportAllData(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </Button>
            </Group>
          </Box>

          <Group gap="sm">
            <Text fw={600}>本地题库目录</Text>
            <Badge variant="light">{directoryState.mode === 'desktop' ? '桌面端' : 'Web 预览'}</Badge>
          </Group>

          <Text size="sm" c="dimmed">
            当前 Web 版本使用 IndexedDB 保存题库。后续打包为桌面应用时，这里会接入系统目录选择，并固定到用户指定的本地题库目录。
          </Text>

          <TextInput
            label="目录标识"
            value={draftDirectory}
            onChange={(event) => setDraftDirectory(event.currentTarget.value)}
            leftSection={<IconFolder size={16} />}
            disabled={!directoryState.canChooseDirectory}
          />

          <Group>
            <Button onClick={saveDirectory} disabled={!directoryState.canChooseDirectory || !draftDirectory.trim()}>
              保存目录
            </Button>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={resetDirectory}>
              恢复默认
            </Button>
          </Group>
        </Stack>
      </Box>
    </Box>
  );
}
