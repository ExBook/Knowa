import { Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <Box style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <Box component="main" style={{ flex: 1, minWidth: 0, height: '100vh', overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
