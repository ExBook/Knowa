import '@mantine/tiptap/styles.css';
import 'katex/dist/katex.min.css';

import { Box, Button, Group, Popover, SegmentedControl, Slider, Text, TextInput } from '@mantine/core';
import { RichTextEditor as MantineRichTextEditor } from '@mantine/tiptap';
import { IconCheck, IconMathFunction, IconPhoto } from '@tabler/icons-react';
import { mergeAttributes, Node } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
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

function MathBlockView({ node }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? '');

  return (
    <NodeViewWrapper
      className="math-block math-inline-rendered"
      data-math-block="true"
      data-latex={latex}
      dangerouslySetInnerHTML={{ __html: renderMath(latex) }}
    />
  );
}

function ImageView({ node, selected, updateAttributes }: NodeViewProps) {
  const src = String(node.attrs.src ?? '');
  const alt = String(node.attrs.alt ?? '');
  const width = Number(node.attrs.width ?? 60);
  const align = String(node.attrs.align ?? 'center') as 'left' | 'center' | 'right';

  return (
    <NodeViewWrapper className={`rich-editor-image-node ${selected ? 'is-selected' : ''}`} contentEditable={false}>
      <Box className={`rich-editor-image-frame align-${align}`}>
        <img src={src} alt={alt} className="rich-editor-image" style={{ width: `${width}%` }} />
      </Box>
      {selected && (
        <Box className="rich-editor-image-controls">
          <Group gap="xs" wrap="nowrap" align="center">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              图片
            </Text>
            <Box style={{ flex: 1, minWidth: 120 }}>
              <Slider
                size="xs"
                value={width}
                min={20}
                max={100}
                step={5}
                label={(value) => `${value}%`}
                onChange={(value) => updateAttributes({ width: value })}
              />
            </Box>
            <SegmentedControl
              size="xs"
              value={align}
              onChange={(value) => updateAttributes({ align: value })}
              data={[
                { value: 'left', label: '左' },
                { value: 'center', label: '中' },
                { value: 'right', label: '右' },
              ]}
            />
          </Group>
        </Box>
      )}
    </NodeViewWrapper>
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

const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
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
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': 'true', class: 'math-block' }), node.attrs.latex ?? ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});

const StyledImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 60,
        parseHTML: (element) => Number(element.getAttribute('data-width') ?? 60),
        renderHTML: (attributes) => ({ 'data-width': attributes.width }),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const width = Number(HTMLAttributes.width ?? 100);
    const align = String(HTMLAttributes.align ?? 'center');
    const margin =
      align === 'left'
        ? '8px auto 8px 0'
        : align === 'right'
          ? '8px 0 8px auto'
          : '8px auto';

    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        style: `display:block;max-width:100%;width:${width}%;height:auto;margin:${margin};border-radius:6px;`,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
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
  const [mathMode, setMathMode] = useState<'inline' | 'block'>('inline');
  const [imageOpened, setImageOpened] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const [imageWidth, setImageWidth] = useState(50);
  const [imageAlign, setImageAlign] = useState<'left' | 'center' | 'right'>('center');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      StyledImage,
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      MathInline,
      MathBlock,
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

    editor
      ?.chain()
      .focus()
      .insertContent({ type: mathMode === 'block' ? 'mathBlock' : 'mathInline', attrs: { latex: latexDraft.trim() } })
      .run();
    setLatexDraft('');
    setMathOpened(false);
  };

  const handleImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
  };

  const insertImage = () => {
    if (!imageSrc) {
      return;
    }

    editor
      ?.chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: imageSrc, width: imageWidth, align: imageAlign } })
      .run();
    setImageSrc('');
    setImageWidth(50);
    setImageAlign('center');
    setImageOpened(false);
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
                  <SegmentedControl
                    size="xs"
                    value={mathMode}
                    onChange={(value) => setMathMode(value as 'inline' | 'block')}
                    data={[
                      { value: 'inline', label: '行内' },
                      { value: 'block', label: '整行' },
                    ]}
                  />
                  <Button size="xs" onClick={insertMath} leftSection={<IconCheck size={14} />} disabled={!latexDraft.trim()}>
                    确定
                  </Button>
                </Group>
              </Popover.Dropdown>
            </Popover>
          </MantineRichTextEditor.ControlsGroup>

          <MantineRichTextEditor.ControlsGroup>
            <Popover opened={imageOpened} onChange={setImageOpened} position="bottom-start" shadow="md" withArrow>
              <Popover.Target>
                <MantineRichTextEditor.Control aria-label="插入图片" title="插入图片" onClick={() => setImageOpened((opened) => !opened)}>
                  <IconPhoto size={16} />
                </MantineRichTextEditor.Control>
              </Popover.Target>
              <Popover.Dropdown>
                <Box w={260}>
                  <Button variant="default" component="label" fullWidth size="xs" leftSection={<IconPhoto size={14} />}>
                    选择图片
                    <input type="file" hidden accept="image/*" onChange={(event) => handleImageFile(event.currentTarget.files?.[0] ?? null)} />
                  </Button>
                  <Text size="xs" c="dimmed" mt="sm" mb={4}>
                    缩放比例
                  </Text>
                  <Slider value={imageWidth} onChange={setImageWidth} min={20} max={100} step={5} label={(value) => `${value}%`} />
                  {imageSrc && (
                    <Box mt="sm" p="xs" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-muted)' }}>
                      <Text size="xs" c="dimmed" mb={4}>
                        预览
                      </Text>
                      <img
                        src={imageSrc}
                        alt=""
                        style={{
                          display: 'block',
                          width: `${imageWidth}%`,
                          maxWidth: '100%',
                          height: 'auto',
                          margin: imageAlign === 'left' ? '0 auto 0 0' : imageAlign === 'right' ? '0 0 0 auto' : '0 auto',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                    </Box>
                  )}
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    mt="sm"
                    value={imageAlign}
                    onChange={(value) => setImageAlign(value as 'left' | 'center' | 'right')}
                    data={[
                      { value: 'left', label: '左' },
                      { value: 'center', label: '中' },
                      { value: 'right', label: '右' },
                    ]}
                  />
                  <Button fullWidth size="xs" mt="sm" onClick={insertImage} disabled={!imageSrc}>
                    插入图片
                  </Button>
                </Box>
              </Popover.Dropdown>
            </Popover>
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
