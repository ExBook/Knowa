import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './global.css';

import { Box, MantineProvider, Text, Title } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { applyThemePreset, getAppSettings } from './services/appSettings';
import { seedDemoData } from './services/demoSeed';
import { theme } from './theme';
import { AppLayout } from './ui/components/AppLayout';
import { BankDetailPage } from './ui/pages/BankDetailPage';
import { BankListPage } from './ui/pages/BankListPage';
import { DashboardPage } from './ui/pages/DashboardPage';
import { ExportPage } from './ui/pages/ExportPage';
import { NotesPage } from './ui/pages/NotesPage';
import { QuestionEditorPage } from './ui/pages/QuestionEditorPage';
import { QuizRecordsPage } from './ui/pages/QuizRecordsPage';
import { QuizPage } from './ui/pages/QuizPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { StarredPage } from './ui/pages/StarredPage';
import { WrongRecordsPage } from './ui/pages/WrongRecordsPage';

const demoMobileMedia = '(max-width: 760px), (pointer: coarse)';

function useDemoMobileBlocked(isDemoBuild: boolean) {
  const [blocked, setBlocked] = useState(() => {
    return isDemoBuild && window.matchMedia(demoMobileMedia).matches;
  });

  useEffect(() => {
    if (!isDemoBuild) {
      return undefined;
    }

    const media = window.matchMedia(demoMobileMedia);
    const sync = () => setBlocked(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [isDemoBuild]);

  return blocked;
}

function DemoMobileBlocked() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #fbf7ef 0%, #edf3e8 100%)',
        color: '#26382f',
        padding: 24,
      }}
    >
      <Box
        style={{
          width: 'min(100%, 520px)',
          padding: 28,
          borderRadius: 28,
          background: 'rgba(255, 255, 255, 0.86)',
          border: '1px solid rgba(70, 102, 85, 0.18)',
          boxShadow: '0 24px 70px rgba(38, 56, 47, 0.14)',
          textAlign: 'center',
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt="Knowa"
          width={72}
          height={72}
          style={{ display: 'block', margin: '0 auto 18px' }}
        />
        <Title order={2}>手机端暂不开放在线体验</Title>
        <Text c="dimmed" mt="sm" lh={1.8}>
          Knowa 网页版包含题库管理、富文本录题、刷题回顾、笔记、记录和导出等完整工作流，需要桌面端或大屏设备才能获得稳定体验。
        </Text>
        <Box mt="xl" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="mantine-focus-auto" href="../index.html" style={{ color: '#466655', fontWeight: 800 }}>
            返回产品主页
          </a>
          <a
            className="mantine-focus-auto"
            href="https://github.com/ExBook/Knowa/releases/tag/v0.1.0"
            style={{ color: '#466655', fontWeight: 800 }}
          >
            下载桌面端
          </a>
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  const isDemoBuild = import.meta.env.VITE_EXLOCAL_DEMO === 'true';
  const demoMobileBlocked = useDemoMobileBlocked(isDemoBuild);
  const [demoReady, setDemoReady] = useState(!isDemoBuild);

  useEffect(() => {
    applyThemePreset(getAppSettings().themePreset);
  }, []);

  useEffect(() => {
    if (!isDemoBuild || demoMobileBlocked) {
      return;
    }

    void seedDemoData()
      .catch((error) => {
        console.error('Failed to seed Knowa demo data', error);
      })
      .finally(() => setDemoReady(true));
  }, [demoMobileBlocked, isDemoBuild]);

  const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      {demoMobileBlocked ? (
        <DemoMobileBlocked />
      ) : demoReady ? (
        <BrowserRouter basename={basename}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<BankListPage />} />
              <Route path="/bank/:id" element={<BankDetailPage />} />
              <Route path="/bank/:id/editor/:questionId" element={<QuestionEditorPage />} />
              <Route path="/bank/:id/quiz" element={<QuizPage />} />
              <Route path="/bank/:id/stats" element={<DashboardPage />} />
              <Route path="/bank/:id/export" element={<ExportPage />} />
              <Route path="/starred" element={<StarredPage />} />
              <Route path="/wrong" element={<WrongRecordsPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/records" element={<QuizRecordsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      ) : (
        <Box
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            padding: 24,
          }}
        >
          <Box>
            <Title order={2}>正在准备示例题库</Title>
            <Text c="dimmed" mt="sm">
              Knowa 在线体验会自动创建包含公式、代码、图片和多题型的示例数据。
            </Text>
          </Box>
        </Box>
      )}
    </MantineProvider>
  );
}
