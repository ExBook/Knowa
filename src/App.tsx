import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './global.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { theme } from './theme';
import { AppLayout } from './ui/components/AppLayout';
import { BankListPage } from './ui/pages/BankListPage';
import { BankDetailPage } from './ui/pages/BankDetailPage';
import { QuestionEditorPage } from './ui/pages/QuestionEditorPage';

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
          </Route>
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
