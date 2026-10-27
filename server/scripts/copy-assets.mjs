import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/docs', { recursive: true });
cpSync('src/docs/openapi.yaml', 'dist/docs/openapi.yaml');
console.log('Copied openapi.yaml to dist/docs');
