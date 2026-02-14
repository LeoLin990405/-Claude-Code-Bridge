import { describe, expect, it } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { SkillsService } from '@/process/services/skills/SkillsService';
import type { ISkill } from '@/process/services/skills/types';

const makeTempDir = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hm-skills-'));
  return root;
};

type Statement = {
  run: (...args: any[]) => { changes: number };
  get: (...args: any[]) => any;
  all: (...args: any[]) => any[];
};

const createFakeDb = () => {
  const skills: ISkill[] = [];

  const prepare = (sql: string): Statement => {
    if (sql.includes('INSERT INTO skills')) {
      return {
        run: (...args: any[]) => {
          const [id, name, category, description, filePath, content, manifest, createdAt, updatedAt, version, author, tags] = args;
          skills.push({
            id,
            name,
            category,
            description,
            file_path: filePath,
            content,
            manifest,
            created_at: createdAt,
            updated_at: updatedAt,
            version,
            author,
            tags: JSON.parse(tags || '[]'),
          });
          return { changes: 1 };
        },
        get: () => null,
        all: () => [],
      };
    }

    if (sql.startsWith('SELECT * FROM skills WHERE id')) {
      return {
        run: () => ({ changes: 0 }),
        get: (id: string) => skills.find((skill) => skill.id === id) || undefined,
        all: () => [],
      };
    }

    if (sql.startsWith('SELECT * FROM skills WHERE name')) {
      return {
        run: () => ({ changes: 0 }),
        get: (name: string, category: string) => skills.find((skill) => skill.name === name && skill.category === category) || undefined,
        all: () => [],
      };
    }

    if (sql.startsWith('SELECT * FROM skills WHERE 1=1')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => null,
        all: (...args: any[]) => {
          if (sql.includes('category = ?')) {
            const [category] = args;
            return skills.filter((skill) => skill.category === category);
          }
          return [...skills];
        },
      };
    }

    if (sql.includes('UPDATE skills')) {
      return {
        run: (...args: any[]) => {
          const [description, content, manifest, updatedAt, version, author, tags, id] = args;
          const idx = skills.findIndex((skill) => skill.id === id);
          if (idx === -1) {
            return { changes: 0 };
          }
          skills[idx] = {
            ...skills[idx],
            description,
            content,
            manifest,
            updated_at: updatedAt,
            version,
            author,
            tags: JSON.parse(tags || '[]'),
          };
          return { changes: 1 };
        },
        get: () => null,
        all: () => [],
      };
    }

    if (sql.startsWith('DELETE FROM skills')) {
      return {
        run: (id: string) => {
          const before = skills.length;
          const next = skills.filter((skill) => skill.id !== id);
          skills.splice(0, skills.length, ...next);
          return { changes: before - next.length };
        },
        get: () => null,
        all: () => [],
      };
    }

    return {
      run: () => ({ changes: 0 }),
      get: () => null,
      all: () => [],
    };
  };

  return {
    prepare,
  };
};

describe('SkillsService', () => {
  it('creates, lists, updates, deletes skills', async () => {
    const db = createFakeDb() as any;
    const skillsRoot = await makeTempDir();
    const service = new SkillsService(db, skillsRoot);

    const created = await service.createSkill({
      name: 'test-skill',
      category: 'custom',
      description: 'hello',
      content: '# Test Skill',
      manifest: { name: 'test-skill', version: '1.0.0' },
      tags: ['a', 'b'],
    });

    expect(created.name).toBe('test-skill');
    expect(created.category).toBe('custom');

    const list = service.listSkills();
    expect(list.length).toBe(1);

    const updated = await service.updateSkill(created.id, {
      content: '# Updated',
      tags: ['b', 'c'],
    });
    expect(updated.content).toContain('Updated');

    const skillDir = path.join(skillsRoot, created.file_path);
    const skillMd = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    expect(skillMd).toContain('Updated');

    await service.deleteSkill(created.id);
    expect(service.listSkills().length).toBe(0);

    await expect(fs.stat(skillDir)).rejects.toBeTruthy();
  });
});
