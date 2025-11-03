import { ImageItem, ProcessOptions, ProcessResult } from '../types'
import potrace from 'potrace'

// 懒加载 AI 模块，减少首屏 bundle 体积
const loadAIModule = async () => {
  const module = await import('./aiUpscale')
  return module
}

/**
 * 主图片处理函数
 * 注意：这是一个简化版实现，实际的 web-realesrgan 需要额外集成
 */
export async function processImage(
  image: ImageItem,
  onProgress: (progress: number) => void
): Promise<ProcessResult> {
  const startTime = Date.now()
  
  try {
    onProgress(10)
    
    console.log('=== 开始处理图片 ===')
    console.log('处理流程:', {
      基础增强: image.options.enableBasicEnhancement,
      AI超分: image.options.enableAIUpscale,
      矢量化: image.options.enableVectorize
    })
    
    // 新的处理流程：按照勾选的选项依次执行
    return await processWithPipeline(image, onProgress, startTime)
    
  } catch (error) {
    console.error('图片处理失败:', error)
    throw error
  }
}

/**
 * 新的处理流程：根据用户勾选的选项依次执行
 */
async function processWithPipeline(
  image: ImageItem,
  onProgress: (progress: number) => void,
  startTime: number
): Promise<ProcessResult> {
  let currentProgress = 20
  let svgUrl: string | undefined
  let pngUrl: string | undefined
  let currentFile: File = image.file
  let intermediateUrl: string | undefined
  let pngSize: number | undefined
  const wantsPNG = image.options.outputFormat === 'png' || image.options.outputFormat === 'both'
  const wantsSVG = image.options.outputFormat === 'svg' || image.options.outputFormat === 'both'
  const runBasicEnhancement = image.options.enableBasicEnhancement
  const runAIUpscale = image.options.enableAIUpscale
  const runVectorize = image.options.enableVectorize && wantsSVG

  if (wantsSVG && !runVectorize) {
    console.warn('已选择 SVG 输出但未启用矢量化，将不会生成 SVG 结果')
  }
  
  // 统计启用的处理步骤数量
  const enabledSteps = [
    runBasicEnhancement,
    runAIUpscale,
    runVectorize
  ].filter(Boolean).length
  
  const progressPerStep = enabledSteps > 0 ? 70 / enabledSteps : 0
  
  // 步骤 1: 基础放大和去噪
  if (runBasicEnhancement) {
    console.log('执行步骤 1: 基础放大和去噪')
    const enhanceResult = await enhanceImage(currentFile, image.options)
    intermediateUrl = enhanceResult.url
    pngUrl = enhanceResult.url
    pngSize = enhanceResult.size
    
    // 将结果转换为 File 供下一步使用
    try {
      const response = await fetch(intermediateUrl)
      const blob = await response.blob()
      currentFile = new File([blob], image.file.name, { type: 'image/png' })
    } catch (error) {
      console.warn('无法转换中间结果，后续步骤将使用原图', error)
    }
    
    currentProgress += progressPerStep
    onProgress(currentProgress)
  }
  
  // 步骤 2: AI 超分辨率（使用前一步的结果）
  if (runAIUpscale) {
    console.log('执行步骤 2: AI 超分辨率（基于当前结果）')
    try {
      // 动态加载 AI 模块
      const { aiUpscale, base64ToBlobUrl } = await loadAIModule()
      
      // 使用前一步的结果（currentFile），实现协同处理
      const aiResult = await aiUpscale(
        currentFile,  // 使用当前最新的处理结果
        image.options.upscaleFactor,
        (p) => onProgress(currentProgress + p * (progressPerStep / 100))
      )
      intermediateUrl = aiResult.startsWith('data:') ? base64ToBlobUrl(aiResult) : aiResult
      pngUrl = intermediateUrl
      
      // 转换为 File 供下一步使用
    try {
      const response = await fetch(intermediateUrl)
      const blob = await response.blob()
      pngSize = blob.size
      currentFile = new File([blob], image.file.name, { type: 'image/png' })
      console.log('✅ AI 超分结果已转换，供后续步骤使用')
    } catch (error) {
      console.warn('无法转换AI超分结果，后续步骤将使用原图', error)
    }
      
      currentProgress += progressPerStep
    } catch (error) {
      console.warn('AI 超分失败，终止此图片处理', error)
      throw error
    }
    onProgress(currentProgress)
  }
  
  // 步骤 3: 位图转矢量（基于当前最佳结果）
  if (runVectorize) {
    console.log('执行步骤 3: 位图转矢量（基于当前结果）')
    try {
      const vectorizeResult = await vectorizeImage(currentFile, image.options)
      svgUrl = vectorizeResult
      currentProgress += progressPerStep
    } catch (error) {
      console.warn('矢量化失败，跳过此步骤', error)
      currentProgress += progressPerStep
    }
    onProgress(currentProgress)
  }
  
  
  // 如果没有启用任何处理，且需要 PNG 输出，使用基础增强（保持向后兼容）
  if (!enabledSteps && wantsPNG) {
    console.log('未启用任何处理，使用基础增强作为默认')
    const enhanceResult = await enhanceImage(image.file, image.options)
    pngUrl = enhanceResult.url
    pngSize = enhanceResult.size
  }
  
  // 如果仍然没有 PNG 结果，且用户需要 PNG，则抛出错误
  if (!pngUrl && wantsPNG) {
    console.warn('所有处理都失败，无法生成放大结果')
    const error = new Error('AI 超分失败，未生成新的放大图像')
    ;(error as any).skipImage = true
    throw error
  }
  
  // 🔧 修复：为最终的PNG统一添加DPI元数据
  // 如果用户设置了DPI且不是'original'，为最终PNG添加DPI信息
  if (pngUrl && wantsPNG && image.options.dpi !== 'original' && typeof image.options.dpi === 'number') {
    try {
      console.log(`正在为最终PNG添加 ${image.options.dpi} DPI 元数据...`)
      const response = await fetch(pngUrl)
      const blob = await response.blob()
      const blobWithDPI = await addDPIMetadata(blob, image.options.dpi)
      // 释放旧的URL，创建新的URL
      URL.revokeObjectURL(pngUrl)
      const updated = URL.createObjectURL(blobWithDPI)
      pngUrl = updated
      pngSize = blobWithDPI.size
      console.log('✅ DPI 元数据添加成功')
    } catch (error) {
      console.warn('添加 DPI 元数据失败，使用原始图片', error)
    }
  }
  
  onProgress(100)
  
  console.log('处理完成，输出:', { 
    hasSVG: !!svgUrl, 
    hasPNG: !!pngUrl,
    processingTime: Date.now() - startTime
  })

  if (!wantsSVG && svgUrl) {
    try {
      URL.revokeObjectURL(svgUrl)
    } catch (error) {
      console.warn('释放 SVG URL 失败', error)
    }
    svgUrl = undefined
  }

  if (!wantsPNG && pngUrl) {
    try {
      URL.revokeObjectURL(pngUrl)
    } catch (error) {
      console.warn('释放 PNG URL 失败', error)
    }
    pngUrl = undefined
    pngSize = undefined
  }

  if (!svgUrl && !pngUrl) {
    const noOutputError = new Error('未生成可用的输出结果，请检查设置')
    ;(noOutputError as any).skipImage = true
    throw noOutputError
  }
  
  return {
    svgUrl,
    pngUrl,
    pngSize,
    processingTime: Date.now() - startTime
  }
}

