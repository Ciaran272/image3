import { useState, useCallback, useRef } from 'react'
import Header from './components/Header'
import UploadZone from './components/UploadZone'
import ImageList from './components/ImageList'
import ProcessingPanel from './components/ProcessingPanel'
import ResultsView from './components/ResultsView'
import { ImageItem, ProcessingStats, ProcessOptions } from './types'
import { ProcessingQueue, QueueCallbacks } from './utils/processingQueue'
import './App.css'

type AppView = 'upload' | 'processing' | 'results';

function App() {
  const [view, setView] = useState<AppView>('upload')
  const [images, setImages] = useState<ImageItem[]>([])
  const [stats, setStats] = useState<ProcessingStats>({
    total: 0,
    completed: 0,
    failed: 0,
    currentIndex: 0
  })
  
  const queueRef = useRef<ProcessingQueue | null>(null)

  const handleResetApp = useCallback(async () => {
    // 停止队列
    if (queueRef.current) {
      try {
        queueRef.current.stop?.()
      } catch (err) {
        console.warn('停止处理队列失败', err)
      }
    }

    // 清除所有临时 URL
    images.forEach(img => {
      URL.revokeObjectURL(img.originalUrl)
      if (img.result?.svgUrl) URL.revokeObjectURL(img.result.svgUrl)
      if (img.result?.pngUrl) URL.revokeObjectURL(img.result.pngUrl)
    })

    // 清空状态
    setImages([])
    setStats({
      total: 0,
      completed: 0,
      failed: 0,
      currentIndex: 0
    })
    setView('upload')

    try {
      // 懒加载 AI 后端重置函数
      const { resetAIBackend } = await import('./utils/aiUpscale')
      await resetAIBackend()
    } catch (err) {
      console.warn('重置 AI 后端失败', err)
    }

    if (typeof window !== 'undefined') {
      window.location.href = window.location.href.replace(/#.*$/, '')
    }
  }, [images])

  const handleFilesSelected = useCallback((files: File[]) => {
    const defaultOptions: ProcessOptions = {
      // 基础设置
      upscaleFactor: 2,
      denoiseLevel: 'none',
      outputFormat: 'both',
      dpi: 'original',
      
      // 高级模式（默认只启用基础增强）
      enableBasicEnhancement: true,   // 基础功能默认开启
      enableAIUpscale: false,
      enableVectorize: false,
      
      // 辅助选项
      vectorizePrecision: 'medium'
    }

    const newImages: ImageItem[] = files.map((file, index) => ({
      id: `img-${Date.now()}-${index}`,
      file,
      originalUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      options: { ...defaultOptions }
    }))

    setImages(prev => [...prev, ...newImages])
    setView('upload')
  }, [])

  const handleUpdateOptions = useCallback((id: string, options: Partial<ProcessOptions>) => {
    setImages(prev => prev.map(img => 
      img.id === id 
        ? { ...img, options: { ...img.options, ...options } }
        : img
    ))
  }, [])

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.originalUrl)
        if (img.result?.svgUrl) URL.revokeObjectURL(img.result.svgUrl)
        if (img.result?.pngUrl) URL.revokeObjectURL(img.result.pngUrl)
      }
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const handleStartProcessing = useCallback(() => {
    if (images.length === 0) return
    setView('processing')
    setStats({
      total: images.length,
      completed: 0,
      failed: 0,
      currentIndex: 0,
      startTime: Date.now()
    })
    
    // 创建处理队列回调
    const callbacks: QueueCallbacks = {
      onImageStart: (id) => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, status: 'processing' as const, progress: 0 } : img
        ))
      },
      
      onImageProgress: (id, progress) => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, progress: Math.round(progress) } : img
        ))
      },
      
      onImageComplete: (id, result) => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, status: 'completed' as const, progress: 100, result } : img
        ))
        setStats(prev => ({
          ...prev,
          completed: prev.completed + 1,
          currentIndex: prev.currentIndex + 1
        }))
      },
      
      onImageError: (id, error, meta) => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, status: 'failed' as const, error } : img
        ))
        setStats(prev => ({
          ...prev,
          failed: prev.failed + 1,
          currentIndex: Math.min(prev.currentIndex + 1, images.length)
        }))

        if (meta?.userAborted) {
          if (typeof window !== 'undefined') {
            window.alert('处理已停止：用户取消了 CPU 模式放大。')
          }
        } else if (!meta?.skip) {
          if (typeof window !== 'undefined') {
            window.alert(`处理失败：${error}`)
          }
        }
      },
      
      onQueueComplete: () => {
        setTimeout(() => {
          setView('results')
        }, 1000)
      },

      onQueueAborted: () => {
        setTimeout(() => {
          setView('upload')
        }, 300)
      }
    }
    
    // 创建并启动队列
    const queue = new ProcessingQueue(callbacks)
    queueRef.current = queue
    queue.addImages(images)
    queue.start()
  }, [images])

  const handleBackToUpload = useCallback(() => {
    handleResetApp()
  }, [handleResetApp])

  const handleViewResults = useCallback(() => {
    setView('results')
  }, [])

  const handleBackToProcessing = useCallback(() => {
    setView('processing')
  }, [])

  return (
    <div className="app">
      {view === 'upload' && images.length === 0 && <Header />}
      
      <main className="main-content">
        {view === 'upload' && (
          <>
            {images.length === 0 ? (
              <UploadZone onFilesSelected={handleFilesSelected} />
            ) : (
              <ImageList
                images={images}
                onUpdateOptions={handleUpdateOptions}
                onRemoveImage={handleRemoveImage}
                onStartProcessing={handleStartProcessing}
                onAddMore={handleFilesSelected}
              />
            )}
          </>
        )}

        {view === 'processing' && (
          <ProcessingPanel
            images={images}
            stats={stats}
            onComplete={handleViewResults}
          />
        )}

        {view === 'results' && (
          <ResultsView
            images={images}
            onBackToUpload={handleBackToUpload}
            onBackToProcessing={handleBackToProcessing}
          />
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <button className="reset-button" onClick={handleResetApp}>
            清除缓存并刷新
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App
