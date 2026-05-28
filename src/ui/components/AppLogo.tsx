import { Box, Group, Text } from '@mantine/core';

interface AppLogoProps {
  compact?: boolean;
}

export function AppLogo({ compact }: AppLogoProps) {
  return (
    <Group gap="sm" wrap="nowrap" className={`app-logo ${compact ? 'is-compact' : ''}`}>
      <Box className="app-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="img" focusable="false">
          <rect x="8" y="8" width="48" height="48" rx="16" />
          <path d="M21 20h14c5.5 0 9 3.5 9 9v15H30c-5.5 0-9-3.5-9-9V20Z" />
          <path d="M30 20v24" />
          <path d="M37 28h-9M37 35h-9" />
        </svg>
      </Box>
      {!compact && (
        <Box style={{ minWidth: 0 }}>
          <Text className="app-logo-wordmark" component="div">
            ExLocal
          </Text>
          <Text className="app-logo-slogan" component="div">
            搭建你的个人题库
          </Text>
        </Box>
      )}
    </Group>
  );
}
