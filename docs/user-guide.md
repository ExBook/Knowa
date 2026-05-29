# ExLocal User Guide

Version: 0.1.0

This guide describes the intended user workflows for ExLocal.

## 1. Create A Bank

1. Open the bank list.
2. Click create bank.
3. Enter a bank name, description, optional tags, and an optional soft card color.
4. Save the bank.

The bank card shows the question count and a progress bar derived from answered questions in that bank.

## 2. Add Questions

Open a bank and click add question.

Supported question types:

- Single choice
- Multiple choice
- True/false

Each question can include:

- Rich text body
- Rich text options
- Correct answer
- Explanation
- Tags
- Chapter
- Section
- Knowledge point
- Images
- Inline code and code blocks
- Inline math and block math

Images can be aligned left, centered, or right, and can be scaled for a better quiz-taking view.

## 3. Import Markdown

Use Markdown import when entering many questions at once.

Recommended workflow:

1. Click Markdown import.
2. Use a template button for single choice, multiple choice, or true/false.
3. Replace the placeholder content.
4. Watch the live preview.
5. Fix any format warnings before importing.

The preview renders math and code, so the user can catch formatting mistakes before data is written.

Closing the import dialog with unsaved content must show a confirmation dialog.

## 4. Practice

Open a bank and start a quiz.

Setup options:

- Practice or exam mode
- Sequential or shuffled order
- Chapter, section, and knowledge point filters
- Optional countdown timer
- Quiz reading font style and size

Practice mode submits one question at a time and immediately shows correctness and explanation.

Exam mode stores answers until final submission. If some questions are unanswered, the app warns the user. Unanswered questions count as incorrect after submission.

Leaving an unfinished quiz should ask for confirmation. Unsubmitted quizzes are not saved as completed records.

## 5. Review Completed Questions

After submission, the completion page shows every question as a circular number.

- Green means correct.
- Red means incorrect.
- Neutral means unanswered or not judged.

Clicking a number opens the review for that question. The review must preserve the user's answer, correct answer, correctness colors, and explanation.

The review screen includes a button to return to the completion page.

## 6. Favorites And Wrong Questions

Favorites and wrong questions can be searched, grouped, selected, exported, and redone.

Wrong-question behavior depends on settings:

- `removeWrongWhenCorrect`: when enabled, a question leaves the wrong-question set once the latest answer is correct.
- `autoFavoriteWrong`: when enabled, wrong answers automatically star the question.

Question preview is read-only. Editing a question should navigate to the original bank question editor.

## 7. Notes

The notes page groups noted questions by bank and emphasizes the note body.

Each note item exposes compact icon actions:

- Edit note
- Edit original question

The edit-note dialog should show:

- Question preview
- Correct answer
- Explanation
- Recent quiz records
- Rich text note editor

Notes can be selected and exported.

## 8. Records

The records page groups activity by date and then by quiz session.

A session card should show:

- Bank name
- Time
- Question count
- Accuracy
- Mode

Users can open a session, review individual records, or redo the same question group.

## 9. Export

Supported exports:

- Bank `.exbank`
- Selected questions
- Favorites
- Wrong questions
- Notes
- Full `.exlocal` backup
- PDF

The full backup contains:

- Banks
- Questions
- Quiz records
- Notes
- Settings
- Images

## 10. Desktop Backup Directory

Desktop builds show a platform-aware backup directory in settings.

Default behavior:

- The default directory is the Tauri application local data directory plus `backups`.
- Users can choose a custom backup directory.
- Full backups can be written directly to that directory.

Web preview builds cannot write to arbitrary directories and should use download-based export.

