import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  LoadingOverlay,
  Modal,
  SimpleGrid,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconFileImport, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importExbank } from '../../services/importExportService';
import type { Bank } from '../../shared/types';
import { useBankStore } from '../../stores/bankStore';
import { EmptyState } from '../components/EmptyState';

export function BankListPage() {
  const { banks, loading, loadBanks, createBank, updateBank, deleteBank } = useBankStore();
  const navigate = useNavigate();
  const [opened, { open, close }] = useDisclosure(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  const handleOpenCreate = () => {
    setEditingBank(null);
    setName('');
    setDescription('');
    setTags([]);
    open();
  };

  const handleOpenEdit = (bank: Bank) => {
    setEditingBank(bank);
    setName(bank.name);
    setDescription(bank.description);
    setTags(bank.tags);
    open();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingBank) {
        await updateBank(editingBank.id, { name, description, tags });
      } else {
        await createBank({ name, description, tags });
      }
      close();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: editingBank ? '保存失败' : '创建失败',
        message: (error as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBank) {
      return;
    }

    setDeleting(true);
    try {
      await deleteBank(deletingBank.id);
      notifications.show({ color: 'green', title: '已删除', message: `题库「${deletingBank.name}」已删除` });
      setDeletingBank(null);
    } catch (error) {
      notifications.show({ color: 'red', title: '删除失败', message: (error as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const handleImportBank = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((item) => item.name.toLowerCase().endsWith('.exbank'));
    if (!file) {
      return;
    }

    setImporting(true);
    try {
      const result = await importExbank(file);
      await loadBanks();
      notifications.show({ color: 'green', title: '导入成功', message: `已新建题库「${result.bank.name}」，共 ${result.questionCount} 道题` });
    } catch (error) {
      notifications.show({ color: 'red', title: '导入失败', message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const statusBadge = (bank: Bank) => {
    if (bank.questionCount === 0) {
      return (
        <Badge color="gray" variant="light">
          空题库
        </Badge>
      );
    }

    return (
      <Badge color="slate" variant="light">
        {bank.questionCount} 题
      </Badge>
    );
  };

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
            <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" loading={importing}>
              导入题库
              <input
                type="file"
                accept=".exbank"
                hidden
                onChange={(event) => {
                  void handleImportBank(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              新建题库
            </Button>
          </Group>
        </Group>
      </Box>

      <Box p="xl" pos="relative">
        <LoadingOverlay visible={loading} />
        {banks.length === 0 ? (
          <EmptyState title="还没有题库" description="创建你的第一个题库，或导入别人的题库文件">
            <Group justify="center">
              <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                新建题库
              </Button>
              <Button variant="default" leftSection={<IconFileImport size={16} />} component="label" loading={importing}>
                导入题库
                <input
                  type="file"
                  accept=".exbank"
                  hidden
                  onChange={(event) => {
                    void handleImportBank(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </Button>
            </Group>
          </EmptyState>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {banks.map((bank) => (
              <Card
                key={bank.id}
                padding="lg"
                radius="md"
                withBorder
                style={{
                  minHeight: 150,
                  borderColor: 'var(--border-light)',
                  background: 'var(--bg-surface)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 150ms ease, box-shadow 150ms ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = 'translateY(-2px)';
                  event.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = '';
                  event.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onClick={() => navigate(`/bank/${bank.id}`)}
              >
                <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
                  <Text fw={600} lineClamp={1} style={{ fontFamily: 'var(--font-display)' }}>
                    {bank.name}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      aria-label="编辑题库"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenEdit(bank);
                      }}
                    >
                      <IconEdit size={15} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      aria-label="删除题库"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingBank(bank);
                      }}
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Group>
                </Group>

                <Text size="sm" c="dimmed" lineClamp={2} mb="md" mih={42}>
                  {bank.description || '暂无描述'}
                </Text>

                {bank.tags.length > 0 && (
                  <Group gap={6} mb="md">
                    {bank.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" size="xs">
                        {tag}
                      </Badge>
                    ))}
                    {bank.tags.length > 3 && (
                      <Badge variant="outline" size="xs">
                        +{bank.tags.length - 3}
                      </Badge>
                    )}
                  </Group>
                )}

                <Group justify="space-between" mt="auto">
                  {statusBadge(bank)}
                  <Text size="xs" c="dimmed">
                    {new Date(bank.updatedAt).toLocaleDateString('zh-CN')}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      <Modal opened={opened} onClose={close} title={editingBank ? '编辑题库' : '新建题库'} centered>
        <TextInput
          label="题库名称"
          placeholder="输入题库名称"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          mb="md"
          data-autofocus
        />
        <Textarea
          label="描述"
          placeholder="题库描述（可选）"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          mb="md"
          minRows={2}
        />
        <TagsInput label="标签" placeholder="添加标签后按回车" value={tags} onChange={setTags} mb="md" />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} disabled={!name.trim()}>
            {editingBank ? '保存' : '创建'}
          </Button>
        </Group>
      </Modal>

      <Modal opened={deletingBank !== null} onClose={() => setDeletingBank(null)} title="删除题库" centered>
        <Text size="sm" c="dimmed">
          确定删除题库「{deletingBank?.name}」吗？此操作不可撤销，并会清除该题库下的题目、做题记录和笔记。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeletingBank(null)}>
            取消
          </Button>
          <Button color="red" loading={deleting} onClick={() => void handleConfirmDelete()}>
            删除
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
