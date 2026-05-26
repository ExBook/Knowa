import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './global.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { theme } from './theme';
import { AppLayout } from './ui/components/AppLayout';
import { BankDetailPage } from './ui/pages/BankDetailPage';
import { BankListPage } from './ui/pages/BankListPage';
import { DashboardPage } from './ui/pages/DashboardPage';
import { ExportPage } from './ui/pages/ExportPage';
import { QuestionEditorPage } from './ui/pages/QuestionEditorPage';
import { QuizPage } from './ui/pages/QuizPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { StarredPage } from './ui/pages/StarredPage';

export default function App() {
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
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
