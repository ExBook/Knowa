import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Mathematics } from '@tiptap/extension-mathematics';
import { common, createLowlight } from 'lowlight';
import katex from 'katex';
import { Box, Group, ActionIcon, Tooltip, Divider, Modal, Textarea, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBold, IconItalic, IconUnderline, IconStrikethrough,
  IconH1, IconH2, IconH3,
  IconBlockquote, IconCode, IconList, IconListNumbers,
  IconLink, IconUnlink, IconSeparator, IconPhoto,
  IconMath,
} from '@tabler/icons-react';

const lowlight = createLowlight(common);

interface Props {
  content: object;
  onChange: (json: object) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon variant={active ? 'filled' : 'subtle'} color={active ? 'slate' : 'gray'} onClick={onClick} size="sm">
        {children}
      </ActionIcon>
    </Tooltip>
  );
}

function MathDialog({ opened, onClose, onInsert }: { opened: boolean; onClose: () => void; onInsert: (latex: string, displayMode: boolean) => void }) {
  const [latex, setLatex] = useState('');
  const [displayMode, setDisplayMode] = useState(false);
  const [preview, setPreview] = useState('');

  const updatePreview = (value: string) => {
    setLatex(value);
    try {
      setPreview(katex.renderToString(value, { throwOnError: false, displayMode }));
    } catch {
      setPreview('');
    }
  };

  useEffect(() => { updatePreview(latex); }, [displayMode]);

  const handleInsert = () => {
    if (latex.trim()) {
      onInsert(latex.trim(), displayMode);
      setLatex('');
      setPreview('');
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="插入公式" size="md" centered>
      <Textarea
        placeholder="输入 LaTeX，例如：\frac{1}{2}"
        value={latex}
        onChange={(e) => updatePreview(e.currentTarget.value)}
        minRows={2}
        maxRows={4}
        autofocus
        mb="md"
        styles={{ input: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.9rem' } }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.metaKey) handleInsert();
        }}
      />
      <Group mb="md">
        <Button variant={displayMode ? 'default' : 'filled'} size="xs" onClick={() => setDisplayMode(false)}>行内公式 $...$</Button>
        <Button variant={displayMode ? 'filled' : 'default'} size="xs" onClick={() => setDisplayMode(true)}>块公式 $$...$$</Button>
      </Group>
      {preview && (
        <Box style={{ padding: 12, background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', minHeight: 40, overflowX: 'auto' }}>
          <Text size="xs" c="dimmed" mb={4}>预览</Text>
          <Box dangerouslySetInnerHTML={{ __html: preview }} style={{ fontSize: displayMode ? '1.2em' : '1em', textAlign: displayMode ? 'center' : 'left' }} />
        </Box>
      )}
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>取消</Button>
        <Button onClick={handleInsert} disabled={!latex.trim()}>插入</Button>
      </Group>
    </Modal>
  );
}

export function RichTextEditor({ content, onChange, placeholder = '输入内容...', minHeight = 200 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  const [mathOpened, { open: openMath, close: closeMath }] = useDisclosure(false);

  if (!editor) {
    return (
      <Box style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', minHeight, background: 'var(--bg-muted)' }} />
    );
  }

  const addLink = () => {
    const url = window.prompt('输入链接 URL:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('输入图片 URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertMath = (latex: string, displayMode: boolean) => {
    if (displayMode) {
      editor.chain().focus().insertContent({ type: 'blockMath', attrs: { text: latex } }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'inlineMath', attrs: { text: latex } }).run();
    }
  };

  return (
    <Box style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <Group gap={2} p={4} style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexWrap: 'wrap' }}>
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="加粗">
          <IconBold size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="斜体">
          <IconItalic size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} label="下划线">
          <IconUnderline size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} label="删除线">
          <IconStrikethrough size={16} />
        </ToolbarButton>

        <Divider orientation="vertical" mx={2} />

        <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="标题1">
          <IconH1 size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="标题2">
          <IconH2 size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="标题3">
          <IconH3 size={16} />
        </ToolbarButton>

        <Divider orientation="vertical" mx={2} />

        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="引用">
          <IconBlockquote size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="代码块">
          <IconCode size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="无序列表">
          <IconList size={16} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="有序列表">
          <IconListNumbers size={16} />
        </ToolbarButton>

        <Divider orientation="vertical" mx={2} />

        <ToolbarButton active={editor.isActive('link')} onClick={addLink} label="链接">
          <IconLink size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} label="取消链接">
          <IconUnlink size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={addImage} label="图片">
          <IconPhoto size={16} />
        </ToolbarButton>

        <Divider orientation="vertical" mx={2} />

        <ToolbarButton onClick={openMath} label="插入公式">
          <IconMath size={16} />
        </ToolbarButton>

        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label="分割线">
          <IconSeparator size={16} />
        </ToolbarButton>
      </Group>

      <EditorContent editor={editor} style={{ minHeight, padding: '8px 12px' }} />

      <MathDialog opened={mathOpened} onClose={closeMath} onInsert={insertMath} />
    </Box>
  );
}
