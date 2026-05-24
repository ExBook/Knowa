import { Box, Text, Group } from '@mantine/core';
import { IconFileImport } from '@tabler/icons-react';
import { useState, useCallback } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  children?: React.ReactNode;
}

export function ImportDropZone({ onFiles, accept, children }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 40,
        textAlign: 'center',
        background: dragging ? 'var(--accent-light)' : 'var(--bg-muted)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        id="import-file-input"
        multiple
      />
      <label htmlFor="import-file-input" style={{ cursor: 'pointer', display: 'block' }}>
        {children || (
          <Group justify="center" gap="xs">
            <IconFileImport size={20} />
            <Text size="sm" c="dimmed">点击选择文件，或拖拽文件/文件夹至此</Text>
          </Group>
        )}
      </label>
    </Box>
  );
}
