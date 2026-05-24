import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { common, createLowlight } from 'lowlight';
import { RichTextEditor as MantineRichTextEditor } from '@mantine/tiptap';
import { Box } from '@mantine/core';

const lowlight = createLowlight(common);

interface Props {
  content: object;
  onChange: (json: object) => void;
  placeholder?: string;
  minHeight?: number;
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
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  return (
    <Box style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <MantineRichTextEditor editor={editor}>
        <MantineRichTextEditor.Toolbar sticky>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.Underline />
            <MantineRichTextEditor.Strikethrough />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.H1 />
            <MantineRichTextEditor.H2 />
            <MantineRichTextEditor.H3 />
            <MantineRichTextEditor.H4 />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Blockquote />
            <MantineRichTextEditor.CodeBlock />
            <MantineRichTextEditor.BulletList />
            <MantineRichTextEditor.OrderedList />
          </MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Link />
            <MantineRichTextEditor.Unlink />
            <MantineRichTextEditor.Hr />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>
        <MantineRichTextEditor.Content style={{ minHeight }} />
      </MantineRichTextEditor>
    </Box>
  );
}
