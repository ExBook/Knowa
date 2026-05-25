import { Box, Group, Text } from '@mantine/core';
import { IconFileImport } from '@tabler/icons-react';
import { type ReactNode, useCallback, useId, useState } from 'react';

interface ImportDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  children?: ReactNode;
}

export function ImportDropZone({ onFiles, accept, children }: ImportDropZoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        onFiles(files);
      }
    },
    [onFiles],
  );

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) {
      onFiles(files);
    }
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 40,
        textAlign: 'center',
        background: dragging ? 'var(--accent-light)' : 'var(--bg-muted)',
        transition: 'border-color 150ms ease, background 150ms ease',
        cursor: 'pointer',
      }}
    >
      <input id={inputId} type="file" accept={accept} onChange={handleFileInput} style={{ display: 'none' }} multiple />
      <label htmlFor={inputId} style={{ cursor: 'pointer', display: 'block' }}>
        {children ?? (
          <Group justify="center" gap="xs">
            <IconFileImport size={20} />
            <Text size="sm" c="dimmed">
              点击选择文件，或拖拽文件至此
            </Text>
          </Group>
        )}
      </label>
    </Box>
  );
}
