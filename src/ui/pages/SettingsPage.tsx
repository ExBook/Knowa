import { Badge, Box, Button, Group, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { IconFolder, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { getAppSettings, saveAppSettings, type AppSettings } from '../../services/appSettings';
import {
  clearPreferredLocalDataDirectory,
  getLocalDataDirectory,
  setPreferredLocalDataDirectory,
  type LocalDataDirectoryState,
} from '../../services/localDataDirectory';

export function SettingsPage() {
  const [directoryState, setDirectoryState] = useState<LocalDataDirectoryState>(() => getLocalDataDirectory());
  const [draftDirectory, setDraftDirectory] = useState(directoryState.directory);
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());

  const saveDirectory = () => {
    setDirectoryState(setPreferredLocalDataDirectory(draftDirectory.trim()));
  };

  const resetDirectory = () => {
    const next = clearPreferredLocalDataDirectory();
    setDirectoryState(next);
    setDraftDirectory(next.directory);
  };

  const updateSettings = (next: AppSettings) => {
    setSettings(saveAppSettings(next));
  };

  return (
    <Box>
      <Box className="page-header-sticky">
        <Title order={2}>设置</Title>
        <Text size="sm" c="dimmed" mt={4}>
          管理本地数据保存策略和桌面端预留能力。
        </Text>
      </Box>

      <Box className="page-body" style={{ maxWidth: 760 }}>
        <Stack gap="md">
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
