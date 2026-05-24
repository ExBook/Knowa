import { ActionIcon, Box, Group, NavLink, Stack, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconBooks, IconMoon, IconSettings, IconStar, IconSun } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/', icon: IconBooks, label: '题库' },
  { to: '/starred', icon: IconStar, label: '收藏的题' },
  { to: '/settings', icon: IconSettings, label: '设置' },
];

export function Sidebar() {
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Box
      component="aside"
      style={{
        width: 260,
        height: '100vh',
        borderRight: '1px solid var(--border-light)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <Box p="md">
        <Group gap="sm">
          <Box
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--accent)',
              color: 'var(--text-on-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            EL
          </Box>
          <Text fw={700} style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            ExLocal
          </Text>
        </Group>
      </Box>

      <Stack gap={2} px="sm">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            active={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)}
            label={label}
            leftSection={<Icon size={18} />}
            styles={{
              root: {
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
              },
              label: { fontWeight: 500 },
            }}
          />
        ))}
      </Stack>

      <Box mt="auto" p="sm" style={{ borderTop: '1px solid var(--border-light)' }}>
        <Group justify="space-between" align="center">
          <Box>
            <Group gap={8}>
              <Box style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)' }} />
              <Text size="xs" c="dimmed">
                本地模式
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              v0.1.0
            </Text>
          </Box>
          <Tooltip label={isDark ? '切换到亮色' : '切换到夜读'}>
            <ActionIcon variant="subtle" onClick={() => toggleColorScheme()} size="lg" aria-label="切换主题">
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
    </Box>
  );
}
