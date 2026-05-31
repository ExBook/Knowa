import type { Bank, Note, Option, Question, QuizRecord } from '../shared/types';
import { db } from '../repo/db';

const demoBankId = 'exlocal-demo-bank';
const demoSeedVersionKey = 'exlocal.demoSeed.version';
const demoSeedVersion = '2026-05-31-v1';

type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: RichNode[];
};

function text(value: string, marks?: Array<{ type: string }>): RichNode {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) };
}

function math(latex: string): RichNode {
  return { type: 'mathInline', attrs: { latex } };
}

function paragraph(content: RichNode[]): RichNode {
  return { type: 'paragraph', content };
}

function codeBlock(code: string, language = 'ts'): RichNode {
  return { type: 'codeBlock', attrs: { language }, content: [text(code)] };
}

function mathBlock(latex: string): RichNode {
  return { type: 'mathBlock', attrs: { latex } };
}

function image(src: string, alt: string, width = 78, align: 'left' | 'center' | 'right' = 'center'): RichNode {
  return { type: 'image', attrs: { src, alt, title: null, width, align } };
}

function doc(content: RichNode[]): object {
  return { type: 'doc', content };
}

function inlineDoc(value: string): object {
  return doc([paragraph([text(value)])]);
}

function option(index: number, value: string): Option {
  return { index, content: inlineDoc(value) };
}

const diagramSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300">
  <rect width="640" height="300" rx="28" fill="#f5f7f0"/>
  <path d="M120 154h130M390 154h130" stroke="#b8c9bd" stroke-width="12" stroke-linecap="round"/>
  <circle cx="112" cy="154" r="54" fill="#466655"/>
  <circle cx="320" cy="154" r="54" fill="#3b4b6b"/>
  <circle cx="528" cy="154" r="54" fill="#c4823d"/>
  <text x="112" y="164" text-anchor="middle" font-size="34" font-weight="700" fill="white">错</text>
  <text x="320" y="164" text-anchor="middle" font-size="34" font-weight="700" fill="white">因</text>
  <text x="528" y="164" text-anchor="middle" font-size="34" font-weight="700" fill="white">改</text>
  <text x="320" y="246" text-anchor="middle" font-size="24" font-weight="700" fill="#466655">错题复盘：错误原因 → 判断依据 → 下次策略</text>