/**
 * 从 PNG/JPEG 文件中读取 DPI
 */
async function readImageDPI(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const view = new Uint8Array(arrayBuffer)
    
    // 检查是否为 PNG
    if (view[0] === 137 && view[1] === 80 && view[2] === 78 && view[3] === 71) {
      // PNG 文件
      let offset = 8  // 跳过 PNG 签名
      
      while (offset < view.length - 12) {
        const chunkLength = (view[offset] << 24) | (view[offset + 1] << 16) | (view[offset + 2] << 8) | view[offset + 3]
        const chunkType = String.fromCharCode(view[offset + 4], view[offset + 5], view[offset + 6], view[offset + 7])
        
        if (chunkType === 'pHYs') {
          const pixelsPerMeterX = (view[offset + 8] << 24) | (view[offset + 9] << 16) | (view[offset + 10] << 8) | view[offset + 11]
          const unit = view[offset + 16]
          
          if (unit === 1) {  // 单位是米
            const dpi = Math.round(pixelsPerMeterX / 39.3701)
            console.log(`从 PNG 读取到 DPI: ${dpi}`)
            return dpi
          }
        }
        
        if (chunkType === 'IEND') break
        offset += 12 + chunkLength
      }
    }
    // 检查是否为 JPEG
    else if (view[0] === 0xFF && view[1] === 0xD8) {
      // JPEG 文件
      let offset = 2
      
      while (offset < view.length - 1) {
        if (view[offset] === 0xFF && view[offset + 1] === 0xE0) {  // APP0 marker
          const identifier = String.fromCharCode(
            view[offset + 4], view[offset + 5], view[offset + 6], 
            view[offset + 7], view[offset + 8]
          )
          
          if (identifier === 'JFIF\0') {
            const unit = view[offset + 11]
            if (unit === 1) {  // DPI
              const dpiX = (view[offset + 12] << 8) | view[offset + 13]
              console.log(`从 JPEG 读取到 DPI: ${dpiX}`)
              return dpiX
            }
          }
          break
        }
        offset++
      }
    }
    
    return null
  } catch (error) {
    console.warn('读取图片 DPI 失败:', error)
    return null
  }
}

