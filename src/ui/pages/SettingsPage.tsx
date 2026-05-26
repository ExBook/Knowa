import { Badge, Box, Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconFolder, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import {
  clearPreferredLocalDataDirectory,
  getLocalDataDirectory,
  setPreferredLocalDataDirectory,
  type LocalDataDirectoryState,
} from '../../services/localDataDirectory';

export function SettingsPage() {
  const [directoryState, setDirectoryState] = useState<LocalDataDirectoryState>(() => getLocalDataDirectory());
  const [draftDirectory, setDraftDirectory] = useState(directoryState.directory);

  const saveDirectory = () => {
    setDirectoryState(setPreferredLocalDataDirectory(draftDirectory.trim()));
  };

  const resetDirectory = () => {
    const next = clearPreferredLocalDataDirectory();
    setDirectoryState(next);
    setDraftDirectory(next.directory);
  };

  return (
    <Box p="xl">
      <Title order={2}>设置</Title>
      <Text size="sm" c="dimmed" mt={4} mb="xl">
        管理本地数据保存策略和桌面端预留能力。
      </Text>

      <Box style={{ maxWidth: 720 }}>
        <Stack gap="md">
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
