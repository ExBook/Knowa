import { chromium, type Page } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/verify-p2-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = 'http://localhost:5173';
const findings: string[] = [];

function ok(step: string, passed: boolean, note?: string) {
  const line = passed ? `✅ ${step}` : `❌ ${step}` + (note ? ` — ${note}` : '');
  console.log(line);
  if (!passed) findings.push(line);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // ============================================================
    // Setup: Create a bank with questions first
    // ============================================================
    console.log('\n=== 准备：创建测试数据 ===\n');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.locator('button').filter({ hasText: '新建题库' }).first().click();
    await page.waitForTimeout(400);
    await page.getByLabel('题库名称').fill('导入导出测试');
    await page.getByLabel('数据目录').fill('/tmp/import-export-test');
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(800);

    // Enter bank
    await page.locator('text=导入导出测试').first().click();
    await page.waitForTimeout(600);

    // Add a question for export testing
    await page.getByRole('button', { name: '添加题目' }).first().click();
    await page.waitForTimeout(1000);
    const editors = page.locator('.tiptap');
    if ((await editors.count()) > 0) {
      await editors.nth(0).click();
      await page.keyboard.type('导出测试题目', { delay: 5 });
    }
    await page.locator('button').filter({ hasText: /^[A-F]$/ }).first().click();
    await page.locator('button').filter({ hasText: '保存' }).first().click();
    await page.waitForTimeout(800);

    // ============================================================
    // 导出测试
    // ============================================================
    console.log('\n=== 七、导出 ===\n');

    // Test export shared
    const sharedBtn = page.locator('button').filter({ hasText: '导出共享' });
    ok('7.0 导出共享按钮存在', await sharedBtn.isVisible().catch(() => false));

    // Set up download listener
    const downloadPromise1 = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    await sharedBtn.click();
    const download1 = await downloadPromise1;
    if (download1) {
      const filename1 = download1.suggestedFilename();
      ok('7.1 导出共享文件下载', filename1.endsWith('.exbank'), `文件名: ${filename1}`);
    } else {
      ok('7.1 导出共享文件下载', false, '未触发下载');
    }

    // Test export full
    const fullBtn = page.locator('button').filter({ hasText: '导出完整' });
    ok('7.2 导出完整按钮存在', await fullBtn.isVisible().catch(() => false));

    const downloadPromise2 = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await fullBtn.click();
    const download2 = await downloadPromise2;
    if (download2) {
      const filename2 = download2.suggestedFilename();
      ok('7.3 导出完整文件下载', filename2.endsWith('.exbank'), `文件名: ${filename2}`);
      // Check filename convention
      ok('7.4 导出文件命名正确', filename2.includes('full'), `文件名: ${filename2}`);
    } else {
      ok('7.3 导出完整文件下载', false, '未触发下载');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/export-test.png`, fullPage: true });

    // ============================================================
    // 导入测试 — Markdown
    // ============================================================
    console.log('\n=== 六、导入 ===\n');

    // Create a markdown file and upload it
    const mdContent = `# Q1 [单选题] [标签: 算法]
以下关于二叉树遍历的说法中，正确的是？

- A. 前序遍历的第一个节点一定是根节点
- B. 中序遍历的结果一定是升序排列
- C. 后序遍历的最后一个节点一定是叶子节点

> 答案: A
> 解析: 前序为根→左→右。`;

    // Write the file
    fs.writeFileSync('/tmp/test-import.md', mdContent);

    // Click "Markdown 批量导入" button
    const mdImportBtn = page.locator('button').filter({ hasText: 'Markdown 批量导入' });
    ok('6.0 Markdown导入按钮存在', await mdImportBtn.isVisible().catch(() => false));

    await mdImportBtn.click();
    await page.waitForTimeout(800);

    // Mantine Modal renders in a portal — check for the modal header
    const modalHeader = page.locator('[class*="mantine-Modal-header"]').filter({ hasText: 'Markdown 批量导入' });
    ok('6.1 Markdown导入弹窗打开', await modalHeader.isVisible().catch(() => false));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/import-md-modal.png`, fullPage: true });

    // Fill in markdown
    const textarea = page.locator('textarea');
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill(mdContent);
      await page.waitForTimeout(200);
      ok('6.2 Markdown文本可输入', true);
    } else {
      ok('6.2 Markdown文本可输入', false, 'textarea未找到');
    }

    // Check parsed count
    const parsedText = await page.locator('text=已解析').textContent().catch(() => '');
    ok('6.3 显示解析题目数', parsedText.includes('1'), `解析结果: "${parsedText}"`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/import-md-filled.png`, fullPage: true });

    // Click import button in modal (the one inside the modal footer)
    const importBtn = page.locator('button').filter({ hasText: /^导入$/ }).last();
    if (await importBtn.isVisible().catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(1500);
    }
    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Check modal closed — the modal header should be gone
    const modalGone = !(await modalHeader.isVisible().catch(() => true));
    ok('6.4 点击导入后弹窗关闭', modalGone);

    // Check if question appeared
    const importedQ = await page.locator('text=以下关于二叉树遍历的说法中').isVisible().catch(() => false);
    ok('6.5 导入后题目出现在列表', importedQ);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/import-md-result.png`, fullPage: true });

    // ============================================================
    // 导入测试 — .exbank via file input
    // ============================================================
    console.log('\n=== 六（续）、.exbank 导入 ===\n');

    // First, export to get an .exbank file
    // Make sure no modal is open
    const anyModal = page.locator('[class*="mantine-Modal-header"]');
    if (await anyModal.isVisible().catch(() => false)) {
      console.log('   Modal still open, closing...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    const fullBtn2 = page.locator('button').filter({ hasText: '导出完整' });
    const dlPromise3 = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await fullBtn2.click();
    const download3 = await dlPromise3;

    if (download3) {
      const exbankPath = '/tmp/test-export.exbank';
      await download3.saveAs(exbankPath);
      ok('6.6 导出文件保存成功', fs.existsSync(exbankPath));

      // Now delete all questions to test re-import
      // Delete each question with confirmation
      let deletedCount = 0;
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        const trashBtns = page.locator('button');
        const count = await trashBtns.count();
        let found = false;
        for (let j = 0; j < count; j++) {
          const html = await trashBtns.nth(j).innerHTML().catch(() => '');
          if (html.includes('tabler-icon-trash')) {
            page.once('dialog', async (d) => { await d.accept(); });
            await trashBtns.nth(j).click();
            await page.waitForTimeout(400);
            deletedCount++;
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      console.log(`   Deleted ${deletedCount} questions`);

      // Now re-import via file input
      const importFileBtn = page.locator('button').filter({ hasText: '导入' }).first();
      ok('6.7 导入文件按钮存在', await importFileBtn.isVisible().catch(() => false));

      // Set up dialog handler for alert()
      let alertMsg = '';
      page.once('dialog', async (dialog) => {
        alertMsg = dialog.message();
        await dialog.accept();
      });

      // Use the hidden file input to upload
      await page.locator('#bank-drop-trigger').setInputFiles(exbankPath, { timeout: 5000 });
      await page.waitForTimeout(3000);

      ok('6.8 .exbank 导入成功提示', alertMsg.includes('导入成功'), `提示: "${alertMsg}"`);

      // Check questions are back
      const questionsBack = await page.locator('text=导出测试题目').isVisible().catch(() => false);
      ok('6.9 导入后题目恢复', questionsBack);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/import-exbank-result.png`, fullPage: true });
    } else {
      ok('6.6 导出文件保存成功', false, '下载失败，无法继续测试导入');
    }

  } catch (e) {
    console.error('Fatal:', e);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/import-export-error.png`, fullPage: true });
  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log('   IMPORT/EXPORT VERIFICATION');
  console.log('========================================\n');
  if (findings.length === 0) {
    console.log('All checks passed.');
  } else {
    console.log(`${findings.length} issues:`);
    findings.forEach(f => console.log('  ' + f));
  }
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}/`);
}

main();
