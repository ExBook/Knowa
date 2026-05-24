import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './global.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { theme } from './theme';
import { AppLayout } from './ui/components/AppLayout';
import { BankListPage } from './ui/pages/BankListPage';

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<BankListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
