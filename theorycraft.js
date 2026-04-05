const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function applyAdd(target, add) {
  if (add === undefined || add === null) return target;

  if (typeof add === 'number') {
    if (typeof target === 'number') return target + add;
    if (target === undefined || target === null) return add;
    throw new Error(`Type mismatch: cannot add number to ${typeof target}`);
  }

  if (Array.isArray(add)) {
    if (target === undefined || target === null) return [...add];
    if (!Array.isArray(target)) {
      throw new Error('Type mismatch: cannot add array to non-array');
    }
    return [...target, ...add];
  }

  if (isPlainObject(add)) {
    const base = isPlainObject(target) ? { ...target } : {};
    for (const [key, value] of Object.entries(add)) {
      base[key] = applyAdd(base[key], value);
    }
    return base;
  }

  if (typeof add === 'string') {
    if (target === undefined || target === null) return add;
    if (typeof target === 'string') return add;
    throw new Error(`Type mismatch: cannot add string to ${typeof target}`);
  }

  throw new Error(`Unsupported add value type: ${typeof add}`);
}

function applyRemove(target, remove) {
  if (remove === undefined || remove === null) return target;
  if (target === undefined || target === null) return target;

  if (typeof remove === 'number') {
    if (typeof target !== 'number') return target;
    return target - remove;
  }

  if (Array.isArray(remove)) {
    if (!Array.isArray(target)) return target;
    const removeSet = new Set(remove);
    return target.filter((item) => !removeSet.has(item));
  }

  if (isPlainObject(remove)) {
    if (!isPlainObject(target)) return target;
    const base = { ...target };
    for (const [key, value] of Object.entries(remove)) {
      if (base[key] === undefined) continue;
      base[key] = applyRemove(base[key], value);
    }
    return base;
  }

  return target;
}

function loadYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return YAML.parse(raw) || {};
}

function normalizeDelta(delta) {
  const add = delta.add ? { ...delta.add } : {};
  let remove = delta.remove || {};

  if (!delta.remove && add.remove && isPlainObject(add.remove)) {
    remove = add.remove;
    delete add.remove;
  }

  return { add, remove };
}

function buildCharacter(buildName, level) {
  const buildDir = path.join(__dirname, 'builds', buildName);
  const basePath = path.join(buildDir, '_base.yaml');

  if (!fs.existsSync(basePath)) {
    throw new Error(`Base file not found: ${basePath}`);
  }

  let result = loadYaml(basePath);

  for (let i = 1; i <= level; i += 1) {
    const levelPath = path.join(buildDir, `${i}.yaml`);
    if (!fs.existsSync(levelPath)) {
      throw new Error(`Missing level file: ${levelPath}`);
    }

    const delta = loadYaml(levelPath);
    const { add, remove } = normalizeDelta(delta);

    result = applyAdd(result, add);
    result = applyRemove(result, remove);
  }

  return result;
}

function main() {
  const [buildName, levelRaw] = process.argv.slice(2);

  if (!buildName || !levelRaw) {
    console.error('Usage: node ./theorycraft.js <build-name> <level>');
    process.exit(1);
  }

  const level = Number(levelRaw);
  if (!Number.isInteger(level) || level < 1) {
    console.error('Level must be a positive integer.');
    process.exit(1);
  }

  try {
    const result = buildCharacter(buildName, level);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
