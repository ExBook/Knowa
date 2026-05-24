import { Box, Button, Group, LoadingOverlay, Text, Title } from '@mantine/core';
import { IconFileImport, IconPlus } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';

export function BankListPage() {
  const { banks, loading, loadBanks } = useBankStore();

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2} style={{ margin: 0 }}>
              题库
            </Title>
            <Text size="xs" c="dimmed">
              {banks.length} 个题库
            </Text>
          </Box>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />}>
              导入题库
            </Button>
            <Button leftSection={<IconPlus size={16} />}>新建题库</Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" pos="relative">
        <LoadingOverlay visible={loading} />
        {banks.length === 0 ? (
          <EmptyState title="还没有题库" description="创建你的第一个题库，或导入别人的题库文件">
            <Group justify="center">
              <Button leftSection={<IconPlus size={16} />}>新建题库</Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />}>
                导入题库
              </Button>
            </Group>
          </EmptyState>
        ) : (
          <Box>
            {banks.map((bank) => (
              <Box key={bank.id} style={{ padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                <Text fw={500}>{bank.name}</Text>
                <Text size="sm" c="dimmed">
                  {bank.description}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
