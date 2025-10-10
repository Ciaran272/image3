import { ProcessOptions, ImageType } from '../types'

/**
 * 根据图片类型获取推荐的处理流程
 */
export function getRecommendedPreset(imageType: ImageType): Partial<ProcessOptions> {
  switch (imageType) {
    case 'document':
      // 文档/文字截图 - 推荐基础增强
      return {
        enableBasicEnhancement: true,
        enableAIUpscale: false,
        enableVectorize: false,
        upscaleFactor: 2,
        denoiseLevel: 'medium',
        outputFormat: 'png',
        dpi: 300
      }
    
    case 'logo':
      // Logo/图标 - 推荐矢量化
      return {
        enableBasicEnhancement: true,
        enableAIUpscale: false,
        enableVectorize: true,
        upscaleFactor: 2,
        denoiseLevel: 'light',
        outputFormat: 'both',  // SVG + PNG
        dpi: 'original'
      }
    
    case 'photo':
      // 照片 - 推荐基础增强或 AI 超分
      return {
        enableBasicEnhancement: true,
        enableAIUpscale: false,  // AI 需要配置后才启用
        enableVectorize: false,
        upscaleFactor: 2,
        denoiseLevel: 'light',
        outputFormat: 'png',
        dpi: 300
      }
    
    case 'auto':
    default:
      // 自动识别 - 使用保守的通用配置
      return {
        enableBasicEnhancement: true,
        enableAIUpscale: false,
        enableVectorize: false,
        upscaleFactor: 2,
        denoiseLevel: 'medium',
        outputFormat: 'both',
        dpi: 300
      }
  }
}

/**
 * 获取图片类型的说明文字
 */
export function getImageTypeDescription(imageType: ImageType): string {
  switch (imageType) {
    case 'document':
      return '适合：PDF截图、文档扫描、文字图片。推荐使用基础增强功能。'
    case 'logo':
      return '适合：公司Logo、图标设计、简单图形。会自动转换为 SVG 矢量格式。'
    case 'photo':
      return '适合：人物照片、风景照、复杂图像。推荐启用 AI 超分辨率以获得最佳效果。'
    case 'auto':
      return '系统会自动判断图片类型并选择最佳处理方式。适合不确定类型的图片。'
  }
}

