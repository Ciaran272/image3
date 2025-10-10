/**
 * AI 超分辨率模块
 * 使用 Upscaler.js 实现（方案 A - 推荐初学者）
 */

// 注意：需要先安装 upscaler 包
// npm install upscaler

// ✅ AI超分辨率已启用
import Upscaler from 'upscaler'

let upscalerInstance: InstanceType<typeof Upscaler> | null = null

async function getUpscaler(): Promise<InstanceType<typeof Upscaler>> {
  if (!upscalerInstance) {
    console.log('正在初始化 AI 超分辨率模型...')
    upscalerInstance = new Upscaler()
  }
  return upscalerInstance
}

export async function aiUpscale(
  imageFile: File,
  scale: number = 2,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    console.log('=== 开始 AI 超分辨率处理 ===')
    console.log('图片信息:', {
      name: imageFile.name,
      size: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
      type: imageFile.type
    })
    
    if (onProgress) onProgress(10)
    
    console.log('步骤1: 初始化 Upscaler 模型...')
    const upscaler = await getUpscaler()
    if (onProgress) onProgress(20)
    
    console.log('步骤2: 加载图片...')
    const img = await loadImage(imageFile)
    console.log('图片尺寸:', `${img.width} × ${img.height}`)
    if (onProgress) onProgress(30)
    
    // 检查图片大小，避免内存溢出
    if (img.width > 2000 || img.height > 2000) {
      console.warn(`⚠️ 图片尺寸较大 (${img.width}×${img.height})，AI处理可能较慢或失败`)
      console.warn('建议：使用更小的图片或降低放大倍数')
    }
    
    console.log(`步骤3: AI 超分辨率处理（放大 ${scale}x）...`)
    console.log('这可能需要 10-30 秒，请耐心等待...')
    
    const result = await upscaler.upscale(img, {
      output: 'base64',
      patchSize: 64,     // 分块处理，避免内存溢出
      padding: 2
    })
    
    console.log('✅ AI 超分辨率处理完成！')
    if (onProgress) onProgress(100)
    
    return result as string
    
  } catch (error) {
    console.error('❌ AI 超分失败，详细错误:', error)
    console.error('错误类型:', error instanceof Error ? error.name : typeof error)
    console.error('错误信息:', error instanceof Error ? error.message : String(error))
    throw new Error(`AI 超分失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    
    reader.readAsDataURL(file)
  })
}

export function base64ToBlobUrl(base64: string): string {
  const parts = base64.split(';base64,')
  const contentType = parts[0].split(':')[1]
  const raw = window.atob(parts[1])
  const rawLength = raw.length
  const uInt8Array = new Uint8Array(rawLength)
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i)
  }
  
  const blob = new Blob([uInt8Array], { type: contentType })
  return URL.createObjectURL(blob)
}

