import { readFile } from './readFile';
import { writeFile } from './writeFile';
import { editFile } from './editFile';
import { listDir } from './listDir';
import { searchContent } from './searchContent';
import { findFiles } from './findFiles';
import { bash } from './bash';
import { agentTools } from '../tools';

const { typeText, translate, formatCode, rewrite, summarize, reply } = agentTools;

export const allTools = {
  readFile,
  writeFile,
  editFile,
  listDir,
  searchContent,
  findFiles,
  bash,
  typeText,
  translate,
  formatCode,
  rewrite,
  summarize,
  reply,
};

export type ToolName = keyof typeof allTools;
