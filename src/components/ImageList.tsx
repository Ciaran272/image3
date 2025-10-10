import { useState } from 'react'
import * as React from 'react'
import { ImageItem, ProcessOptions } from '../types'
import GlobalSettings from './GlobalSettings'
import ImageGallery from './ImageGallery'
import './ImageList.css'

interface ImageListProps {
  images: ImageItem[]
  onUpdateOptions: (id: string, options: Partial<ProcessOptions>) => void
  onRemoveImage: (id: string) => void
  onStartProcessing: () => void
  onAddMore: (files: File[]) => void
}

export default function ImageList({ 
  images, 
  onUpdateOptions, 
  onRemoveImage, 
  onStartProcessing,
  onAddMore 
}: ImageListProps) {
  // 使用第一张图片的配置作为全局配置，如果没有图片则使用默认配置
  const [globalOptions, setGlobalOptions] = useState<ProcessOptions>(
    images[0]?.options || {
      imageType: 'auto',
      upscaleFactor: 2,
      denoiseLevel: 'medium',
      outputFormat: 'both',
      dpi: 300,
      enableBasicEnhancement: true,
      enableAIUpscale: false,
      enableVectorize: false,
      vectorizePrecision: 'medium'
    }
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onAddMore(files)
    }
  }

  // 更新全局配置，并应用到所有图片
  const handleGlobalOptionsUpdate = (options: Partial<ProcessOptions>) => {
    const newOptions = { ...globalOptions, ...options }
    setGlobalOptions(newOptions)
    
    // 应用到所有图片（包括新添加的）
    images.forEach(image => {
      onUpdateOptions(image.id, options)
    })
  }
  
  // 当新图片添加时，自动应用当前的全局设置
  React.useEffect(() => {
    // 为新添加的图片应用全局设置
    images.forEach(image => {
      // 检查图片的配置是否与全局配置一致，如果不一致则更新
      const needsUpdate = 
        image.options.imageType !== globalOptions.imageType ||
        image.options.enableBasicEnhancement !== globalOptions.enableBasicEnhancement ||
        image.options.enableAIUpscale !== globalOptions.enableAIUpscale ||
        image.options.enableVectorize !== globalOptions.enableVectorize
      
      if (needsUpdate) {
        onUpdateOptions(image.id, {
          imageType: globalOptions.imageType,
          upscaleFactor: globalOptions.upscaleFactor,
          denoiseLevel: globalOptions.denoiseLevel,
          outputFormat: globalOptions.outputFormat,
          dpi: globalOptions.dpi,
          enableBasicEnhancement: globalOptions.enableBasicEnhancement,
          enableAIUpscale: globalOptions.enableAIUpscale,
          enableVectorize: globalOptions.enableVectorize
        })
      }
    })
  }, [images.length]) // 当图片数量变化时触发

  return (
    <div className="image-list-container">
      <div className="list-header">
        <h2>已选择 {images.length} 张图片</h2>
        <div className="header-actions">
          <label className="add-more-button">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <span>+ 添加更多</span>
          </label>
          <button className="start-button" onClick={onStartProcessing}>
            开始处理
          </button>
        </div>
      </div>

      <div className="content-layout">
        {/* 全局设置区（左侧或上方） */}
        <GlobalSettings 
          options={globalOptions}
          onUpdateOptions={handleGlobalOptionsUpdate}
        />

        {/* 图片列表区（右侧或下方） */}
        <ImageGallery 
          images={images}
          onRemoveImage={onRemoveImage}
        />
      </div>
    </div>
  )
}