</svg>
`);

const diagramDataUrl = `data:image/svg+xml;utf8,${diagramSvg}`;

function buildQuestions(now: number): Question[] {
  const base = {
    bankId: demoBankId,
    createdAt: now,
  };

  return [
    {
      ...base,
      id: 'exlocal-demo-q1',
      type: 'single',
      body: doc([
        paragraph([text('当 '), math('x \\to 0'), text(' 时，'), math('\\frac{\\sin x}{x}'), text(' 的极限是多少？')]),
        paragraph([text('这道题用于展示行内公式与行内代码：'), text('lim(sin(x) / x)', [{ type: 'code' }]), text('。')]),
      ]),
      options: [option(0, '0'), option(1, '1'), option(2, '无穷大'), option(3, '不存在')],
      answer: [1],
      explanation: doc([paragraph([text('由等价无穷小 '), math('\\sin x \\sim x'), text(' 可知，该极限为 1。')])]),
      tags: ['数学', '基础', '公式'],
      chapter: '高等数学',
      section: '函数与极限',
      knowledgePoint: '等价无穷小',
      starred: true,
      order: 1,
    },
    {
      ...base,
      id: 'exlocal-demo-q2',
      type: 'multiple',
      body: doc([
        paragraph([text('关于二叉搜索树，下列说法正确的是哪些？')]),
        codeBlock(`function inorder(node) {
  if (!node) return;
  inorder(node.left);
  visit(node.value);
  inorder(node.right);
}`),
      ]),
      options: [
        option(0, '中序遍历可以得到有序序列'),
        option(1, '最坏情况下查找复杂度一定是 O(log n)'),
        option(2, '插入操作可能改变树的高度'),
        option(3, '任意节点左子树中的值都小于该节点'),
      ],
      answer: [0, 2, 3],
      explanation: doc([paragraph([text('普通二叉搜索树可能退化成链表，因此最坏查找复杂度不一定是 O(log n)。')])]),
      tags: ['数据结构', '代码', '多选'],
      chapter: '数据结构',
      section: '树',
      knowledgePoint: '二叉搜索树',
      order: 2,
    },
    {
      ...base,
      id: 'exlocal-demo-q3',
      type: 'truefalse',
      body: doc([
        paragraph([text('TCP 通过序列号、确认应答和重传机制提供可靠传输。')]),
        paragraph([text('判断题会使用“正确 / 错误”选项，并保留每次提交记录。')]),
      ]),
      options: [option(0, '正确'), option(1, '错误')],
      answer: [0],
      explanation: doc([paragraph([text('正确。TCP 的可靠性依赖序列号、ACK、超时重传、流量控制等机制共同实现。')])]),
      tags: ['网络', '判断'],
      chapter: '计算机网络',
      section: '传输层',
      knowledgePoint: 'TCP 可靠传输',
      order: 3,
    },
    {
      ...base,
      id: 'exlocal-demo-q4',
      type: 'single',
      body: doc([
        paragraph([text('复盘错题时，最推荐记录哪类内容？')]),
        image(diagramDataUrl, '错题复盘流程示意图', 72, 'center'),
        mathBlock('错误原因 + 判断依据 + 下次策略 = 更有效的复盘'),
      ]),
      options: [option(0, '只记录正确答案'), option(1, '记录自己为什么错以及下次如何判断'), option(2, '把题目复制一遍'), option(3, '只收藏不写笔记')],
      answer: [1],
      explanation: doc([paragraph([text('高质量复盘应记录错误原因和下一次的判断方法，这比单纯保存答案更能减少重复犯错。')])]),
      tags: ['学习方法', '图片', '笔记'],
      chapter: '学习方法',
      section: '错题复盘',
      knowledgePoint: '笔记策略',
      order: 4,
    },
  ];
}

function buildRecords(now: number): QuizRecord[] {
  return [
    {
      id: 'exlocal-demo-record-1',
      bankId: demoBankId,
      questionId: 'exlocal-demo-q1',
      sessionId: 'exlocal-demo-session-1',
      selectedAnswer: [1],
      isCorrect: true,
      timestamp: now - 1000 * 60 * 60,
      duration: 24,
      mode: 'practice',
    },
    {
      id: 'exlocal-demo-record-2',
      bankId: demoBankId,
      questionId: 'exlocal-demo-q2',
      sessionId: 'exlocal-demo-session-1',
      selectedAnswer: [0, 1],
      isCorrect: false,
      timestamp: now - 1000 * 60 * 58,
      duration: 41,
      mode: 'practice',
    },
  ];
}

function buildNotes(now: number): Note[] {
  return [
    {
      id: 'exlocal-demo-note-1',
      bankId: demoBankId,
      questionId: 'exlocal-demo-q1',
      content: doc([paragraph([text('看到 '), math('\\sin x'), text(' 和 '), math('x'), text(' 的比值时，优先想到等价无穷小。')])]),
      updatedAt: now - 1000 * 60 * 20,
    },
    {
      id: 'exlocal-demo-note-2',
      bankId: demoBankId,
      questionId: 'exlocal-demo-q2',
      content: doc([paragraph([text('不要把“平衡树”的复杂度直接套到普通二叉搜索树上。')])]),
      updatedAt: now - 1000 * 60 * 15,
    },
  ];
}

export async function seedDemoData(): Promise<void> {
  if (window.localStorage.getItem(demoSeedVersionKey) === demoSeedVersion) {
    const existing = await db.banks.get(demoBankId);
    if (existing) {
      return;
    }
  }

  const now = Date.now();
  const bank: Bank = {
    id: demoBankId,
    name: '综合示例题库',
    description: '在线体验内置题库，覆盖公式、代码、图片、单选、多选和判断题。',
    tags: ['在线体验', '示例', '本地优先'],
    color: '#eaf7ef',
    createdAt: now,
    updatedAt: now,
    questionCount: 4,
  };
  const questions = buildQuestions(now);
  const records = buildRecords(now);
  const notes = buildNotes(now);

  await db.transaction('rw', db.banks, db.questions, db.quizRecords, db.notes, async () => {
    await db.questions.where('bankId').equals(demoBankId).delete();
    await db.quizRecords.where('bankId').equals(demoBankId).delete();
    await db.notes.where('bankId').equals(demoBankId).delete();
    await db.banks.put(bank);
    await db.questions.bulkPut(questions);
    await db.quizRecords.bulkPut(records);
    await db.notes.bulkPut(notes);
  });

  window.localStorage.setItem(demoSeedVersionKey, demoSeedVersion);
}
