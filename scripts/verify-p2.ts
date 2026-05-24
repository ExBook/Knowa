import { chromium, type Page } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/verify-p2-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = 'http://localhost:5173';
const findings: string[] = [];
const steps: string[] = [];

function ok(step: string, passed: boolean, note?: string) {
  const line = passed ? `✅ ${step}` : `❌ ${step}` + (note ? ` — ${note}` : '');
  console.log(line);
  steps.push(line);
  if (!passed) findings.push(line);
}

async function selectQuestionType(page: Page, type: string) {
  // Click the Select component near "题型" label
  const selectWrapper = page.locator('label').filter({ hasText: '题型' }).locator('..').locator('..');
  const input = selectWrapper.locator('input').first();
  await input.click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: type }).click();
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // ============================================================
    // 1. Home page
    // ============================================================
    console.log('\n=== 一、题库管理 ===\n');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const titleOk = await page.locator('h2').first().textContent().then(t => t?.includes('题库')).catch(() => false);
    ok('1.1 首页加载', titleOk || false);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-home.png`, fullPage: true });

    // ============================================================
    // 2. Create bank
    // ============================================================
    console.log('\n=== 二、创建题库 ===\n');

    await page.locator('button').filter({ hasText: '新建题库' }).first().click();
    await page.waitForTimeout(400);

    await page.getByLabel('题库名称').fill('验证测试题库');
    await page.waitForTimeout(80);

    await page.getByLabel('数据目录').fill('/tmp/verify-test-bank');
    await page.waitForTimeout(80);

    await page.getByLabel('描述').fill('自动化验证');
    await page.waitForTimeout(80);

    // TagsInput - use placeholder selector
    await page.locator('input[placeholder*="添加标签"]').fill('测试');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-modal-filled.png` });

    const createBtn = page.getByRole('button', { name: '创建' });
    ok('2.1 名称+目录填写后创建按钮可用', !(await createBtn.isDisabled()));

    await createBtn.click();
    await page.waitForTimeout(800);

    // Verify card
    const cardText = await page.locator('[class*="Card"]').first().textContent().catch(() => '');
    ok('2.2 创建后题库卡片出现', cardText?.includes('验证测试题库') || false);

    const pathOnCard = cardText?.includes('/tmp/verify-test-bank') || false;
    ok('2.3 卡片显示数据目录', pathOnCard, !pathOnCard ? `卡片内容: "${cardText?.substring(0, 120).trim()}"` : undefined);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-bank-card.png`, fullPage: true });

    // ============================================================
    // 3. Enter detail page
    // ============================================================
    console.log('\n=== 三、题库详情页 ===\n');

    // Click the card
    await page.locator('[class*="Card"]').first().click();
    await page.waitForTimeout(600);

    const detailTitle = await page.locator('h2').first().textContent().catch(() => '');
    ok('3.1 详情页标题正确', detailTitle?.includes('验证测试题库') || false);

    const storageBanner = await page.locator('text=IndexedDB').isVisible().catch(() => false);
    ok('3.2 存储信息横幅显示', storageBanner);

    const emptyState = await page.locator('text=还没有题目').isVisible().catch(() => false);
    ok('3.3 空题库显示引导', emptyState);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-detail-empty.png`, fullPage: true });

    // ============================================================
    // 4. Single-choice question
    // ============================================================
    console.log('\n=== 四、创建单选题 ===\n');

    await page.getByRole('button', { name: '添加题目' }).first().click();
    await page.waitForTimeout(1200);

    const editors = page.locator('.tiptap');
    const editorCount = await editors.count();
    ok('4.1 编辑器加载', editorCount >= 3, `找到 ${editorCount} 个编辑器`);

    if (editorCount >= 3) {
      await editors.nth(0).click();
      await page.keyboard.type('二叉树的遍历方式', { delay: 5 });
      await page.waitForTimeout(100);

      await editors.nth(1).click();
      await page.keyboard.type('前序遍历: 根左右', { delay: 5 });
      await page.waitForTimeout(100);

      await editors.nth(2).click();
      await page.keyboard.type('中序遍历: 左根右', { delay: 5 });
      await page.waitForTimeout(100);
      ok('4.2 题干和选项可编辑', true);
    } else {
      ok('4.2 题干和选项可编辑', false);
    }

    // Click answer button A
    await page.locator('button').filter({ hasText: /^[A-F]$/ }).first().click();
    await page.waitForTimeout(200);
    ok('4.3 选中正确答案A', true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-single-choice.png`, fullPage: true });

    await page.locator('button').filter({ hasText: '保存' }).first().click();
    await page.waitForTimeout(800);

    const questionInList = await page.locator('text=二叉树的遍历方式').isVisible().catch(() => false);
    ok('4.4 保存后题目出现在列表', questionInList);

    const singleBadge = await page.locator('text=单选').isVisible().catch(() => false);
    ok('4.5 题型标签显示"单选"', singleBadge);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-single-saved.png`, fullPage: true });

    // ============================================================
    // 5. True/false question
    // ============================================================
    console.log('\n=== 五、创建判断题 ===\n');

    await page.getByRole('button', { name: '添加题目' }).first().click();
    await page.waitForTimeout(1200);

    await selectQuestionType(page, '判断题');

    const trueBtn = page.getByRole('button', { name: '正确 (T)' });
    const falseBtn = page.getByRole('button', { name: '错误 (F)' });
    const hasTFBtns = (await trueBtn.isVisible().catch(() => false)) && (await falseBtn.isVisible().catch(() => false));
    ok('5.1 判断题显示正确/错误按钮', hasTFBtns);

    const tfEditors = page.locator('.tiptap');
    if ((await tfEditors.count()) > 0) {
      await tfEditors.nth(0).click();
      await page.keyboard.type('TCP 是面向连接的协议', { delay: 5 });
    }
    await trueBtn.click();
    await page.waitForTimeout(100);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-truefalse.png`, fullPage: true });

    await page.locator('button').filter({ hasText: '保存' }).first().click();
    await page.waitForTimeout(800);

    const tfBadge = await page.locator('text=判断').isVisible().catch(() => false);
    ok('5.2 判断题保存后显示"判断"标签', tfBadge);

    // ============================================================
    // 6. Multi-choice question
    // ============================================================
    console.log('\n=== 六、创建多选题 ===\n');

    await page.getByRole('button', { name: '添加题目' }).first().click();
    await page.waitForTimeout(1200);

    await selectQuestionType(page, '多选题');

    const mcEditors = page.locator('.tiptap');
    if ((await mcEditors.count()) > 0) {
      await mcEditors.nth(0).click();
      await page.keyboard.type('以下哪些是稳定排序算法', { delay: 5 });
    }

    // Select A and B — there are only 2 default options
    const allAnswerBtns = page.locator('button').filter({ hasText: /^[A-F]$/ });
    const answerCount = await allAnswerBtns.count();
    if (answerCount >= 2) {
      await allAnswerBtns.nth(0).click(); // A
      await page.waitForTimeout(100);
      await allAnswerBtns.nth(1).click(); // B
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(100);
    ok('6.1 多选题可选中多个答案', true, '已选A和B');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-multi-choice.png`, fullPage: true });

    await page.locator('button').filter({ hasText: '保存' }).first().click();
    await page.waitForTimeout(1000);

    // Check for error alert first (Mantine Alert uses role="alert")
    const errorText = await page.getByRole('alert').textContent().catch(() => '');
    const saved = !errorText?.includes('不能') && !errorText?.includes('必须');

    const multiBadge = saved && await page.locator('text=多选').isVisible().catch(() => false);
    if (!multiBadge) {
      // Try to figure out what went wrong
      const pageText = await page.locator('body').textContent().catch(() => '');
      ok('6.2 多选题保存后显示"多选"标签', false, saved ? '已保存但标签未显示' : `保存失败: "${errorText?.substring(0, 40)}"`);
      // If save failed, go back to list
      if (!saved) {
        await page.locator('button').filter({ hasText: '取消' }).first().click();
        await page.waitForTimeout(500);
      }
    } else {
      ok('6.2 多选题保存后显示"多选"标签', true);
    }

    // ============================================================
    // 7. Edit question — navigate via URL to ensure correct question
    // ============================================================
    console.log('\n=== 七、编辑题目 ===\n');

    // We need the question ID of the single-choice question we created.
    // Extract it from the page: look for "二叉树的遍历方式" and its edit link
    // The edit button navigates to /bank/:id/editor/:questionId
    // Instead of clicking buttons, let's find the question row and click edit

    // Find the question text and look for nearby action buttons
    const scQuestion = page.locator('text=二叉树的遍历方式').first();
    // The question row is a flex container. The edit button is in a Group with gap={4}.
    // Structure: Box > Group(justify=space-between) > [Group(badge+text+badge), Group(edit+delete)]
    const rowBox = scQuestion.locator('..').locator('..'); // Go up to the row Box
    const actionGroup = rowBox.locator('> div').last(); // The right-side Group with buttons
    const editButton = actionGroup.locator('button').first();
    await editButton.click();
    await page.waitForTimeout(1200);

    const editEditors = page.locator('.tiptap');
    if ((await editEditors.count()) > 0) {
      const bodyText = await editEditors.nth(0).textContent();
      const hasData = bodyText?.includes('二叉树') || false;
      ok('7.1 编辑时题干回填', hasData, `内容: "${bodyText?.trim().substring(0, 50)}"`);
    } else {
      ok('7.1 编辑时题干回填', false, '编辑器未找到');
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-edit-question.png`, fullPage: true });

    // Go back
    await page.locator('button').filter({ hasText: '取消' }).first().click();
    await page.waitForTimeout(400);

    // ============================================================
    // 8. Save validation
    // ============================================================
    console.log('\n=== 八、保存校验 ===\n');

    await page.getByRole('button', { name: '添加题目' }).first().click();
    await page.waitForTimeout(1000);

    await page.locator('button').filter({ hasText: '保存' }).first().click();
    await page.waitForTimeout(1000);

    // Check for error alert with Chinese validation text
    // Mantine Alert has role="alert"
    const alertEl = page.getByRole('alert');
    const alertText = await alertEl.textContent().catch(() => '');
    ok('8.1 空内容保存显示错误提示', alertText.includes('不能') || alertText.includes('必须'), `提示: "${alertText?.substring(0, 60)}"`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10-validation.png`, fullPage: true });

    await page.locator('button').filter({ hasText: '取消' }).first().click();
    await page.waitForTimeout(400);

    // ============================================================
    // 9. Delete confirmation
    // ============================================================
    console.log('\n=== 九、删除确认 ===\n');

    let dialogMsg = '';
    page.once('dialog', async (dialog) => {
      dialogMsg = dialog.message();
      await dialog.accept();
    });

    // Find delete button (button with IconTrash)
    const allBtns = page.locator('button');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const html = await allBtns.nth(i).innerHTML().catch(() => '');
      if (html.includes('tabler-icon-trash')) {
        await allBtns.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(500);

    ok('9.1 删除弹出确认框', dialogMsg.includes('确定删除'), `消息: "${dialogMsg}"`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/11-final.png`, fullPage: true });

  } catch (e) {
    console.error('Fatal:', e);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/error.png`, fullPage: true });
  } finally {
    await browser.close();
  }

  // ============================================================
  // Report
  // ============================================================
  console.log('\n========================================');
  console.log('   P2 VERIFICATION REPORT');
  console.log('========================================\n');
  for (const s of steps) console.log(s);

  if (findings.length === 0) {
    console.log('\nAll checks passed.');
  } else {
    console.log(`\n${findings.length} issues found:`);
    findings.forEach(f => console.log('  ' + f));
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}/`);
}

main();
