import type { Question } from '../shared/types';

interface ParsedQuestion {
  type: Question['type'];
  body: object;
  options: { index: number; content: object }[];
  answer: number[];
  explanation: object;
  tags: string[];
}

function parseBody(content: string): object {
  const nodes: object[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push({
        type: 'codeBlock',
        attrs: { language: lang },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    const imgMatch = line.match(/^!\[(.+)\]\((.+)\)$/);
    if (imgMatch) {
      nodes.push({
        type: 'image',
        attrs: { src: imgMatch[2], alt: imgMatch[1], title: null },
      });
      i++;
      continue;
    }

    if (line.trim()) {
      nodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
    i++;
  }

  return { type: 'doc', content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }] };
}

function parseAnswer(answerStr: string, type: Question['type']): number[] {
  if (type === 'truefalse') {
    const t = answerStr.trim().toUpperCase();
    return t === 'T' || t === '对' || t === '是' ? [0] : [1];
  }

  return answerStr.split(/[,，、\s]+/).map((s) => {
    const letter = s.trim().toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'F') {
      return letter.charCodeAt(0) - 65;
    }
    return -1;
  }).filter((n) => n >= 0);
}

function parseQuestionBlock(block: string): ParsedQuestion | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  const header = lines[0];
  const typeMatch = header.match(/\[(单选题|多选题|判断题)\]/);
  const tagsMatch = header.match(/\[标签:\s*(.+?)\]/);

  const typeMap: Record<string, Question['type']> = {
    '单选题': 'single', '多选题': 'multiple', '判断题': 'truefalse',
  };

  const type = typeMatch ? typeMap[typeMatch[1]] : 'single';
  const tags = tagsMatch ? tagsMatch[1].split(/[,，、]/).map((t) => t.trim()).filter(Boolean) : [];

  let answerLine = -1;
  let explanationContent = '';
  let answerIndices: number[] = [];
  const optionLines: string[] = [];
  const bodyLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('> 答案:')) {
      answerLine = i;
      answerIndices = parseAnswer(line.replace('> 答案:', '').trim(), type);
      continue;
    }
    if (line.startsWith('> 解析:')) {
      explanationContent = line.replace('> 解析:', '').trim();
      continue;
    }
    if (line.startsWith('>') && answerLine !== -1) {
      explanationContent += '\n' + line.replace('>', '').trim();
      continue;
    }

    if (answerLine === -1) {
      if (line.match(/^-\s*[A-F][.、]/)) {
        optionLines.push(line);
      } else if (line.trim()) {
        bodyLines.push(line);
      }
    }
  }

  const body = parseBody(bodyLines.join('\n'));
  const options = optionLines.map((opt, idx) => {
    const content = opt.replace(/^-\s*[A-F][.、]\s*/, '');
    return { index: idx, content: parseBody(content) };
  });
  const explanation = parseBody(explanationContent || '');

  return { type, body, options, answer: answerIndices, explanation, tags };
}

export function parseMarkdown(md: string): ParsedQuestion[] {
  const blocks = md.split(/\n---+\n/);
  return blocks.map(parseQuestionBlock).filter((q): q is ParsedQuestion => q !== null);
}