/**
 * 图片增强处理（使用 Canvas 进行基础增强）
 */
async function enhanceImage(file: File, options: ProcessOptions): Promise<{ url: string; size: number }> {
  return new Promise(async (resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    // 如果选择保持原始 DPI，先尝试读取原始文件的 DPI
    let originalDPI: number | null = null
    if (options.dpi === 'original') {
      originalDPI = await readImageDPI(file)
      console.log(`原始文件 DPI: ${originalDPI || '未找到'}`)
    }
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      
      // 只按放大倍数计算尺寸，DPI 仅写入元数据
      const finalScale = options.upscaleFactor
      // 如果选择保持原始且找到了原始 DPI，使用它；否则根据设置
      const targetDPI = options.dpi === 'original' 
        ? (originalDPI || 0)  // 使用读取到的原始 DPI，如果没有就不写入
        : Number(options.dpi)
      
      canvas.width = Math.round(img.width * finalScale)
      canvas.height = Math.round(img.height * finalScale)
      
      // 使用高质量缩放
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // 绘制放大的图片
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      // 应用图像增强滤镜
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const enhanced = applyEnhancement(imageData, options.denoiseLevel)
      ctx.putImageData(enhanced, 0, 0)
      
      // 转换为 Blob 并添加 DPI 元数据
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            // 如果选择保持原始 DPI，则不添加 DPI 元数据
            if (targetDPI === 0) {
              resolve({ url: URL.createObjectURL(blob), size: blob.size })
            } else {
              // 为 PNG 添加 DPI 元数据
              const blobWithDPI = await addDPIMetadata(blob, targetDPI)
              resolve({ url: URL.createObjectURL(blobWithDPI), size: blobWithDPI.size })
            }
          } catch (error) {
            // 如果添加元数据失败，仍然返回原始 blob
            console.warn('添加 DPI 元数据失败，使用原始图片', error)
            resolve({ url: URL.createObjectURL(blob), size: blob.size })
          }
        } else {
          reject(new Error('无法生成图片'))
        }
      }, 'image/png', 0.95)
    }
    
    img.onerror = () => reject(new Error('图片加载失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 为 PNG 添加 DPI 元数据（pHYs chunk）
 */
async function addDPIMetadata(blob: Blob, dpi: number): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const view = new Uint8Array(arrayBuffer)
  
  // PNG 文件签名
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  
  // 验证是否为 PNG 文件
  for (let i = 0; i < pngSignature.length; i++) {
    if (view[i] !== pngSignature[i]) {
      throw new Error('不是有效的 PNG 文件')
    }
  }
  
  // 查找 IHDR chunk 的位置（PNG 文件结构：8字节签名 + IHDR chunk）
  const ihdrEnd = 8 + 4 + 4 + 13 + 4 // 签名 + length + type + data + crc
  
  // 创建 pHYs chunk
  // DPI 转换为每米像素数：dpi * 39.3701（1英寸 = 0.0254米）
  const pixelsPerMeter = Math.round(dpi * 39.3701)
  
  const physChunk = createPHYsChunk(pixelsPerMeter, pixelsPerMeter)
  
  // 组合：PNG签名 + IHDR + pHYs + 剩余数据
  const result = new Uint8Array(view.length + physChunk.length)
  result.set(view.slice(0, ihdrEnd), 0)
  result.set(physChunk, ihdrEnd)
  result.set(view.slice(ihdrEnd), ihdrEnd + physChunk.length)
  
  return new Blob([result], { type: 'image/png' })
}

/**
 * 创建 PNG pHYs chunk
 */
function createPHYsChunk(xPixelsPerMeter: number, yPixelsPerMeter: number): Uint8Array {
  const chunk = new Uint8Array(21) // 4(length) + 4(type) + 9(data) + 4(crc)
  const view = new DataView(chunk.buffer)
  
  // Chunk length (9 bytes)
  view.setUint32(0, 9, false)
  
  // Chunk type "pHYs"
  chunk[4] = 112  // 'p'
  chunk[5] = 72   // 'H'
  chunk[6] = 89   // 'Y'
  chunk[7] = 115  // 's'
  
  // Pixels per unit, X axis (4 bytes)
  view.setUint32(8, xPixelsPerMeter, false)
  
  // Pixels per unit, Y axis (4 bytes)
  view.setUint32(12, yPixelsPerMeter, false)
  
  // Unit specifier (1 byte): 1 = meter
  chunk[16] = 1
  
  // CRC (4 bytes)
  const crc = calculateCRC(chunk.slice(4, 17))
  view.setUint32(17, crc, false)
  
  return chunk
}

/**
 * 计算 CRC32 校验和
 */
function calculateCRC(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * 应用图像增强滤镜（改进版）
 */
function applyEnhancement(
  imageData: ImageData,
  denoiseLevel: 'none' | 'light' | 'medium' | 'heavy'
): ImageData {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  
  // 如果选择"不变"，直接返回原图数据
  if (denoiseLevel === 'none') {
    return imageData
  }
  
  // 对比度增强系数
  const contrastStrength = denoiseLevel === 'light' ? 1.15 : denoiseLevel === 'medium' ? 1.25 : 1.35
  
  // 锐化系数
  const sharpenStrength = denoiseLevel === 'light' ? 0.3 : denoiseLevel === 'medium' ? 0.5 : 0.7
  
  // 创建临时数组存储锐化后的数据
  const sharpened = new Uint8ClampedArray(data.length)
  
  // 对每个像素应用增强
  for (let i = 0; i < data.length; i += 4) {
    // 步骤1: 增强对比度
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]
    
    r = Math.min(255, Math.max(0, (r - 128) * contrastStrength + 128))
    g = Math.min(255, Math.max(0, (g - 128) * contrastStrength + 128))
    b = Math.min(255, Math.max(0, (b - 128) * contrastStrength + 128))
    
    sharpened[i] = r
    sharpened[i + 1] = g
    sharpened[i + 2] = b
    sharpened[i + 3] = data[i + 3]  // Alpha 通道不变
  }
  
  // 步骤2: 应用轻微的 Unsharp Mask（反锐化蒙版）锐化
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      
      for (let c = 0; c < 3; c++) {  // RGB 通道
        // 3x3 拉普拉斯算子
        const center = sharpened[idx + c]
        const neighbors = 
          sharpened[((y - 1) * width + x) * 4 + c] +
          sharpened[((y + 1) * width + x) * 4 + c] +
          sharpened[(y * width + x - 1) * 4 + c] +
          sharpened[(y * width + x + 1) * 4 + c]
        
        const sharpened_value = center + sharpenStrength * (center * 4 - neighbors)
        data[idx + c] = Math.min(255, Math.max(0, sharpened_value))
      }
    }
  }
  
  return imageData
}

/**
 * 位图转矢量（使用 potrace）
 */
async function vectorizeImage(file: File, options: ProcessOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // 转换为灰度以便 potrace 处理
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      // 使用 potrace 进行矢量化
      const threshold = options.vectorizePrecision === 'high' ? 128 : 
                       options.vectorizePrecision === 'medium' ? 150 : 180
      
      potrace.trace(imageData, { threshold }, (err: Error | null, svg: string) => {
        if (err) {
          reject(err)
          return
        }
        
        // 将 SVG 字符串转换为 Blob URL
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        resolve(URL.createObjectURL(blob))
      })
    }
    
    img.onerror = () => reject(new Error('图片加载失败'))
    reader.readAsDataURL(file)
  })
}


