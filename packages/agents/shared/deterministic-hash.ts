// packages/agents/shared/deterministic-hash.ts
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

/**
 * File entry in a manifest
 */
export interface FileEntry {
  path: string; // Relative path from basePath
  hash: string; // SHA-256 hash of normalized content
  size: number; // File size in bytes
}

/**
 * File manifest representing a snapshot of a directory tree
 */
export interface FileManifest {
  basePath: string;
  files: FileEntry[];
  totalHash: string; // Hash of all file hashes combined
  timestamp: string; // When manifest was generated
}

/**
 * Options for generating file manifests
 */
export interface ManifestOptions {
  /**
   * Glob patterns to ignore (relative to basePath)
   * @default ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**']
   */
  ignore?: string[];

  /**
   * Whether to normalize import statements for consistent ordering
   * @default true
   */
  sortImports?: boolean;

  /**
   * Whether to strip comments from code files
   * @default true
   */
  stripComments?: boolean;

  /**
   * Whether to normalize whitespace and line endings
   * @default true
   */
  normalizeWhitespace?: boolean;

  /**
   * File extensions to apply code normalization to
   * @default ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']
   */
  codeExtensions?: string[];
}

/**
 * Difference between two manifests
 */
export interface ManifestDifference {
  path: string;
  reason: 'added' | 'removed' | 'modified';
  oldHash?: string;
  newHash?: string;
}

/**
 * Comparison result between two manifests
 */
export interface ManifestComparison {
  identical: boolean;
  totalHashMatch: boolean;
  differences: ManifestDifference[];
  filesAdded: number;
  filesRemoved: number;
  filesModified: number;
}

