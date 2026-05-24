import { createTheme } from '@mantine/core';

export const theme = createTheme({
  fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontFamilyMonospace: "'SF Mono', 'Fira Code', monospace",
  headings: {
    fontFamily: "Lora, 'Noto Serif SC', serif",
    fontWeight: '600',
  },
  primaryColor: 'slate',
  defaultRadius: 'sm',
  colors: {
    slate: [
      '#faf7f2',
      '#e8ecf3',
      '#d1d9e8',
      '#aab8d4',
      '#8ba4cc',
      '#6d8ab8',
      '#3b4b6b',
      '#2d3b56',
      '#1f2b43',
      '#141c2e',
    ],
  },
});
