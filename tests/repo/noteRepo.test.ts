import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/repo/db';
import { noteRepo } from '../../src/repo/noteRepo';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };

describe('noteRepo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates a note', async () => {
    const note = await noteRepo.save('q1', 'b1', emptyDoc);

    expect(note.id).toBeDefined();
    expect(note.questionId).toBe('q1');
    expect(note.bankId).toBe('b1');
  });

  it('saving twice updates existing note (upsert)', async () => {
    await noteRepo.save('q2', 'b1', emptyDoc);

    const updated = await noteRepo.save('q2', 'b1', {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    });

    expect(updated.id).toBeDefined();
    expect(JSON.stringify(updated.content)).toContain('hello');
    await expect(db.notes.where('questionId').equals('q2').count()).resolves.toBe(1);
  });

  it('finds note by questionId', async () => {
    await noteRepo.save('q3', 'b1', emptyDoc);

    const found = await noteRepo.findByQuestionId('q3');

    expect(found).toBeDefined();
    expect(found?.questionId).toBe('q3');
  });

  it('finds notes by bankId', async () => {
    await noteRepo.save('q4', 'b2', emptyDoc);
    await noteRepo.save('q5', 'b2', emptyDoc);

    const notes = await noteRepo.findByBankId('b2');

    expect(notes).toHaveLength(2);
  });

  it('finds all notes newest first for the notes overview', async () => {
    const older = await noteRepo.save('q7', 'b1', emptyDoc);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const newer = await noteRepo.save('q8', 'b2', {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'visible note' }] }],
    });

    const notes = await noteRepo.findAll();

    expect(notes.map((note) => note.id)).toEqual([newer.id, older.id]);
  });

  it('deletes a note', async () => {
    await noteRepo.save('q6', 'b1', emptyDoc);
    await noteRepo.delete('q6');

    const found = await noteRepo.findByQuestionId('q6');

    expect(found).toBeUndefined();
  });
});
