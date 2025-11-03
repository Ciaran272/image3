/**
 * AI 超分辨率模块
 * 升级至 upscaler + @upscalerjs/esrgan-medium
 */

import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import Upscaler from 'upscaler'
import type { ModelDefinition, UpscalerOptions } from 'upscaler'
import ModelX2 from '@upscalerjs/esrgan-medium/2x'
import ModelX3 from '@upscalerjs/esrgan-medium/3x'
import ModelX4 from '@upscalerjs/esrgan-medium/4x'

let upscalerInstance: InstanceType<typeof Upscaler> | null = null
let backendReady = false
let currentScale: SupportedScale | null = null
let desiredBackend: 'webgl' | 'cpu' = 'webgl'
let currentBackend: 'webgl' | 'cpu' | null = null

type SupportedScale = 2 | 3 | 4

const DEFAULT_SCALE: SupportedScale = 2

const MODEL_MAP: Record<SupportedScale, ModelDefinition> = {
  2: ModelX2,
  3: ModelX3,
  4: ModelX4
}

async function ensureBackend() {
  if (backendReady && currentBackend === desiredBackend && tf.getBackend() === desiredBackend) {
    return
  }

  try {
    if (tf.getBackend() !== desiredBackend) {
      console.log(`正在切换 TensorFlow.js 后端到 ${desiredBackend}...`)
      await tf.setBackend(desiredBackend)
    }
    await tf.ready()
    backendReady = true
    currentBackend = tf.getBackend() === 'webgl' ? 'webgl' : 'cpu'
    console.log('TensorFlow.js 后端就绪:', tf.getBackend())
  } catch (error) {
    if (desiredBackend === 'webgl') {
      console.warn('WebGL 后端初始化失败，降级至 CPU，性能可能受影响', error)
      desiredBackend = 'cpu'
      await tf.setBackend('cpu')
      await tf.ready()
      backendReady = true
      currentBackend = 'cpu'
      console.log('TensorFlow.js 后端就绪:', tf.getBackend())
    } else {
      throw error
    }
  }
}

async function getUpscaler(scale: SupportedScale): Promise<InstanceType<typeof Upscaler>> {
  if (!upscalerInstance || currentScale !== scale) {
    await ensureBackend()
    console.log(`正在初始化 AI 超分辨率模型 (scale=${scale})...`)

    const options: UpscalerOptions = {
      model: MODEL_MAP[scale],
      warmupSizes: [128]
    }

    if (upscalerInstance) {
      try {
        await upscalerInstance.dispose()
      } catch (disposeError) {
        console.warn('释放旧模型失败，将继续使用新模型', disposeError)
      }
    }

    upscalerInstance = new Upscaler(options)
    currentScale = scale
  }

  return upscalerInstance
}

export async function aiUpscale(
  imageFile: File,
  scale: number = 2,
  onProgress?: (progress: number) => void
): Promise<string> {
  const targetScale = normalizeScale(scale)
  return performUpscale(imageFile, targetScale, onProgress)
}

async function performUpscale(
  imageFile: File,
  targetScale: SupportedScale,
  onProgress?: (progress: number) => void,
  allowFallback = true
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
    const upscaler = await getUpscaler(targetScale)
    if (onProgress) onProgress(20)

    console.log('步骤2: 加载图片...')
    const img = await loadImage(imageFile)
    console.log('图片尺寸:', `${img.width} × ${img.height}`)
    if (onProgress) onProgress(30)

    if (img.width > 2000 || img.height > 2000) {
      console.warn(`⚠️ 图片尺寸较大 (${img.width}×${img.height})，AI处理可能较慢或失败`)
      console.warn('建议：使用更小的图片或降低放大倍数')
    }

    console.log(`步骤3: AI 超分辨率处理（放大 ${targetScale}x）...`)
    console.log('这可能需要 10-30 秒，请耐心等待...')

    await tf.nextFrame()

    const result = await upscaler.upscale(img, {
      output: 'base64',
      patchSize: 64,
      padding: 2
    })

    console.log('✅ AI 超分辨率处理完成！')
    if (onProgress) onProgress(100)

    return result
  } catch (error) {
    const originalMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ AI 超分失败，详细错误:', error)
    console.error('错误类型:', error instanceof Error ? error.name : typeof error)
    console.error('错误信息:', originalMessage)

    if (allowFallback && isWebGLError(error) && currentBackend !== 'cpu') {
      if (typeof window !== 'undefined') {
        const shouldContinue = window.confirm('⚠️ 浏览器显卡资源不足，是否切换到 CPU 模式继续处理？（速度会明显变慢）')
        if (!shouldContinue) {
          const abortError = new Error('用户取消处理：CPU 模式未启用')
          ;(abortError as any).userAborted = true
          throw abortError
        }
      }
      console.warn('检测到 WebGL 故障，尝试切换到 CPU 后端重新处理…')
      await degradeToCPU()
      if (onProgress) onProgress(10)
      return performUpscale(imageFile, targetScale, onProgress, false)
    }

    const failedError = new Error(`AI 超分失败: ${translateErrorMessage(originalMessage)}`)
    ;(failedError as any).skipImage = true
    throw failedError
  }
}

function normalizeScale(scale: number): SupportedScale {
  if (MODEL_MAP[scale as SupportedScale]) {
    return scale as SupportedScale
  }

  console.warn(`不支持的超分倍数 ${scale}x，自动改为 ${DEFAULT_SCALE}x`)
  return DEFAULT_SCALE
}

async function resetUpscaler() {
  if (upscalerInstance) {
    try {
      await upscalerInstance.dispose()
    } catch (err) {
      console.warn('释放 Upscaler 实例失败', err)
    }
    upscalerInstance = null
  }
  currentScale = null
}

async function degradeToCPU() {
  desiredBackend = 'cpu'
  backendReady = false
  await resetUpscaler()
}

function isWebGLError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = `${error.message} ${error.name}`.toLowerCase()
  return message.includes('webgl') || message.includes('shader') || message.includes('compile') || message.includes('linkprogram')
}

function translateErrorMessage(message: string): string {
  if (!message) return '未知错误'
  if (message.includes('Set maximum size exceeded')) {
    return '超出设置最大尺寸'
  }
  return message
}

export async function resetAIBackend() {
  desiredBackend = 'webgl'
  backendReady = false
  currentBackend = null
  await resetUpscaler()
  try {
    tf.engine().disposeVariables()
  } catch (err) {
    console.warn('清理 TensorFlow 变量失败', err)
  }
  try {
    const backend = tf.backend()
    if (backend && typeof (backend as any).dispose === 'function') {
      ;(backend as any).dispose()
    }
  } catch (err) {
    console.warn('释放 TensorFlow Backend 失败', err)
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

