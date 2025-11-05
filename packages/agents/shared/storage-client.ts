import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage client configuration
 */
export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Storage client for managing artifacts in S3/R2
 */
class StorageClientManager {
  private static instance: StorageClientManager;
  private client: S3Client | null = null;
  private config: StorageConfig | null = null;
  private enabled: boolean = false;

  private constructor() {}

  public static getInstance(): StorageClientManager {
    if (!StorageClientManager.instance) {
      StorageClientManager.instance = new StorageClientManager();
    }
    return StorageClientManager.instance;
  }

  /**
   * Initialize storage client
   */
  public initialize(config?: StorageConfig): void {
    if (this.client) {
      return; // Already initialized
    }

    // Try to load from environment if config not provided
    const finalConfig = config || this.loadConfigFromEnv();
    if (!finalConfig) {
      console.warn('[Storage] Configuration not provided. Storage will be disabled.');
      this.enabled = false;
      return;
    }

    this.config = finalConfig;

    this.client = new S3Client({
      endpoint: finalConfig.endpoint,
      region: finalConfig.region,
      credentials: {
        accessKeyId: finalConfig.accessKeyId,
        secretAccessKey: finalConfig.secretAccessKey,
      },
    });

    this.enabled = true;
    console.log('[Storage] Client initialized successfully');
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfigFromEnv(): StorageConfig | null {
    const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    const region = process.env.R2_REGION || process.env.AWS_REGION || 'auto';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET || process.env.S3_BUCKET;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }

    return { endpoint, region, accessKeyId, secretAccessKey, bucket };
  }

  /**
   * Get storage client
   */
  public getClient(): S3Client | null {
    if (!this.client && !this.enabled) {
      this.initialize();
    }
    return this.client;
  }

  /**
   * Get bucket name
   */
  public getBucket(): string | null {
    return this.config?.bucket || null;
  }

  /**
   * Check if storage is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
const storageManager = StorageClientManager.getInstance();

/**
 * Initialize storage client
 */
export function initializeStorage(config?: StorageConfig): void {
  storageManager.initialize(config);
}

/**
 * Get storage client
 */
export function getStorageClient(): S3Client | null {
  return storageManager.getClient();
}

/**
 * Check if storage is enabled
 */
export function isStorageEnabled(): boolean {
  return storageManager.isEnabled();
}

/**
 * Generate storage key with tenant isolation
 */
export function generateStorageKey(
  tenantId: string,
  path: string
): string {
  // Format: tenant/{tenantId}/{path}
  return `tenant/${tenantId}/${path}`;
}

/**
 * Generate artifact storage key
 */
export function generateArtifactKey(
  tenantId: string,
  projectId: string,
  artifactId: string,
  filename: string
): string {
  return generateStorageKey(tenantId, `projects/${projectId}/artifacts/${artifactId}/${filename}`);
}

/**
 * Generate code file storage key
 */
export function generateCodeKey(
  tenantId: string,
  projectId: string,
  filepath: string
): string {
  return generateStorageKey(tenantId, `projects/${projectId}/code/${filepath}`);
}

/**
 * Upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  expires?: Date;
}

/**
 * Upload file to storage
 */
export async function uploadFile(
  key: string,
  content: Buffer | string,
  options: UploadOptions = {}
): Promise<string> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
    ContentType: options.contentType || 'application/octet-stream',
    Metadata: options.metadata,
    CacheControl: options.cacheControl,
    Expires: options.expires,
  };

  const command = new PutObjectCommand(params);
  await client.send(command);

  return key;
}

/**
 * Upload artifact
 */
export async function uploadArtifact(
  tenantId: string,
  projectId: string,
  artifactId: string,
  filename: string,
  content: Buffer | string,
  options: UploadOptions = {}
): Promise<string> {
  const key = generateArtifactKey(tenantId, projectId, artifactId, filename);
  return uploadFile(key, content, options);
}

/**
 * Upload code file
 */
export async function uploadCode(
  tenantId: string,
  projectId: string,
  filepath: string,
  content: string,
  options: Omit<UploadOptions, 'contentType'> = {}
): Promise<string> {
  const key = generateCodeKey(tenantId, projectId, filepath);
  return uploadFile(key, content, {
    ...options,
    contentType: getContentTypeFromExtension(filepath),
  });
}

/**
 * Download file from storage
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  const params: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const command = new GetObjectCommand(params);
  const response = await client.send(command);

  if (!response.Body) {
    throw new Error('No content received from storage');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Download artifact
 */
export async function downloadArtifact(
  tenantId: string,
  projectId: string,
  artifactId: string,
  filename: string
): Promise<Buffer> {
  const key = generateArtifactKey(tenantId, projectId, artifactId, filename);
  return downloadFile(key);
}

/**
 * Download code file
 */
export async function downloadCode(
  tenantId: string,
  projectId: string,
  filepath: string
): Promise<string> {
  const key = generateCodeKey(tenantId, projectId, filepath);
  const buffer = await downloadFile(key);
  return buffer.toString('utf-8');
}

/**
 * Delete file from storage
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Delete artifact
 */
export async function deleteArtifact(
  tenantId: string,
  projectId: string,
  artifactId: string,
  filename: string
): Promise<void> {
  const key = generateArtifactKey(tenantId, projectId, artifactId, filename);
  return deleteFile(key);
}

/**
 * Check if file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(key: string): Promise<{
  size: number;
  lastModified: Date;
  contentType: string;
  metadata: Record<string, string>;
} | null> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {},
    };
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * List files with prefix
 */
export async function listFiles(prefix: string, maxKeys: number = 1000): Promise<string[]> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await client.send(command);
  return response.Contents?.map((obj) => obj.Key!) || [];
}

/**
 * List artifacts for a project
 */
export async function listProjectArtifacts(
  tenantId: string,
  projectId: string
): Promise<string[]> {
  const prefix = generateStorageKey(tenantId, `projects/${projectId}/artifacts/`);
  return listFiles(prefix);
}

/**
 * Generate presigned URL for temporary access
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const client = getStorageClient();
  const bucket = storageManager.getBucket();

  if (!client || !bucket) {
    throw new Error('Storage client not initialized or not enabled');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate presigned URL for artifact
 */
export async function generateArtifactUrl(
  tenantId: string,
  projectId: string,
  artifactId: string,
  filename: string,
  expiresIn?: number
): Promise<string> {
  const key = generateArtifactKey(tenantId, projectId, artifactId, filename);
  return generatePresignedUrl(key, expiresIn);
}

/**
 * Get content type from file extension
 */
export function getContentTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Text
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',

    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',

    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',

    // Code
    ts: 'text/typescript',
    tsx: 'text/typescript',
    jsx: 'text/javascript',
    py: 'text/x-python',
    go: 'text/x-go',
    rs: 'text/x-rust',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Batch upload files
 */
export async function batchUpload(
  files: Array<{ key: string; content: Buffer | string; options?: UploadOptions }>
): Promise<string[]> {
  return Promise.all(files.map((file) => uploadFile(file.key, file.content, file.options)));
}

/**
 * Batch delete files
 */
export async function batchDelete(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteFile(key)));
}

/**
 * Copy file within storage
 */
export async function copyFile(sourceKey: string, destinationKey: string): Promise<void> {
  const content = await downloadFile(sourceKey);
  const metadata = await getFileMetadata(sourceKey);

  await uploadFile(destinationKey, content, {
    contentType: metadata?.contentType,
    metadata: metadata?.metadata,
  });
}
