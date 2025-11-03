import { useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import * as React from 'react'
import { ImageItem, ProcessOptions } from '../types'
import { BasicSettingsRow, PipelineControls } from './GlobalSettings'
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
      upscaleFactor: 2,
      denoiseLevel: 'none',
      outputFormat: 'both',
      dpi: 'original',
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
 
  const showAIWarning = globalOptions.enableAIUpscale
  const showAIMemoryHint = globalOptions.enableAIUpscale && globalOptions.enableBasicEnhancement

  const reminderElements: React.ReactNode[] = []
  if (showAIWarning) {
    reminderElements.push(
      <CSSTransition classNames="reminder-bubble" timeout={240} key="ai-warning" appear>
        <div className="pipeline-warning">
          <span className="pipeline-warning__icon" aria-hidden="true">❗</span>
          <span className="pipeline-warning__text">占用显存，耗时较久（需要显卡/浏览器性能）</span>
        </div>
      </CSSTransition>
    )
  }
  if (showAIMemoryHint) {
    reminderElements.push(
      <CSSTransition classNames="reminder-bubble" timeout={240} key="ai-hint" appear>
        <div className="pipeline-hint">
          <span className="pipeline-hint__icon" aria-hidden="true">⛔</span>
          <span className="pipeline-hint__text">若超出阈值会降级处理</span>
        </div>
      </CSSTransition>
    )
  }

  const pipelineReminders = reminderElements.length > 0 ? reminderElements : null

  // 当新图片添加时，自动应用当前的全局设置
  React.useEffect(() => {
    images.forEach(image => {
      const needsUpdate =
        image.options.upscaleFactor !== globalOptions.upscaleFactor ||
        image.options.denoiseLevel !== globalOptions.denoiseLevel ||
        image.options.outputFormat !== globalOptions.outputFormat ||
        image.options.dpi !== globalOptions.dpi ||
        image.options.enableBasicEnhancement !== globalOptions.enableBasicEnhancement ||
        image.options.enableAIUpscale !== globalOptions.enableAIUpscale ||
        image.options.enableVectorize !== globalOptions.enableVectorize ||
        image.options.vectorizePrecision !== globalOptions.vectorizePrecision

      if (needsUpdate) {
        onUpdateOptions(image.id, {
          upscaleFactor: globalOptions.upscaleFactor,
          denoiseLevel: globalOptions.denoiseLevel,
          outputFormat: globalOptions.outputFormat,
          dpi: globalOptions.dpi,
          enableBasicEnhancement: globalOptions.enableBasicEnhancement,
          enableAIUpscale: globalOptions.enableAIUpscale,
          enableVectorize: globalOptions.enableVectorize,
          vectorizePrecision: globalOptions.vectorizePrecision
        })
      }
    })
  }, [images, globalOptions, onUpdateOptions])

  return (
    <div className="image-list-container">
      <div className="list-header">
        <div className="header-settings-bar">
          <BasicSettingsRow
            options={globalOptions}
            onUpdateOptions={handleGlobalOptionsUpdate}
            variant="compact"
          />
          <PipelineControls
            options={globalOptions}
            onUpdateOptions={handleGlobalOptionsUpdate}
            variant="compact"
            showReminders={false}
          />
        </div>
        <div className="header-actions">
          <label className="add-more-button">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <span>➕ 添加更多</span>
          </label>
          <button className="start-button" onClick={onStartProcessing}>
            ▶️ 开始处理
          </button>
        </div>
      </div>

      <div className="content-layout">
        <div className="image-gallery-wrapper">
          <ImageGallery 
            images={images}
            onRemoveImage={onRemoveImage}
            reminderContent={pipelineReminders}
          />
        </div>
      </div>

    </div>
  )
}

