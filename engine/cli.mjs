import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// true when this module is the script node was started with (so a module can export functions and still have a CLI).
// Both sides go through realpath: node resolves import.meta.url through symlinks and junctions, argv[1] is not.
export const isMain = (metaUrl) => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
};
export const readStdin = () => readFileSync(0, 'utf8');
