import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// true when this module is the script node was started with (so a module can export functions and still have a CLI)
export const isMain = (metaUrl) => Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
export const readStdin = () => readFileSync(0, 'utf8');
