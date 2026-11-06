import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { installSkills, skillTargets, KIT_PATH_FILE } from '../tools/install-skills.mjs';

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = fs.readdirSync(path.join(kit, 'skills'));
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vas-skills-'));

test('installs every skill with the path of the kit', () => {
  const target = path.join(temporary(), 'skills');
  const [result] = installSkills([target]);
  assert.equal(result.installed.length, 12);
  for (const skill of skills) {
    assert.ok(fs.existsSync(path.join(target, skill, 'SKILL.md')), skill);
    assert.equal(fs.readFileSync(path.join(target, skill, KIT_PATH_FILE), 'utf8').trim(), kit);
  }
});

test('updates its own skills but keeps a folder it did not install', () => {
  const target = path.join(temporary(), 'skills');
  installSkills([target]);
  fs.writeFileSync(path.join(target, skills[0], 'SKILL.md'), 'versión vieja');
  fs.mkdirSync(path.join(target, skills[1]), { recursive: true });
  fs.rmSync(path.join(target, skills[1], KIT_PATH_FILE));
  fs.writeFileSync(path.join(target, skills[1], 'mio.txt'), 'de la persona');
  const [again] = installSkills([target]);
  assert.notEqual(fs.readFileSync(path.join(target, skills[0], 'SKILL.md'), 'utf8'), 'versión vieja');
  assert.deepEqual(again.skipped, [skills[1]]);
  assert.ok(fs.existsSync(path.join(target, skills[1], 'mio.txt')));
  const [forced] = installSkills([target], { force: true });
  assert.equal(forced.skipped.length, 0);
  assert.ok(!fs.existsSync(path.join(target, skills[1], 'mio.txt')));
});

test('finds the tools that exist in this computer', () => {
  const home = temporary();
  assert.deepEqual(skillTargets({}, {}, home), []);
  fs.mkdirSync(path.join(home, '.codex'));
  assert.deepEqual(skillTargets({}, {}, home), [path.join(home, '.codex', 'skills')]);
  assert.deepEqual(skillTargets({ claude: true }, {}, home), [path.join(home, '.claude', 'skills')]);
  assert.deepEqual(skillTargets({ target: 'x' }, {}, home), [path.resolve('x')]);
});

test('the check at the root of the kit says what comes next', () => {
  const home = temporary();
  const output = execFileSync(process.execPath, [path.join(kit, 'tools/doctor.mjs')], { cwd: kit, encoding: 'utf8', env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' } });
  const report = JSON.parse(output);
  assert.equal(report.kind, 'kit');
  assert.ok(report.checks.every((check) => check.ok));
  assert.match(report.next, /install-skills/);
});
