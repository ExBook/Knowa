import '@mantine/tiptap/styles.css';
import 'katex/dist/katex.min.css';

import { Box, Button, Group, Popover, TextInput } from '@mantine/core';
import { Link, RichTextEditor as MantineRichTextEditor } from '@mantine/tiptap';
import { IconCheck, IconMathFunction } from '@tabler/icons-react';
import { mergeAttributes, Node } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import { NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import katex from 'katex';
import { common, createLowlight } from 'lowlight';
import { useEffect, useState } from 'react';

const lowlight = createLowlight(common);

function renderMath(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    return latex;
  }
}

function MathInlineView({ node }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? '');

  return (
    <NodeViewWrapper
      as="span"
      className="math-inline math-inline-rendered"
      data-math-inline="true"
      data-latex={latex}
      dangerouslySetInnerHTML={{ __html: renderMath(latex) }}
    />
  );
}

const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') ?? '',
        renderHTML: (attributes) => ({ 'data-latex': attributes.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-math-inline': 'true', class: 'math-inline' }),
      node.attrs.latex ?? '',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },
});

interface RichTextEditorProps {
  content: object;
  onChange: (json: object) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '输入内容...',
  minHeight = 200,
}: RichTextEditorProps) {
  const [mathOpened, setMathOpened] = useState(false);
  const [latexDraft, setLatexDraft] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Image,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link,
      MathInline,
    ],
    content,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const insertMath = () => {
    if (!latexDraft.trim()) {
      return;
    }

    editor?.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: latexDraft.trim() } }).run();
    setLatexDraft('');
    setMathOpened(false);
  };

  return (
    <Box
      className="rich-editor-shell"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        resize: 'vertical',
        minHeight,
      }}
    >
      <MantineRichTextEditor editor={editor}>
        <MantineRichTextEditor.Toolbar sticky stickyOffset={0}>
          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Bold />
            <MantineRichTextEditor.Italic />
            <MantineRichTextEditor.Underline />
            <MantineRichTextEditor.Strikethrough />
            <MantineRichTextEditor.Code />
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
            <Popover opened={mathOpened} onChange={setMathOpened} position="bottom-start" shadow="md" withArrow>
              <Popover.Target>
                <MantineRichTextEditor.Control aria-label="插入数学公式" title="插入数学公式" onClick={() => setMathOpened((opened) => !opened)}>
                  <IconMathFunction size={16} />
                </MantineRichTextEditor.Control>
              </Popover.Target>
              <Popover.Dropdown>
                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    size="xs"
                    value={latexDraft}
                    onChange={(event) => setLatexDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        insertMath();
                      }
                    }}
                    placeholder="x^2 + y^2 = z^2"
                    data-autofocus
                  />
                  <Button size="xs" onClick={insertMath} leftSection={<IconCheck size={14} />} disabled={!latexDraft.trim()}>
                    确定
                  </Button>
                </Group>
              </Popover.Dropdown>
            </Popover>
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <MantineRichTextEditor.Link />
            <MantineRichTextEditor.Unlink />
            <MantineRichTextEditor.Hr />
            <MantineRichTextEditor.Undo />
            <MantineRichTextEditor.Redo />
          </MantineRichTextEditor.ControlsGroup>
        </MantineRichTextEditor.Toolbar>

        <MantineRichTextEditor.Content style={{ minHeight }} />
      </MantineRichTextEditor>
    </Box>
  );
}
