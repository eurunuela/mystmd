import fs from 'fs';
import os from 'os';
import type { Root } from 'mdast';
import mime from 'mime-types';
import type { GenericNode } from 'mystjs';
import { selectAll } from 'mystjs';
import fetch from 'node-fetch';
import { dirname, join, parse } from 'path';
import type { VersionId } from '@curvenote/blocks';
import { oxaLinkToId } from '@curvenote/blocks';
import type { PageFrontmatter } from '@curvenote/frontmatter';
import { convertImageToWebp } from '../export/utils/imagemagick';
import type { ISession } from '../session/types';
import {
  addWarningForFile,
  computeHash,
  hashAndCopyStaticFile,
  isUrl,
  staticPath,
  versionIdToURL,
} from '../utils';
import type { ISession } from '../session/types';
import { convertImageToWebp } from '../export/utils/imagemagick';

function isBase64(data: string) {
  return data.split(';base64,').length === 2;
}

function getGithubRawUrl(url?: string): string | undefined {
  const GITHUB_BLOB = /^(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/blob\//;
  if (!url?.match(GITHUB_BLOB)) return undefined;
  return url.replace(GITHUB_BLOB, 'https://raw.githubusercontent.com/$1/$2/');
}

function createTempFolder() {
  return fs.mkdtempSync(join(os.tmpdir(), 'curvenote'));
}

export async function downloadAndSaveImage(
  session: ISession,
  url: string,
  file: string,
  fileFolder: string,
): Promise<string | undefined> {
  const exists = fs.existsSync(fileFolder);
  const fileMatch = exists && fs.readdirSync(fileFolder).find((f) => parse(f).name === file);
  if (exists && fileMatch) {
    session.log.debug(`Cached image found for: ${url}...`);
    return fileMatch;
  }
  const filePath = join(fileFolder, file);
  session.log.debug(`Fetching image: ${url}...\n  -> saving to: ${filePath}`);
  try {
    const github = getGithubRawUrl(url);
    const res = await fetch(github ?? url);
    const contentType = res.headers.get('content-type') || '';
    const extension = mime.extension(contentType);
    if (!extension || !contentType) throw new Error('No content-type for image found.');
    if (!contentType.startsWith('image/')) {
      throw new Error(`ContentType "${contentType}" is not an image`);
    }
    if (!fs.existsSync(fileFolder)) fs.mkdirSync(fileFolder, { recursive: true });
    // Write to a file
    const fileStream = fs.createWriteStream(`${filePath}.${extension}`);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    await new Promise((r) => setTimeout(r, 50));
    const fileName = `${file}.${extension}`;
    session.log.debug(`Image successfully saved to: ${fileName}`);
    return fileName;
  } catch (error) {
    session.log.debug(`\n\n${(error as Error).stack}\n\n`);
    session.log.error(`Error saving image "${url}": ${(error as Error).message}`);
    return undefined;
  }
}

export async function saveImageInStaticFolder(
  session: ISession,
  urlSource: string,
  filePath = '',
  opts?: { webp?: boolean; sourceFile?: string; tempFolder?: string },
): Promise<{ urlSource: string; url: string; webp?: string } | null> {
  const oxa = oxaLinkToId(urlSource);
  const imageLocalFile = join(filePath, urlSource);
  let file: string | undefined;
  const writeFolder = opts?.tempFolder || staticPath(session);
  if (oxa) {
    // If oxa, get the download url
    const versionId = oxa?.block as VersionId;
    if (!versionId?.version) return null;
    const url = versionIdToURL(versionId);
    session.log.debug(`Fetching image version: ${url}`);
    const { ok, json } = await session.get(url);
    const downloadUrl = json.links?.download;
    if (!ok || !downloadUrl) {
      const message = `Error fetching image version: ${url}`;
      addWarningForFile(session, opts?.sourceFile, message, 'error');
      return null;
    }
    file = await downloadAndSaveImage(
      session,
      downloadUrl,
      `${versionId.block}.${versionId.version}`,
      writeFolder,
    );
  } else if (isUrl(urlSource)) {
    // If not oxa, download the URL directly and save it to a file with a hashed name
    file = await downloadAndSaveImage(session, urlSource, computeHash(urlSource), writeFolder);
  } else if (fs.existsSync(imageLocalFile)) {
    // Non-oxa, non-url local image paths relative to the config.section.path
    file = hashAndCopyStaticFile(session, imageLocalFile, writeFolder);
    if (!file) return null;
  } else if (isBase64(urlSource)) {
    // Inline base64 images
    const fileObject = new WebFileObject(session.log, writeFolder, '', true);
    await fileObject.writeBase64(urlSource);
    file = fileObject.id;
  } else {
    const message = `Cannot find image "${urlSource}" in ${opts?.sourceFile || filePath}`;
    addWarningForFile(session, opts?.sourceFile, message, 'error');
    return null;
  }
  let webp: string | undefined;
  if (opts?.webp && file) {
    try {
      const result = await convertImageToWebp(session, join(writeFolder, file));
      if (result) webp = opts?.tempFolder ? join(opts.tempFolder, result) : `/_static/${result}`;
    } catch (error) {
      session.log.debug(`\n\n${(error as Error)?.stack}\n\n`);
      const message = `Large image ${imageLocalFile} (${(error as any).message})`;
      addWarningForFile(session, opts?.sourceFile, message, 'warn');
    }
  }
  // Update mdast with new file name
  const url = opts?.tempFolder ? join(opts.tempFolder, file as string) : `/_static/${file}`;
  return { urlSource, url, webp };
}

export async function transformImages(
  session: ISession,
  file: string,
  mdast: Root,
  opts?: { localExport?: boolean },
) {
  const images = selectAll('image', mdast) as GenericNode[];
  const tempFolder = opts?.localExport ? createTempFolder() : undefined;
  return Promise.all(
    images.map(async (image) => {
      const result = await saveImageInStaticFolder(
        session,
        image.urlSource || image.url,
        dirname(file),
        { webp: true, sourceFile: file, tempFolder },
      );
      if (result) {
        // Update mdast with new file name
        const { urlSource, url, webp } = result;
        image.urlSource = urlSource;
        image.url = url;
        image.urlOptimized = webp;
      }
    }),
  );
}

export async function transformThumbnail(
  session: ISession,
  frontmatter: PageFrontmatter,
  mdast: Root,
  file: string,
) {
  let thumbnail = frontmatter.thumbnail;
  // If the thumbnail is explicitly null, don't add an image
  if (thumbnail === null) {
    session.log.debug(`${file}#frontmatter.thumbnail is explicitly null, not searching content.`);
    return;
  }
  if (!thumbnail) {
    // The thumbnail isn't found, grab it from the mdast
    const [image] = selectAll('image', mdast) as GenericNode[];
    if (!image) {
      session.log.debug(`${file}#frontmatter.thumbnail is not set, and there are no images.`);
      return;
    }
    session.log.debug(`${file}#frontmatter.thumbnail is being populated by the first image.`);
    thumbnail = image.urlSource || image.url;
  }
  if (!thumbnail) return;
  session.log.debug(`${file}#frontmatter.thumbnail Saving thumbnail in static folder.`);
  const result = await saveImageInStaticFolder(session, thumbnail, dirname(file), {
    webp: true,
    sourceFile: file,
  });
  if (result) {
    // Update frontmatter with new file name
    const { url, webp } = result;
    frontmatter.thumbnail = url;
    frontmatter.thumbnailOptimized = webp;
  }
}
