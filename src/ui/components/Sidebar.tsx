import { ActionIcon, Box, Button, Group, Modal, NavLink, Popover, Stack, Text, Tooltip, UnstyledButton, useMantineColorScheme } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle, IconBooks, IconChevronLeft, IconChevronRight, IconHistory, IconNotes, IconPalette, IconSettings, IconStar } from '@tabler/icons-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAppSettings, saveAppSettings, subscribeAppSettings, themePresetColorScheme, themePresetOptions, type ThemePreset } from '../../services/appSettings';
import { useQuizStore } from '../../stores/quizStore';
import { AppLogo } from './AppLogo';

const navItems = [
  { to: '/', icon: IconBooks, label: '题库' },
  { to: '/starred', icon: IconStar, label: '收藏的题' },
  { to: '/wrong', icon: IconAlertCircle, label: '错题集' },
  { to: '/notes', icon: IconNotes, label: '我的笔记' },
  { to: '/records', icon: IconHistory, label: '做题记录' },
  { to: '/settings', icon: IconSettings, label: '设置' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setColorScheme } = useMantineColorScheme();
  const [activePreset, setActivePreset] = useState<ThemePreset>(() => getAppSettings().themePreset);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [leaveModalOpened, { open: openLeaveModal, close: closeLeaveModal }] = useDisclosure(false);
  const forceCollapsed = useMediaQuery('(max-width: 720px)');
  const isCollapsed = collapsed || forceCollapsed;
  const quizQuestionCount = useQuizStore((state) => state.questions.length);
  const quizFinished = useQuizStore((state) => state.finished);
  const quizInProgress = location.pathname.includes('/quiz') && quizQuestionCount > 0 && !quizFinished;

  useEffect(() => {
    return subscribeAppSettings((settings) => {
      setColorScheme(themePresetColorScheme(settings.themePreset));
      setActivePreset(settings.themePreset);
    });
  }, [setColorScheme]);

  const chooseThemePreset = (themePreset: ThemePreset) => {
    setColorScheme(themePresetColorScheme(themePreset));
    setActivePreset(themePreset);
    saveAppSettings({ ...getAppSettings(), themePreset });
  };

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (quizInProgress && to !== location.pathname) {
      event.preventDefault();
      setPendingNavigation(to);
      openLeaveModal();
    }
  };

  const confirmLeaveQuiz = () => {
    const nextPath = pendingNavigation;
    closeLeaveModal();
    setPendingNavigation(null);
    if (nextPath) {
      navigate(nextPath);
    }
  };

  return (
    <>
      <Box
        component="aside"
        className="app-sidebar"
        style={{
          width: isCollapsed ? 72 : 260,
          height: '100vh',
          borderRight: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 180ms ease',
          overflow: 'hidden',
        }}
      >
        <Box p={isCollapsed ? 6 : 'md'} style={{ position: 'relative' }}>
          <Group gap={isCollapsed ? 4 : 'sm'} justify="space-between" wrap="nowrap">
            <AppLogo compact={isCollapsed} />
            {!forceCollapsed && (
              <Tooltip label={isCollapsed ? '展开菜单' : '折叠菜单'}>
                <ActionIcon
                  variant="subtle"
                  size={isCollapsed ? 28 : 'md'}
                  onClick={() => setCollapsed((value) => !value)}
                  aria-label={isCollapsed ? '展开菜单' : '折叠菜单'}
                  style={{ flexShrink: 0 }}
                >
                  {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={17} />}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Box>

        <Stack gap={2} px="sm">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Tooltip key={to} label={label} disabled={!isCollapsed} position="right">
              <NavLink
                component={Link}
                to={to}
                onClick={(event) => handleNavClick(event, to)}
                active={to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)}
                label={isCollapsed ? undefined : label}
                leftSection={<Icon size={18} />}
                aria-label={label}
                styles={{
                  root: {
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    minHeight: 40,
                    display: 'flex',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                  },
                  section: { marginInlineEnd: isCollapsed ? 0 : undefined },
                  label: { fontWeight: 500 },
                }}
              />
            </Tooltip>
          ))}
        </Stack>

        <Box mt="auto" p="sm" style={{ borderTop: '1px solid var(--border-light)' }}>
          <Group justify={isCollapsed ? 'center' : 'space-between'} align="center" gap={isCollapsed ? 4 : 'sm'}>
            {!isCollapsed && (
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
            )}
            <Popover position="right-end" shadow="md" withArrow width={280}>
              <Popover.Target>
                <Tooltip label="选择主题" disabled={!isCollapsed}>
                  <ActionIcon variant="subtle" size="lg" aria-label="选择主题">
                    <IconPalette size={18} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    选择主题
                  </Text>
                  {themePresetOptions.map((preset) => (
                    <UnstyledButton
                      key={preset.value}
                      className={`theme-menu-card ${activePreset === preset.value ? 'is-active' : ''}`}
                      onClick={() => chooseThemePreset(preset.value)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Box>
                          <Text size="sm" fw={600}>
                            {preset.label}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {preset.description}
                          </Text>
                        </Box>
                        <Group gap={4} wrap="nowrap">
                          {preset.swatches.slice(0, 3).map((color) => (
                            <Box key={color} className="theme-swatch" style={{ width: 18, background: color }} />
                          ))}
                        </Group>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Box>
      </Box>

      <Modal opened={leaveModalOpened} onClose={closeLeaveModal} title="离开本次刷题？" centered>
        <Text size="sm" c="dimmed">
          当前刷题还没有交卷。离开后，本次未完成的作答不会写入做题记录。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeLeaveModal}>
            继续做题
          </Button>
          <Button color="red" onClick={confirmLeaveQuiz}>
            离开且不保存
          </Button>
        </Group>
      </Modal>
    </>
  );
}
