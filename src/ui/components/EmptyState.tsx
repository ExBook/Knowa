import { Box, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ icon = '📭', title, description, children }: EmptyStateProps) {
  return (
    <Box style={{ textAlign: 'center', padding: '60px 20px' }}>
      <Stack align="center" gap="md">
        <Text style={{ fontSize: '3rem', opacity: 0.55, lineHeight: 1 }}>{icon}</Text>
        <Text fw={600} style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
          {title}
        </Text>
        <Text size="sm" c="dimmed" maw={360}>
          {description}
        </Text>
        {children}
      </Stack>
    </Box>
  );
}
