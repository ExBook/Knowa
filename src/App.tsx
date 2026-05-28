import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './global.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { applyThemePreset, getAppSettings } from './services/appSettings';
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

export default function App() {
  useEffect(() => {
    applyThemePreset(getAppSettings().themePreset);
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <BrowserRouter>
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
    </MantineProvider>
  );
}
