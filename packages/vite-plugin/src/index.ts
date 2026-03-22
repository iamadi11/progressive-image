import type { Plugin, ResolvedConfig } from 'vite';
import { encodeSidecar } from '@sidecar/build';
import type { SidecarConfig } from '@sidecar/build';
import { readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

export interface ViteSidecarOptions extends Partial<SidecarConfig> {
  include?: string;
  injectPreload?: boolean;
  minSourceBytes?: number;
}

const DEFAULT_INCLUDE = 'src/**/*.{jpg,jpeg}';
const DEFAULT_MIN_BYTES = 40960;

interface CachedResult {
  mtime: number;
  result: Awaited<ReturnType<typeof encodeSidecar>>;
  srcPath: string;
}

export function sidecarPlugin(opts?: ViteSidecarOptions): Plugin {
  let config: ResolvedConfig;
  const processedImages = new Map<string, CachedResult>();

  return {
    name: 'vite-plugin-sidecar',
    enforce: 'pre',

    configResolved(resolved) {
      config = resolved;
    },

    async buildStart() {
      const include = opts?.include ?? DEFAULT_INCLUDE;
      const minBytes = opts?.minSourceBytes ?? DEFAULT_MIN_BYTES;
      const { globby } = await import('globby');
      const root = config.root;
      const publicDir = join(root, 'public');
      const files = await globby(include, { cwd: root, absolute: true });

      for (const file of files) {
        try {
          const stat = statSync(file);
          if (stat.size < minBytes) continue;

          const cached = processedImages.get(file);
          if (cached && cached.mtime === stat.mtimeMs) continue;

          const outputDir = join(publicDir, 'images');
          const result = await encodeSidecar(file, outputDir, opts);

          const rel = relative(root, result.mainJpegPath).replace(/\\/g, '/').replace(/^public\/?/, '');
          const relPath = '/' + rel;
          processedImages.set(file, { mtime: stat.mtimeMs, result, srcPath: relPath });

          const sidecarBuf = readFileSync(result.sidecarPath);
          const hash = Buffer.from(sidecarBuf).toString('base64').slice(0, 8).replace(/[/+=]/g, 'a');
          const sidecarName = `image-${hash}.sidecar`;
          this.emitFile({
            type: 'asset',
            name: sidecarName,
            source: sidecarBuf,
            fileName: `assets/${sidecarName}`,
          });
          const basename = result.mainJpegPath.split('/').pop()?.replace(/\.(jpg|jpeg)$/i, '') ?? 'image';
          const stableSidecarPath = join(outputDir, `${basename}.sidecar`);
          writeFileSync(stableSidecarPath, sidecarBuf);
        } catch (err) {
          console.warn(`[sidecar] Skipped ${file}:`, err);
        }
      }
    },

    transform(code, id) {
      if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return null;

      const importRegex = /import\s+(?:{\s*)?ProgressiveImg(?:\s*})?\s+from\s+['"]@sidecar\/react['"]/;
      const imgRegex = /<img\s+src=["']([^"']+\.(?:jpg|jpeg))["']([^>]*)>/gi;

      const hasProgressiveImg = importRegex.test(code);
      let modified = code;
      let didReplace = false;

      const imgMatches: Array<{ full: string; src: string; rest: string }> = [];
      let match;
      while ((match = imgRegex.exec(code)) !== null) {
        imgMatches.push({ full: match[0], src: match[1], rest: match[2] });
      }

      for (const { full, src, rest } of imgMatches) {
        const normalized = src.startsWith('/') ? src : '/' + src.replace(/^\.\//, '');
        const entry = Array.from(processedImages.values()).find(
          (e) => e.srcPath === normalized || e.srcPath.endsWith(src) || src.endsWith(e.result.mainJpegPath.split('/').pop() ?? '')
        );
        if (!entry) continue;

        const { result } = entry;
        const sidecarBuf = readFileSync(result.sidecarPath);
        const hash = Buffer.from(sidecarBuf).toString('base64').slice(0, 8).replace(/[/+=]/g, 'a');
        const placeholder = result.level0DataURI;
        const sidecarUrl = `/assets/image-${hash}.sidecar`;

        const eagerAttr = /data-eager/.test(rest) ? ' eager={true}' : '';
        const restClean = rest.replace(/\s*data-eager\s*/g, ' ');
        const replacement = `<ProgressiveImg src="${src}" placeholder="${placeholder}" width={${result.width}} height={${result.height}} sidecarSrc="${sidecarUrl}"${eagerAttr}${restClean}/>`;
        modified = modified.replace(full, replacement);
        didReplace = true;
      }

      // Replace sidecar paths with hashed asset URLs so ProgressiveImg uses the
      // preloaded resource. Handles both sidecarSrc="/images/X.sidecar" and
      // const VAR = '/images/X.sidecar' (so sidecarSrc={VAR} gets the right URL).
      for (const entry of processedImages.values()) {
        const sidecarBuf = readFileSync(entry.result.sidecarPath);
        const hash = Buffer.from(sidecarBuf).toString('base64').slice(0, 8).replace(/[/+=]/g, 'a');
        const sidecarUrl = `/assets/image-${hash}.sidecar`;
        const publicSidecarPath = entry.srcPath.replace(/\.(jpg|jpeg)$/i, '.sidecar');
        const escaped = publicSidecarPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const sidecarSrcRegex = new RegExp(`sidecarSrc=["']${escaped}["']`, 'g');
        const beforeSrc = modified;
        modified = modified.replace(sidecarSrcRegex, `sidecarSrc="${sidecarUrl}"`);
        if (modified !== beforeSrc) didReplace = true;

        const constRegex = new RegExp(
          `(const\\s+\\w+\\s*=\\s*)["']${escaped}["']`,
          'g'
        );
        const beforeConst = modified;
        modified = modified.replace(constRegex, `$1"${sidecarUrl}"`);
        if (modified !== beforeConst) didReplace = true;
      }

      if (!didReplace) return null;
      if (!hasProgressiveImg && imgMatches.length > 0) {
        modified = `import { ProgressiveImg } from '@sidecar/react';\n` + modified;
      }

      return { code: modified, map: null };
    },

    transformIndexHtml(html) {
      if (opts?.injectPreload !== false && processedImages.size > 0) {
        const preloads = Array.from(processedImages.values())
          .map((c) => {
            const sidecarBuf = readFileSync(c.result.sidecarPath);
            const hash = Buffer.from(sidecarBuf).toString('base64').slice(0, 8).replace(/[/+=]/g, 'a');
            return `  <link rel="preload" as="fetch" crossorigin href="/assets/image-${hash}.sidecar">`;
          })
          .join('\n');
        return html.replace('</head>', `${preloads}\n</head>`);
      }
      return html;
    },
  };
}

