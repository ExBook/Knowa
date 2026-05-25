import type { Option, Question } from '../shared/types';

interface ParsedQuestion {
  type: Question['type'];
  body: object;
  options: Option[];
  answer: number[];
  explanation: object;
  tags: string[];
}

type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
};

const emptyDoc = (): object => ({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });

function parseBody(content: string): object {
  const nodes: RichNode[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      i += 1;

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }

      if (i < lines.length) {
        i += 1;
      }

      nodes.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    const imageMatch = line.trim().match(/^!\[(.*)]\((.+)\)$/);
    if (imageMatch) {
      nodes.push({
        type: 'image',
        attrs: { src: imageMatch[2], alt: imageMatch[1], title: null },
      });
      i += 1;
      continue;
    }

    if (line.trim()) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line.trim() }],
      });
    }

    i += 1;
  }

  return nodes.length > 0 ? { type: 'doc', content: nodes } : emptyDoc();
}

function parseAnswer(answer: string, type: Question['type']): number[] {
  if (type === 'truefalse') {
    const normalized = answer.trim().toUpperCase();
    return ['T', 'TRUE', '对', '是', '正确'].includes(normalized) ? [0] : [1];
  }

  return answer
    .split(/[,，、\s]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .map((part) => {
      const letter = part[0];
      return letter >= 'A' && letter <= 'Z' ? letter.charCodeAt(0) - 65 : -1;
    })
    .filter((index) => index >= 0);
}

function parseQuestionBlock(block: string): ParsedQuestion | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) {
    return null;
  }

  const header = lines[0];
  const typeMatch = header.match(/\[(单选题|多选题|判断题)\]/);
  const tagsMatch = header.match(/\[标签[:：]\s*(.+?)]/);

  const typeMap: Record<string, Question['type']> = {
    单选题: 'single',
    多选题: 'multiple',
    判断题: 'truefalse',
  };

  const type = typeMatch ? typeMap[typeMatch[1]] : 'single';
  const tags = tagsMatch ? tagsMatch[1].split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean) : [];

  let answerReached = false;
  let answer: number[] = [];
  const bodyLines: string[] = [];
  const explanationLines: string[] = [];
  const optionLines: string[] = [];

  for (const line of lines.slice(1)) {
    const answerMatch = line.match(/^>\s*答案[:：]\s*(.+)$/);
    if (answerMatch) {
      answerReached = true;
      answer = parseAnswer(answerMatch[1], type);
      continue;
    }

    const explanationMatch = line.match(/^>\s*解析[:：]\s*(.*)$/);
    if (explanationMatch) {
      answerReached = true;
      explanationLines.push(explanationMatch[1]);
      continue;
    }

    if (answerReached && line.startsWith('>')) {
      explanationLines.push(line.replace(/^>\s?/, ''));
      continue;
    }

    if (!answerReached) {
      if (/^-\s*[A-Z][.、]\s*/i.test(line)) {
        optionLines.push(line);
      } else if (line.trim()) {
        bodyLines.push(line);
      }
    }
  }

  const options = optionLines.map((option, index) => ({
    index,
    content: parseBody(option.replace(/^-\s*[A-Z][.、]\s*/i, '')),
  }));

  return {
    type,
    body: parseBody(bodyLines.join('\n')),
    options,
    answer,
    explanation: parseBody(explanationLines.join('\n')),
    tags,
  };
}

export function parseMarkdown(markdown: string): ParsedQuestion[] {
  return markdown
    .split(/\n\s*---+\s*\n/)
    .map(parseQuestionBlock)
    .filter((question): question is ParsedQuestion => question !== null);
}
