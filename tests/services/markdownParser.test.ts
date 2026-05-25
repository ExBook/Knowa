import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../src/services/markdownParser';

describe('parseMarkdown', () => {
  it('parses a single-choice question', () => {
    const md = `# Q1 [单选题] [标签: 二叉树, 遍历]
以下关于二叉树遍历的说法中，正确的是？

- A. 前序遍历的第一个节点一定是根节点
- B. 中序遍历的结果一定是升序排列
- C. 后序遍历的最后一个节点一定是叶子节点

> 答案: A
> 解析: 前序为根->左->右。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('single');
    expect(result[0].options).toHaveLength(3);
    expect(result[0].answer).toEqual([0]);
    expect(result[0].tags).toEqual(['二叉树', '遍历']);
    expect(result[0].body).toBeDefined();
  });

  it('parses a multi-choice question', () => {
    const md = `# Q1 [多选题] [标签: 排序]
以下哪些是稳定排序算法？

- A. 冒泡排序
- B. 快速排序
- C. 归并排序
- D. 选择排序

> 答案: A, C
> 解析: 冒泡和归并稳定。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('multiple');
    expect(result[0].answer).toEqual([0, 2]);
  });

  it('parses a true/false question', () => {
    const md = `# Q1 [判断题] [标签: 网络]
TCP 是面向连接的协议。

> 答案: T
> 解析: TCP 通过三次握手建立连接。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('truefalse');
    expect(result[0].answer).toEqual([0]);
  });

  it('parses question with code block', () => {
    const md = `# Q1 [单选题]
时间复杂度分析：

\`\`\`c
int sum = 0;
for (int i = 0; i < n; i++) {
    sum += arr[i];
}
\`\`\`

- A. O(1)
- B. O(n)

> 答案: B
> 解析: 线性时间复杂度。`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    const bodyStr = JSON.stringify(result[0].body);
    expect(bodyStr).toContain('codeBlock');
  });

  it('parses question with image', () => {
    const md = `# Q1 [单选题]
根据下图回答：

![graph](topo-graph.png)

- A. 选项A
- B. 选项B

> 答案: A`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    const bodyStr = JSON.stringify(result[0].body);
    expect(bodyStr).toContain('topo-graph.png');
  });

  it('parses multiple questions separated by ---', () => {
    const md = `# Q1 [单选题]
题目1

- A. 选项A
- B. 选项B

> 答案: A

---

# Q2 [判断题]
题目2

> 答案: F`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('single');
    expect(result[1].type).toBe('truefalse');
  });

  it('parses English answer and explanation markers', () => {
    const md = `# Q1
What is 2 + 2?

- A. 4
- B. 5

> Answer: A
> Explanation: Basic arithmetic.`;

    const result = parseMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].answer).toEqual([0]);
    expect(JSON.stringify(result[0].explanation)).toContain('Basic arithmetic.');
  });
});
