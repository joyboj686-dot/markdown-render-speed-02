import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as { markdown: string }[];
const rendered = new Array<string>(cases.length);
for (let i = 0; i < cases.length; i++) rendered[i] = parse(cases[i].markdown);
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(rendered));
