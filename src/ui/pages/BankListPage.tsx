import { Box, Button, Group, LoadingOverlay, Text, Title, Modal, TextInput, Textarea, Card, Badge, TagsInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFileImport, IconPlus, IconEdit, IconTrash, IconFolder } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';
import type { Bank } from '../../shared/types';

export function BankListPage() {
  const navigate = useNavigate();
  const { banks, loading, loadBanks, createBank, updateBank, deleteBank } = useBankStore();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [storagePath, setStoragePath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  const handleOpenCreate = () => {
    setEditingBank(null);
    setName('');
    setDescription('');
    setTags([]);
    setStoragePath('');
    open();
  };

  const handleOpenEdit = (bank: Bank) => {
    setEditingBank(bank);
    setName(bank.name);
    setDescription(bank.description);
    setTags(bank.tags);
    setStoragePath(bank.storagePath || '');
    open();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingBank) {
        await updateBank(editingBank.id, { name, description, tags, storagePath });
      } else {
        await createBank({ name, description, tags, storagePath });
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bank: Bank) => {
    if (confirm(`确定删除题库「${bank.name}」吗？此操作不可撤销。`)) {
      await deleteBank(bank.id);
    }
  };

  const getStatusBadge = (bank: Bank) => {
    if (bank.questionCount === 0) return <Badge color="gray" variant="light">空题库</Badge>;
    return <Badge color="slate" variant="light">{bank.questionCount} 题</Badge>;
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between">
          <Box>
            <Title order={2}>题库</Title>
            <Text size="xs" c="dimmed">{banks.length} 个题库</Text>
          </Box>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileImport size={16} />}>导入题库</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>新建题库</Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" pos="relative">
        <LoadingOverlay visible={loading} />
        {banks.length === 0 ? (
          <EmptyState title="还没有题库" description="创建你的第一个题库，或导入别人的题库文件">
            <Group justify="center">
              <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>新建题库</Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />}>导入题库</Button>
            </Group>
          </EmptyState>
        ) : (
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {banks.map((bank) => (
              <Card key={bank.id} shadow="sm" padding="lg" radius="md" withBorder
                style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                onClick={() => navigate(`/bank/${bank.id}`)}
              >
                <Group justify="space-between" mb="xs">
                  <Text fw={600} style={{ fontFamily: 'var(--font-display)' }}>{bank.name}</Text>
                  <Group gap={4}>
                    <Button variant="subtle" size="xs" p={4} onClick={(e) => { e.stopPropagation(); handleOpenEdit(bank); }}>
                      <IconEdit size={14} />
                    </Button>
                    <Button variant="subtle" size="xs" p={4} color="red" onClick={(e) => { e.stopPropagation(); handleDelete(bank); }}>
                      <IconTrash size={14} />
                    </Button>
                  </Group>
                </Group>
                <Text size="sm" c="dimmed" mb="xs" lineClamp={2}>{bank.description || '暂无描述'}</Text>
                {bank.storagePath && (
                  <Group gap={4} mb="xs">
                    <IconFolder size={12} style={{ color: 'var(--text-muted)' }} />
                    <Text size="xs" c="dimmed" truncate>{bank.storagePath}</Text>
                  </Group>
                )}
                {!bank.storagePath && (
                  <Text size="xs" c="red" mb="xs">未设置数据目录</Text>
                )}
                <Group justify="space-between">
                  {getStatusBadge(bank)}
                  <Text size="xs" c="dimmed">{new Date(bank.updatedAt).toLocaleDateString('zh-CN')}</Text>
                </Group>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      <Modal opened={opened} onClose={close} title={editingBank ? '编辑题库' : '新建题库'} centered>
        <TextInput
          label="题库名称"
          placeholder="输入题库名称"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          mb="md"
          data-autofocus
        />
        <Textarea
          label="描述"
          placeholder="题库描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          mb="md"
          minRows={2}
        />
        <TextInput
          label="数据目录"
          placeholder="例如：/Users/mwj/Documents/MyBank"
          description="题库数据、记录和状态文件将保存在此目录下"
          value={storagePath}
          onChange={(e) => setStoragePath(e.currentTarget.value)}
          required
          mb="md"
        />
        <TagsInput
          label="标签"
          placeholder="添加标签后按回车"
          value={tags}
          onChange={setTags}
          mb="md"
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>取消</Button>
          <Button onClick={handleSave} loading={saving} disabled={!name.trim() || !storagePath.trim()}>
            {editingBank ? '保存' : '创建'}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
