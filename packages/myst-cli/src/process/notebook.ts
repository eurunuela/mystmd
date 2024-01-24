import { computeHash } from 'myst-cli-utils';
import { NotebookCell, RuleId, fileWarn } from 'myst-common';
import type { GenericNode, GenericParent } from 'myst-common';
import { selectAll } from 'unist-util-select';
import { nanoid } from 'nanoid';
import type { MinifiedOutput } from 'nbtx';
import type {
  IAttachments,
  ICell,
  IMimeBundle,
  INotebookContent,
  IOutput,
  MultilineString,
} from '@jupyterlab/nbformat';
import { CELL_TYPES, minifyCellOutput, ensureString } from 'nbtx';
import { VFile } from 'vfile';
import { logMessagesFromVFile } from '../utils/logMessagesFromVFile.js';
import { castSession } from '../session/cache.js';
import type { ISession } from '../session/types.js';
import { BASE64_HEADER_SPLIT } from '../transforms/images.js';
import { parseMyst } from './myst.js';
import type { Code, InlineExpression } from 'myst-spec-ext';
import { findExpression, IUserExpressionMetadata, metadataSection } from '../transforms/index.js';

function blockParent(cell: ICell, children: GenericNode[]) {
  const type = cell.cell_type === CELL_TYPES.code ? NotebookCell.code : NotebookCell.content;
  return { type: 'block', meta: JSON.stringify({ type, ...cell.metadata }), children };
}

/**
 *  mdast transform to move base64 cell attachments directly to image nodes
 *
 * The image transform subsequently handles writing this in-line base64 to file.
 */
function replaceAttachmentsTransform(
  session: ISession,
  mdast: GenericParent,
  attachments: IAttachments,
  file: string,
) {
  const vfile = new VFile();
  vfile.path = file;
  const imageNodes = selectAll('image', mdast);
  imageNodes.forEach((image: GenericNode) => {
    if (!image.url) return;
    const attachmentKey = (image.url as string).match(/^attachment:(.*)$/)?.[1];
    if (!attachmentKey) return;
    try {
      const attachment = Object.entries(attachments[attachmentKey] as IMimeBundle)[0];
      const mimeType = attachment[0];
      const attachmentVal = ensureString(attachment[1] as MultilineString);
      if (!attachmentVal) {
        fileWarn(vfile, `Unrecognized attachment name in ${file}: ${attachmentKey}`, {
          ruleId: RuleId.notebookAttachmentsResolve,
        });
      } else if (attachmentVal.includes(BASE64_HEADER_SPLIT)) {
        image.url = attachmentVal;
      } else {
        image.url = `data:${mimeType}${BASE64_HEADER_SPLIT}${attachmentVal}`;
      }
    } catch {
      fileWarn(vfile, `Unable to resolve attachment in ${file}: ${attachmentKey}`, {
        ruleId: RuleId.notebookAttachmentsResolve,
      });
    }
  });
  logMessagesFromVFile(session, vfile);
}

export async function processNotebook(
  session: ISession,
  file: string,
  content: string
): Promise<GenericParent> {
  const { log } = session;
  const { metadata, cells } = JSON.parse(content) as INotebookContent;
  // notebook will be empty, use generateNotebookChildren, generateNotebookOrder here if we want to populate those

  const language = metadata?.kernelspec?.language ?? 'python';
  log.debug(`Processing Notebook: "${file}"`);

  let end = cells.length;
  if (cells && cells.length > 1 && cells?.[cells.length - 1].source.length === 0) {
    end = -1;
  }

  const items = await cells?.slice(0, end).reduce(
    async (P, cell: ICell, index) => {
      const acc = await P;
      if (cell.cell_type === CELL_TYPES.markdown) {
        const cellContent = ensureString(cell.source);
        // If the first cell is a frontmatter block, do not put a block break above it
        const omitBlockDivider = index === 0 && cellContent.startsWith('---\n');
        const cellMdast = parseMyst(session, cellContent, file);
        if (cell.attachments) {
          replaceAttachmentsTransform(session, cellMdast, cell.attachments as IAttachments, file);
        }
        if (omitBlockDivider) {
          return acc.concat(...cellMdast.children);
        }
        const block = blockParent(cell, cellMdast.children) as GenericNode;

        // Embed expression results into expression
        const userExpressions = block.data?.[metadataSection] as IUserExpressionMetadata[];
        const inlineNodes = selectAll('inlineExpression', block) as InlineExpression[];
        let count = 0;
        inlineNodes.forEach((inlineExpression) => {
          const data = findExpression(userExpressions, inlineExpression.value);
          if (!data) return;
          count += 1;
          inlineExpression.result = data.result as unknown as Record<string, unknown>;
        });
        return acc.concat(block);
      }
      if (cell.cell_type === CELL_TYPES.raw) {
        const raw: Code = {
          type: 'code',
          lang: '',
          value: ensureString(cell.source),
        };
        return acc.concat(blockParent(cell, [raw]));
      }
      if (cell.cell_type === CELL_TYPES.code) {
        const code: Code = {
          type: 'code',
          lang: language as string | undefined,
          executable: true,
          value: ensureString(cell.source),
        };

        // Embed outputs in an output block
        const output: { type: 'output'; id: string; data: IOutput[] } = {
          type: 'output',
          id: nanoid(),
          data: [],
        };

        if (cell.outputs && (cell.outputs as IOutput[]).length > 0) {
          output.data = cell.outputs as IOutput[];
        }
        return acc.concat(blockParent(cell, [code, output]));
      }
      return acc;
    },
    Promise.resolve([] as GenericNode[]),
  );

  return { type: 'root', children: items };
}
