import { ImageItem, ProcessResult } from '../types'
import { processImage } from './imageProcessor'

export interface QueueCallbacks {
  onImageStart: (id: string) => void
  onImageProgress: (id: string, progress: number) => void
  onImageComplete: (id: string, result: ProcessResult) => void
  onImageError: (id: string, error: string, meta?: { userAborted?: boolean; skip?: boolean }) => void
  onQueueComplete: () => void
  onQueueAborted?: () => void
}

/**
 * 批量处理队列（串行处理）
 */
export class ProcessingQueue {
  private queue: ImageItem[] = []
  private isProcessing = false
  private currentIndex = 0
  private shouldStop = false
  
  constructor(private callbacks: QueueCallbacks) {}
  
  /**
   * 添加图片到队列
   */
  addImages(images: ImageItem[]) {
    this.queue = [...images]
    this.currentIndex = 0
  }
  
  /**
   * 开始处理队列
   */
  async start() {
    if (this.isProcessing) {
      console.warn('队列正在处理中')
      return
    }
    
    this.isProcessing = true
    this.currentIndex = 0
    this.shouldStop = false
    
    // 串行处理每张图片
    for (let i = 0; i < this.queue.length; i++) {
      if (this.shouldStop) break
      this.currentIndex = i
      const image = this.queue[i]
      
      try {
        // 通知开始处理
        this.callbacks.onImageStart(image.id)
        
        // 处理图片
        const result = await processImage(image, (progress) => {
          this.callbacks.onImageProgress(image.id, progress)
        })
        
        // 通知处理完成
        this.callbacks.onImageComplete(image.id, result)
        
      } catch (error) {
        // 处理失败，跳过继续下一张
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        console.error(`处理图片 ${image.file.name} 失败:`, error)
        const userAborted = !!(error as any)?.userAborted
        const skip = !!(error as any)?.skipImage
        this.callbacks.onImageError(image.id, errorMessage, { userAborted, skip })
        if (userAborted) {
          this.shouldStop = true
          break
        }
      }
      
      // 添加小延迟避免浏览器卡死
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.isProcessing = false
    console.log('=== 所有图片处理完成 ===')
    console.log(`成功: ${this.queue.filter(img => img.status === 'completed').length}`)
    console.log(`失败: ${this.queue.filter(img => img.status === 'failed').length}`)
    if (this.shouldStop) {
      this.callbacks.onQueueAborted?.()
    } else {
      this.callbacks.onQueueComplete()
    }
  }
  
  /**
   * 停止处理
   */
  stop() {
    this.shouldStop = true
    this.isProcessing = false
  }
  
  /**
   * 获取当前进度
   */
  getProgress() {
    return {
      current: this.currentIndex,
      total: this.queue.length
    }
  }
}

