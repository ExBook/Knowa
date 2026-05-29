import { Badge, Box, Button, Group, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput, Title, UnstyledButton, useMantineColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconDownload, IconFolder, IconFolderOpen, IconRefresh, IconUpload } from '@tabler/icons-react';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  applyQuizFontStyle,
  getAppSettings,
  getQuizFontFamily,
  getQuizFontStyle,
  quizFontStyleOptions,
  saveAppSettings,
  subscribeAppSettings,
  themePresetColorScheme,
  themePresetOptions,
  type AppSettings,
  type QuizFontStyle,
} from '../../services/appSettings';
import { backupFullDataToLocalDirectory, exportFullDataToFile, importFullDataFromFile } from '../../services/fullDataBackupService';
import {
  clearPreferredLocalDataDirectory,
  chooseLocalDataDirectory,
  getInitialLocalDataDirectory,
  getLocalDataDirectory,
  type LocalDataDirectoryState,
} from '../../services/localDataDirectory';

export function SettingsPage() {
  const [directoryState, setDirectoryState] = useState<LocalDataDirectoryState>(() => getInitialLocalDataDirectory());
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [exportingData, setExportingData] = useState(false);
  const [backingUpData, setBackingUpData] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    void getLocalDataDirectory().then(setDirectoryState);
  }, []);

  useEffect(() => {
    return subscribeAppSettings((next) => {
      setColorScheme(themePresetColorScheme(next.themePreset));
      setSettings(next);
    });
  }, [setColorScheme]);

  const updateSettings = (updater: (current: AppSettings) => AppSettings) => {
    const next = updater(getAppSettings());
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

  const handleBackupToDirectory = async () => {
    setBackingUpData(true);
    try {
      const targetFile = await backupFullDataToLocalDirectory(directoryState.directory);
      notifications.show({ color: 'green', title: '已备份', message: `完整数据已写入 ${targetFile}` });
    } catch (error) {
      notifications.show({ color: 'red', title: '备份失败', message: (error as Error).message });
    } finally {
      setBackingUpData(false);
    }
  };

  const chooseDirectory = async () => {
    try {
      const next = await chooseLocalDataDirectory();
      if (next) {
        setDirectoryState(next);
      }
    } catch (error) {
      notifications.show({ color: 'red', title: '目录选择失败', message: (error as Error).message });
    }
  };

  const resetDirectory = async () => {
    try {
      setDirectoryState(await clearPreferredLocalDataDirectory());
    } catch (error) {
      notifications.show({ color: 'red', title: '恢复失败', message: (error as Error).message });
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
          管理主题、刷题阅读偏好、本地备份目录和跨设备数据迁移。
        </Text>
      </Box>

      <Box className="page-body" style={{ maxWidth: 880 }}>
        <Stack gap="md">
          <Box className="settings-section">
            <Text fw={600} mb="sm">
              主题风格
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {themePresetOptions.map((preset) => (
                <UnstyledButton
                  key={preset.value}
                  className={`theme-preset-card ${settings.themePreset === preset.value ? 'is-active' : ''}`}
                  onClick={() => updateSettings((current) => ({ ...current, themePreset: preset.value }))}
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

          <Box className="settings-section">
            <Text fw={600} mb="sm">
              刷题阅读字体
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              会应用到刷题页题干、选项、解析和回顾内容；刷题页右上角也可以临时调整并保存。
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="字体风格"
                data={quizFontStyleOptions.map((item) => ({ value: item.value, label: item.label }))}
                value={getQuizFontStyle(settings)}
                onChange={(value) => updateSettings((current) => applyQuizFontStyle(current, (value ?? 'academic') as QuizFontStyle))}
              />
              <NumberInput
                label="字号"
                min={14}
                max={22}
                step={1}
                suffix=" px"
                value={settings.quizFontSize}
                onChange={(value) => updateSettings((current) => ({ ...current, quizFontSize: Number(value) || 16 }))}
              />
            </SimpleGrid>
            <Box
              className="quiz-font-preview"
              mt="md"
              style={{
                '--quiz-font-family': getQuizFontFamily(settings),
                '--quiz-font-size': `${settings.quizFontSize}px`,
              } as CSSProperties}
            >
              <Text size="xs" c="dimmed" mb={6}>
                预览
              </Text>
              <Text className="quiz-font-preview-title">ExLocal Academic Preview</Text>
              <Text className="quiz-font-preview-body">搭建你的个人题库：函数、导数与概率统计 A/B/C/D。</Text>
            </Box>
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
                onChange={(event) => updateSettings((current) => ({ ...current, autoFavoriteWrong: event.currentTarget.checked }))}
              />
              <Switch
                label="错题重做正确后移出错题记录"
                description="默认开启；关闭后，只要曾经做错过，就会保留在错题记录中。"
                checked={settings.removeWrongWhenCorrect}
                onChange={(event) => updateSettings((current) => ({ ...current, removeWrongWhenCorrect: event.currentTarget.checked }))}
              />
            </Stack>
          </Box>

          <Box className="settings-section">
            <Text fw={600} mb="sm">
              数据迁移
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              导出会包含题库、题目、图片、收藏状态、笔记、做题记录和当前设置；桌面端也可以直接写入固定备份目录。
            </Text>
            <Group>
              {directoryState.canWriteBackup && (
                <Button leftSection={<IconDeviceFloppy size={16} />} loading={backingUpData} onClick={() => void handleBackupToDirectory()}>
                  备份到本地目录
                </Button>
              )}
              <Button leftSection={<IconDownload size={16} />} loading={exportingData} onClick={() => void handleExportAllData()}>
                导出为文件
              </Button>
              <Button variant="default" component="label" leftSection={<IconUpload size={16} />} loading={importingData}>
                导入全部数据
                <input
                  type="file"
                  hidden
                  accept=".exlocal,.json,.exlocal.json,application/json,application/zip"
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
            {directoryState.mode === 'desktop'
              ? '桌面端默认使用系统应用数据目录保存备份，也支持选择你自己的同步盘或资料目录。题库运行数据仍保存在应用本地数据库中，备份文件用于迁移和恢复。'
              : 'Web 预览版使用浏览器 IndexedDB 保存题库；导出文件可用于迁移到桌面端。'}
          </Text>

          <TextInput
            label="当前备份目录"
            value={directoryState.directory}
            leftSection={<IconFolder size={16} />}
            readOnly
          />

          {directoryState.mode === 'desktop' && (
            <Text size="xs" c="dimmed">
              系统默认目录：{directoryState.defaultDirectory}
            </Text>
          )}

          <Group>
            <Button leftSection={<IconFolderOpen size={16} />} onClick={() => void chooseDirectory()} disabled={!directoryState.canChooseDirectory}>
              选择目录
            </Button>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => void resetDirectory()} disabled={!directoryState.canChooseDirectory}>
              恢复默认
            </Button>
          </Group>
        </Stack>
      </Box>
    </Box>
  );
}
