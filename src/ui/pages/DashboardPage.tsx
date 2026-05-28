import { LineChart, PieChart } from '@mantine/charts';
import { ActionIcon, Box, Button, Group, Modal, SimpleGrid, Tabs, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { quizRecordRepo, type QuizStats } from '../../repo/quizRecordRepo';
import { computeDailyStats, computeTagStats, formatDuration, type DailyStat, type TagStat } from '../../services/statsService';
import { useBankStore } from '../../stores/bankStore';
import { useQuestionStore } from '../../stores/questionStore';

const chartColors = ['#3b4b6b', '#5b8c5a', '#c4823d', '#c46b5d', '#8ba4cc', '#7dae7b', '#d49e5a', '#d48b7d'];

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <Box
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
      }}
    >
      <Text fz="1.5rem" fw={700} c={color} style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </Text>
      <Text size="sm" c="dimmed" mt={4}>
        {label}
      </Text>
    </Box>
  );
}

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { questions, loadQuestions } = useQuestionStore();
  const { banks, loadBanks } = useBankStore();
  const bank = banks.find((item) => item.id === id);
  const [stats, setStats] = useState<QuizStats>({ totalAnswered: 0, correctCount: 0, accuracy: 0, totalDuration: 0 });
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [clearModalOpened, { open: openClearModal, close: closeClearModal }] = useDisclosure(false);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  useEffect(() => {
    if (id) {
      void loadQuestions(id);
    }
  }, [id, loadQuestions]);

  useEffect(() => {
    if (!id) {
      return;
    }

    void quizRecordRepo.getStats(id).then(setStats);
    void quizRecordRepo.findByBankId(id).then((records) => {
      setTagStats(computeTagStats(questions, records));
      setDailyStats(computeDailyStats(records));
    });
  }, [id, questions]);

  const pieData = useMemo(
    () =>
      tagStats.map((stat, index) => ({
        name: stat.tag,
        value: stat.questionCount,
        color: chartColors[index % chartColors.length],
      })),
    [tagStats],
  );

  const lineData = useMemo(
    () =>
      dailyStats.map((stat) => ({
        date: stat.date.slice(5),
        total: stat.totalAnswered,
        correct: stat.correctCount,
        accuracy: Math.round(stat.accuracy * 100),
      })),
    [dailyStats],
  );

  const handleClearRecords = async () => {
    if (!id) {
      return;
    }

    const deletedCount = await quizRecordRepo.deleteByBankId(id);
    closeClearModal();
    setStats({ totalAnswered: 0, correctCount: 0, accuracy: 0, totalDuration: 0 });
    setTagStats([]);
    setDailyStats([]);
    notifications.show({ color: 'green', title: '已清空', message: `已删除该题库 ${deletedCount} 条做题记录` });
  };

  return (
    <Box>
      <Box style={{ borderBottom: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-surface)' }}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/bank/${id}`)} aria-label="返回题库详情">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={2} style={{ margin: 0 }}>
              {bank?.name ?? '题库'} · 数据看板
            </Title>
          </Group>
          <Button variant="light" color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={openClearModal}>
            清空做题记录
          </Button>
        </Group>
      </Box>

      <Tabs defaultValue="overview" p="xl">
        <Tabs.List>
          <Tabs.Tab value="overview">概览</Tabs.Tab>
          <Tabs.Tab value="byTag">按标签</Tabs.Tab>
          <Tabs.Tab value="timeline">时间轴</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
            <StatCard value={String(questions.length)} label="总题数" />
            <StatCard value={String(stats.totalAnswered)} label="已作答" />
            <StatCard
              value={`${Math.round(stats.accuracy * 100)}%`}
              label="正确率"
              color={stats.accuracy >= 0.6 ? 'var(--success)' : 'var(--error)'}
            />
            <StatCard value={formatDuration(stats.totalDuration)} label="总用时" />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24 }}>
              <Text fw={500} mb="md">
                每日正确率趋势
              </Text>
              {lineData.length > 0 ? (
                <LineChart
                  h={280}
                  data={lineData}
                  dataKey="date"
                  series={[{ name: 'accuracy', label: '正确率 %', color: 'slate.6' }]}
                  curveType="monotone"
                  gridAxis="xy"
                  withTooltip
                />
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  暂无数据
                </Text>
              )}
            </Box>
            <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24 }}>
              <Text fw={500} mb="md">
                标签分布
              </Text>
              {pieData.length > 0 ? (
                <PieChart h={280} data={pieData} withLabels labelsType="percent" withTooltip />
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  暂无数据
                </Text>
              )}
            </Box>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="byTag" pt="lg">
          <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
            <Group p="sm" style={{ borderBottom: '1px solid var(--border-light)' }} c="dimmed" fz="xs">
              <Text style={{ flex: 1 }} fw={600}>
                标签
              </Text>
              <Text style={{ width: 60, textAlign: 'right' }} fw={600}>
                题数
              </Text>
              <Text style={{ width: 60, textAlign: 'right' }} fw={600}>
                已做
              </Text>
              <Text style={{ width: 70, textAlign: 'right' }} fw={600}>
                正确率
              </Text>
              <Text style={{ width: 80, textAlign: 'right' }} fw={600}>
                平均用时
              </Text>
            </Group>
            {tagStats.map((stat) => (
              <Group key={stat.tag} p="sm" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <Text style={{ flex: 1 }} fw={500}>
                  {stat.tag}
                </Text>
                <Text style={{ width: 60, textAlign: 'right' }}>{stat.questionCount}</Text>
                <Text style={{ width: 60, textAlign: 'right' }}>{stat.answeredCount}</Text>
                <Text style={{ width: 70, textAlign: 'right' }} c={stat.accuracy >= 0.6 ? 'green' : 'red'} fw={500}>
                  {Math.round(stat.accuracy * 100)}%
                </Text>
                <Text style={{ width: 80, textAlign: 'right' }} size="xs" c="dimmed">
                  {formatDuration(stat.avgDuration)}
                </Text>
              </Group>
            ))}
            {tagStats.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                暂无数据
              </Text>
            )}
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="lg">
          {lineData.length > 0 ? (
            <Box style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24 }}>
              <LineChart
                h={350}
                data={lineData}
                dataKey="date"
                series={[
                  { name: 'total', label: '答题数', color: 'slate.6' },
                  { name: 'accuracy', label: '正确率 %', color: 'green.6' },
                ]}
                curveType="monotone"
                gridAxis="xy"
                withTooltip
              />
            </Box>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              暂无数据
            </Text>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={clearModalOpened} onClose={closeClearModal} title="清空做题记录" centered>
        <Text size="sm" c="dimmed">
          确定清空该题库的所有做题记录吗？此操作不可撤销，题目和笔记不会被删除。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeClearModal}>
            取消
          </Button>
          <Button color="red" leftSection={<IconTrash size={14} />} onClick={() => void handleClearRecords()}>
            清空记录
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
