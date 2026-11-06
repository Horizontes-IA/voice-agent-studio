// Instala los skills del kit en Claude Code y Codex, y guarda en cada uno la ruta de este kit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KIT_PATH_FILE = 'kit-path.txt';

export function skillTargets(options = {}, env = process.env, home = os.homedir()) {
  if (options.target) return [path.resolve(options.target)];
  const claude = env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
  const codex = env.CODEX_HOME || path.join(home, '.codex');
  const asked = [options.claude && claude, options.codex && codex].filter(Boolean);
  const homes = asked.length ? asked : [claude, codex].filter((dir) => fs.existsSync(dir));
  return homes.map((dir) => path.join(dir, 'skills'));
}

export function installSkills(targets, { force = false, kit = kitRoot } = {}) {
  const skills = fs.readdirSync(path.join(kit, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return targets.map((target) => {
    fs.mkdirSync(target, { recursive: true });
    const installed = [];
    const skipped = [];
    for (const skill of skills) {
      const destination = path.join(target, skill);
      // Una carpeta sin kit-path.txt no la instaló este comando: puede ser un skill de la persona.
      if (fs.existsSync(destination) && !fs.existsSync(path.join(destination, KIT_PATH_FILE)) && !force) {
        skipped.push(skill);
        continue;
      }
      fs.rmSync(destination, { recursive: true, force: true });
      fs.cpSync(path.join(kit, 'skills', skill), destination, { recursive: true });
      fs.writeFileSync(path.join(destination, KIT_PATH_FILE), kit + '\n');
      installed.push(skill);
    }
    return { target, installed, skipped };
  });
}

function main() {
  const { values } = parseArgs({
    options: {
      claude: { type: 'boolean' },
      codex: { type: 'boolean' },
      target: { type: 'string' },
      force: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('npm run install-skills [-- --claude] [--codex] [--target carpeta] [--force]\nSin opciones instala en Claude Code y Codex, si están en esta computadora.\n--force reemplaza carpetas con el mismo nombre que no instaló este comando.');
    return;
  }
  const targets = skillTargets(values);
  if (!targets.length) {
    console.error('No encontré Claude Code ni Codex en esta computadora. Instala uno y repite el comando, o indica la carpeta con --target.');
    process.exitCode = 1;
    return;
  }
  const results = installSkills(targets, { force: values.force });
  for (const { target, installed, skipped } of results) {
    console.log(`${installed.length} skills instalados en ${target}`);
    if (skipped.length) {
      console.log(`No reemplacé estas carpetas porque ya existían: ${skipped.join(', ')}. Revísalas y, si quieres reemplazarlas, repite con --force.`);
      process.exitCode = 1;
    }
  }
  console.log(`Kit: ${kitRoot}`);
  console.log('Cierra y vuelve a abrir Claude Code o Codex para que los cargue. No muevas esta carpeta; si la mueves, repite este comando.');
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
