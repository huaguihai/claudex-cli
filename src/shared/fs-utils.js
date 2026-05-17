import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

export async function readJson(file) {
  const raw = await fsp.readFile(file, 'utf8');
  return JSON.parse(raw);
}

export async function writeJson(file, obj, options = {}) {
  const txt = JSON.stringify(obj, null, 2) + '\n';
  await writeAtomic(file, txt, options);
}

export async function readText(file) {
  return fsp.readFile(file, 'utf8');
}

export async function writeAtomic(file, content, options = {}) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.codexx-tmp.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  const mode = options.mode;
  const writeOpts = { encoding: 'utf8' };
  if (mode !== undefined) writeOpts.mode = mode;
  let fd;
  try {
    fd = await fsp.open(tmp, 'w', mode);
    await fd.writeFile(content, 'utf8');
    await fd.sync();
  } finally {
    if (fd) await fd.close();
  }
  await fsp.rename(tmp, file);
}

export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function sha256File(file) {
  const buf = await fsp.readFile(file);
  return sha256(buf);
}

export async function copyFileMode(src, dst, mode) {
  await ensureDir(path.dirname(dst));
  await fsp.copyFile(src, dst);
  if (mode !== undefined) await fsp.chmod(dst, mode);
}

export function expandTilde(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function isoStamp(d = new Date()) {
  return d.toISOString().replaceAll(':', '-');
}
