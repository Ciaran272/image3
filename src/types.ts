// 图片类型（场景化）
export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export type OutputFormat = 'svg' | 'png' | 'both';

export interface ProcessOptions {
  // 基础设置
  upscaleFactor: 2 | 3 | 4;
  denoiseLevel: 'none' | 'light' | 'medium' | 'heavy';
  outputFormat: OutputFormat;
  dpi: 'original' | 72 | 150 | 300 | 600;
  
  // 高级模式（自定义处理流程）
  enableBasicEnhancement: boolean;  // 1. 基础放大和去噪
  enableAIUpscale: boolean;         // 2. AI 超分辨率
  enableVectorize: boolean;         // 3. 位图转矢量
  
  // 辅助选项
  vectorizePrecision: 'low' | 'medium' | 'high';
}

export interface ProcessResult {
  svgUrl?: string;
  pngUrl?: string;
  pngSize?: number;
  processingTime: number;
}

export interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;
  status: ProcessStatus;
  progress: number;
  options: ProcessOptions;
  result?: ProcessResult;
  error?: string;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  currentIndex: number;
  startTime?: number;
}

export interface FailedImage {
  id: string;
  filename: string;
  reason: string;
}