const DEFAULT_OPTIONS: Required<ManifestOptions> = {
  ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**', '**/*.log'],
  sortImports: true,
  stripComments: true,
  normalizeWhitespace: true,
  codeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md'],
};

/**
 * Generate a deterministic hash manifest for a directory tree
 *
 * This function creates a cryptographic snapshot of a directory structure
 * by hashing normalized file contents. The normalization ensures that
 * functionally equivalent code produces the same hash even if formatting
 * or comment placement differs.
 *
 * @param basePath - Root directory to generate manifest for
 * @param options - Manifest generation options
 * @returns Promise resolving to FileManifest
 *
 * @example
 * ```typescript
 * const manifest = await generateFileManifest('./my-project', {
 *   ignore: ['node_modules/**', 'dist/**'],
 *   sortImports: true,
 * });
 *
 * console.log(manifest.totalHash); // "a1b2c3d4..."
 * console.log(manifest.files.length); // 42
 * ```
 */
export async function generateFileManifest(
  basePath: string,
  options: ManifestOptions = {}
): Promise<FileManifest> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Resolve absolute path
  const absoluteBasePath = path.resolve(basePath);

  // Check if directory exists
  try {
    const stat = await fs.stat(absoluteBasePath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${absoluteBasePath}`);
    }
  } catch (error) {
    throw new Error(`Cannot access directory: ${absoluteBasePath} - ${error}`);
  }

  // Find all files using glob
  const files = await glob('**/*', {
    cwd: absoluteBasePath,
    ignore: opts.ignore,
    nodir: true,
    dot: false,
  });

  // Process each file
  const fileEntries: FileEntry[] = [];

  for (const relativePath of files.sort()) {
    const absolutePath = path.join(absoluteBasePath, relativePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const normalizedContent = await normalizeContent(
        content,
        relativePath,
        opts
      );

      const hash = hashString(normalizedContent);
      const size = Buffer.byteLength(normalizedContent, 'utf-8');

      fileEntries.push({
        path: relativePath,
        hash,
        size,
      });
    } catch (error) {
      // Skip binary files or files that can't be read as UTF-8
      console.warn(`Skipping file (binary or unreadable): ${relativePath}`);
    }
  }

  // Generate total hash from all file hashes
  const combinedHashes = fileEntries.map((f) => `${f.path}:${f.hash}`).join('\n');
  const totalHash = hashString(combinedHashes);

  return {
    basePath: absoluteBasePath,
    files: fileEntries,
    totalHash,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Normalize file content for deterministic hashing
 *
 * Applies various normalization steps to ensure functionally equivalent
 * files produce the same hash:
 * - Normalize line endings to LF
 * - Strip comments (for code files)
 * - Sort imports (for JS/TS files)
 * - Normalize whitespace
 * - Remove trailing whitespace
 *
 * @param content - Raw file content
 * @param filePath - File path (used to determine file type)
 * @param options - Normalization options
 * @returns Normalized content
 */
async function normalizeContent(
  content: string,
  filePath: string,
  options: Required<ManifestOptions>
): Promise<string> {
  const ext = path.extname(filePath);
  let normalized = content;

  // Always normalize line endings first
  normalized = normalized.replace(/\r\n/g, '\n');

  // Apply code-specific normalization if it's a code file
  if (options.codeExtensions.includes(ext)) {
    // Strip comments (preserve JSDoc for type info)
    if (options.stripComments) {
      normalized = stripComments(normalized, ext);
    }

    // Sort imports for JS/TS files
    if (options.sortImports && ['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      normalized = sortImports(normalized);
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      normalized = normalizeWhitespace(normalized);
    }
  }

  return normalized;
}

/**
 * Strip comments from code while preserving JSDoc
 */
function stripComments(content: string, ext: string): string {
  // For now, only strip single-line comments that aren't JSDoc
  // Preserve JSDoc (/** ... */) for type information
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    // Keep JSDoc comments
    if (trimmed.startsWith('/**') || trimmed.includes('*/')) {
      return true;
    }
    // Remove single-line comments (but keep URLs)
    if (trimmed.startsWith('//') && !trimmed.includes('://')) {
      return false;
    }
    return true;
  });

  return filtered.join('\n');
}

/**
 * Sort import statements alphabetically
 */
function sortImports(content: string): string {
  const lines = content.split('\n');
  const imports: string[] = [];
  const nonImports: string[] = [];
  let inImportBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      imports.push(line);
      inImportBlock = true;
    } else if (inImportBlock && trimmed === '') {
      // Empty line after imports - end of import block
      inImportBlock = false;
      nonImports.push(line);
    } else {
      nonImports.push(line);
    }
  }

  // Sort imports alphabetically
  const sortedImports = imports.sort((a, b) => {
    const aFrom = a.match(/from ['"](.+)['"]/)?.[1] || '';
    const bFrom = b.match(/from ['"](.+)['"]/)?.[1] || '';
    return aFrom.localeCompare(bFrom);
  });

  return [...sortedImports, ...nonImports].join('\n');
}

/**
 * Normalize whitespace: remove trailing spaces, normalize indentation
 */
function normalizeWhitespace(content: string): string {
  const lines = content.split('\n');
  const normalized = lines.map((line) => {
    // Remove trailing whitespace
    const trimmed = line.replace(/\s+$/g, '');
    // Normalize tabs to spaces (2 spaces)
    return trimmed.replace(/\t/g, '  ');
  });

  return normalized.join('\n');
}

/**
 * Generate SHA-256 hash of a string
 */
function hashString(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compare two file manifests
 *
 * Determines if two manifests are identical and provides detailed
 * information about any differences.
 *
 * @param a - First manifest
 * @param b - Second manifest
 * @returns Comparison result with differences
 *
 * @example
 * ```typescript
 * const manifest1 = await generateFileManifest('./output1');
 * const manifest2 = await generateFileManifest('./output2');
 *
 * const comparison = compareManifests(manifest1, manifest2);
 * if (!comparison.identical) {
 *   console.log(`Found ${comparison.filesModified} modified files`);
 *   comparison.differences.forEach(diff => {
 *     console.log(`${diff.path}: ${diff.reason}`);
 *   });
 * }
 * ```
 */
export function compareManifests(
  a: FileManifest,
  b: FileManifest
): ManifestComparison {
  const differences: ManifestDifference[] = [];

  // Create maps for quick lookup
  const aMap = new Map(a.files.map((f) => [f.path, f]));
  const bMap = new Map(b.files.map((f) => [f.path, f]));

  // Check for removed files (in a but not in b)
  for (const file of a.files) {
    if (!bMap.has(file.path)) {
      differences.push({
        path: file.path,
        reason: 'removed',
        oldHash: file.hash,
      });
    }
  }

  // Check for added or modified files (in b)
  for (const file of b.files) {
    const aFile = aMap.get(file.path);

    if (!aFile) {
      // File added
      differences.push({
        path: file.path,
        reason: 'added',
        newHash: file.hash,
      });
    } else if (aFile.hash !== file.hash) {
      // File modified
      differences.push({
        path: file.path,
        reason: 'modified',
        oldHash: aFile.hash,
        newHash: file.hash,
      });
    }
  }

  // Count differences by type
  const filesAdded = differences.filter((d) => d.reason === 'added').length;
  const filesRemoved = differences.filter((d) => d.reason === 'removed').length;
  const filesModified = differences.filter((d) => d.reason === 'modified').length;

  return {
    identical: differences.length === 0,
    totalHashMatch: a.totalHash === b.totalHash,
    differences,
    filesAdded,
    filesRemoved,
    filesModified,
  };
}

/**
 * Save manifest to disk as JSON
 *
 * @param manifest - Manifest to save
 * @param outputPath - Path to save manifest JSON file
 */
export async function saveManifest(
  manifest: FileManifest,
  outputPath: string
): Promise<void> {
  const json = JSON.stringify(manifest, null, 2);
  await fs.writeFile(outputPath, json, 'utf-8');
}

/**
 * Load manifest from disk
 *
 * @param manifestPath - Path to manifest JSON file
 * @returns Loaded manifest
 */
export async function loadManifest(manifestPath: string): Promise<FileManifest> {
  const json = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(json) as FileManifest;
}

/**
 * Verify deterministic synthesis by generating manifests twice
 *
 * This is a helper function for testing. It runs a generation function
 * twice and verifies that both runs produce identical manifests.
 *
 * @param generateFn - Async function that generates files
 * @param outputPath - Path where files are generated
 * @param manifestOptions - Options for manifest generation
 * @returns Comparison result
 *
 * @example
 * ```typescript
 * const result = await verifyDeterministicSynthesis(
 *   async () => {
 *     await runAgent('scaffolder', { projectId: 'test' });
 *   },
 *   './test-output',
 *   { sortImports: true }
 * );
 *
 * if (!result.identical) {
 *   throw new Error('Agent synthesis is not deterministic!');
 * }
 * ```
 */
export async function verifyDeterministicSynthesis(
  generateFn: () => Promise<void>,
  outputPath: string,
  manifestOptions: ManifestOptions = {}
): Promise<ManifestComparison> {
  // First run
  await generateFn();
  const manifest1 = await generateFileManifest(outputPath, manifestOptions);

  // Clean output directory
  await fs.rm(outputPath, { recursive: true, force: true });
  await fs.mkdir(outputPath, { recursive: true });

  // Second run
  await generateFn();
  const manifest2 = await generateFileManifest(outputPath, manifestOptions);

  return compareManifests(manifest1, manifest2);
}
