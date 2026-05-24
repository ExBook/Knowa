import { Box } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <Box style={{ display: 'flex', height: '100vh', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
      <Sidebar />
      <Box component="main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
