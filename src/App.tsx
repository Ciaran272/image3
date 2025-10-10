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

  const handleFilesSelected = useCallback((files: File[]) => {
    const defaultOptions: ProcessOptions = {
      // 图片类型
      imageType: 'auto',  // 默认自动识别
      
      // 基础设置
      upscaleFactor: 2,
      denoiseLevel: 'medium',
      outputFormat: 'both',
      dpi: 300,
      
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
      
      onImageError: (id, error) => {
        setImages(prev => prev.map(img => 
          img.id === id ? { ...img, status: 'failed' as const, error } : img
        ))
        setStats(prev => ({
          ...prev,
          failed: prev.failed + 1,
          currentIndex: prev.currentIndex + 1
        }))
      },
      
      onQueueComplete: () => {
        console.log('队列处理完成，1秒后跳转到结果页面')
        setTimeout(() => {
          console.log('正在跳转到结果页面...')
          setView('results')
        }, 1000)
      }
    }
    
    // 创建并启动队列
    const queue = new ProcessingQueue(callbacks)
    queueRef.current = queue
    queue.addImages(images)
    queue.start()
  }, [images])

  const handleBackToUpload = useCallback(() => {
    // 清理所有 URL
    images.forEach(img => {
      URL.revokeObjectURL(img.originalUrl)
      if (img.result?.svgUrl) URL.revokeObjectURL(img.result.svgUrl)
      if (img.result?.pngUrl) URL.revokeObjectURL(img.result.pngUrl)
    })
    setImages([])
    setView('upload')
  }, [images])

  const handleViewResults = useCallback(() => {
    setView('results')
  }, [])

  const handleBackToProcessing = useCallback(() => {
    setView('processing')
  }, [])

  return (
    <div className="app">
      <Header />
      
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
        <p>© 2025 Image Vectorizer</p>
      </footer>
    </div>
  )
}

export default App
