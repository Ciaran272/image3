import { useState } from 'react'
import { ImageItem, FailedImage } from '../types'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import './ResultsView.css'

interface ResultsViewProps {
  images: ImageItem[]
  onBackToUpload: () => void
  onBackToProcessing?: () => void
}

export default function ResultsView({ images, onBackToUpload, onBackToProcessing }: ResultsViewProps) {
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [checkedImages, setCheckedImages] = useState<Set<string>>(new Set())

  const successImages = images.filter(img => img.status === 'completed')
  const failedImages: FailedImage[] = images
    .filter(img => img.status === 'failed')
    .map(img => ({
      id: img.id,
      filename: img.file.name,
      reason: img.error || '未知错误'
    }))

  const handleDownloadSingle = async (image: ImageItem, format: 'svg' | 'png') => {
    if (!image.result) return
    
    const url = format === 'svg' ? image.result.svgUrl : image.result.pngUrl
    if (!url) return
    
    const response = await fetch(url)
    const blob = await response.blob()
    const ext = format === 'svg' ? '.svg' : '.png'
    const filename = image.file.name.replace(/\.[^/.]+$/, '') + `_processed${ext}`
    saveAs(blob, filename)
  }

  const handleDownloadAll = async () => {
    const zip = new JSZip()
    
    for (const image of successImages) {
      if (!image.result) continue
      
      const basename = image.file.name.replace(/\.[^/.]+$/, '')
      
      if (image.result.svgUrl) {
        const response = await fetch(image.result.svgUrl)
        const blob = await response.blob()
        zip.file(`${basename}.svg`, blob)
      }
      
      if (image.result.pngUrl) {
        const response = await fetch(image.result.pngUrl)
        const blob = await response.blob()
        zip.file(`${basename}.png`, blob)
      }
    }
    
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `processed_images_${Date.now()}.zip`)
  }

  // 处理勾选/取消勾选
  const handleToggleCheck = (imageId: string) => {
    setCheckedImages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  // 全选/取消全选
  const handleToggleAll = () => {
    if (checkedImages.size === successImages.length) {
      setCheckedImages(new Set())
    } else {
      setCheckedImages(new Set(successImages.map(img => img.id)))
    }
  }

  // 下载勾选的 PNG 图片（使用 File System Access API）
  const handleDownloadCheckedPNG = async () => {
    const checkedSuccessImages = successImages.filter(img => checkedImages.has(img.id))
    
    if (checkedSuccessImages.length === 0) {
      alert('请先勾选要下载的图片')
      return
    }

    try {
      // 检查浏览器是否支持 File System Access API
      if ('showDirectoryPicker' in window) {
        // 使用新 API 让用户选择文件夹
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        })
        
        console.log(`开始下载 ${checkedSuccessImages.length} 张 PNG 图片到自定义文件夹...`)
        
        for (const image of checkedSuccessImages) {
          if (!image.result?.pngUrl) continue
          
          const response = await fetch(image.result.pngUrl)
          const blob = await response.blob()
          const filename = image.file.name.replace(/\.[^/.]+$/, '') + '_processed.png'
          
          // 创建文件并写入
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
        }
        
        alert(`成功下载 ${checkedSuccessImages.length} 张 PNG 图片！`)
      } else {
        // 不支持 API，使用传统方式（逐个下载）
        console.log('浏览器不支持文件夹选择，使用逐个下载方式')
        
        for (const image of checkedSuccessImages) {
          if (!image.result?.pngUrl) continue
          
          const response = await fetch(image.result.pngUrl)
          const blob = await response.blob()
          const filename = image.file.name.replace(/\.[^/.]+$/, '') + '_processed.png'
          saveAs(blob, filename)
          
          // 添加延迟避免浏览器阻止多个下载
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        alert(`已触发 ${checkedSuccessImages.length} 个下载，请在浏览器下载栏查看`)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('用户取消了文件夹选择')
      } else {
        console.error('下载失败:', error)
        alert('下载失败，请重试')
      }
    }
  }

  return (
    <div className="results-view">
      <div className="results-header">
        <div className="results-header-actions">
          <button 
            className="select-all-button" 
            onClick={handleToggleAll}
          >
            {checkedImages.size === successImages.length ? '取消全选' : '全选成功图片'}
          </button>
          <button 
            className="download-png-button" 
            onClick={handleDownloadCheckedPNG}
            disabled={checkedImages.size === 0}
          >
            📥 下载选中 PNG ({checkedImages.size})
          </button>
          {onBackToProcessing && (
            <button className="back-to-processing-button" onClick={onBackToProcessing}>
              🔍 查看处理详情
            </button>
          )}
          <button className="download-all-button" onClick={handleDownloadAll}>
            📦 下载全部结果
          </button>
          <button className="back-button" onClick={onBackToUpload}>
            ← 返回上传页
          </button>
        </div>
      </div>

      {failedImages.length > 0 && (
        <div className="failed-section">
          <h3>处理失败</h3>
          <div className="failed-list">
            {failedImages.map(img => (
              <div key={img.id} className="failed-item">
                <span className="failed-icon">✗</span>
                <span className="failed-name">{img.filename}</span>
                <span className="failed-reason">{img.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="results-grid">
        {successImages.map(image => (
          <div 
            key={image.id} 
            className={`result-card ${checkedImages.has(image.id) ? 'checked' : ''}`}
            onClick={() => setSelectedImage(image)}
          >
            <div className="result-preview">
              {/* 勾选框 */}
              <div 
                className="checkbox-container"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleCheck(image.id)
                }}
              >
                <input 
                  type="checkbox"
                  checked={checkedImages.has(image.id)}
                  onChange={() => {}}
                  className="image-checkbox"
                />
              </div>
              
              <img 
                src={image.result?.pngUrl || image.result?.svgUrl || image.originalUrl} 
                alt={image.file.name} 
              />
              <div className="result-overlay">
                <button className="view-button">🔍 查看详情</button>
              </div>
            </div>
            
            <div className="result-info">
              <h4>{image.file.name}</h4>
              <p>
                处理时间: {((image.result?.processingTime || 0) / 1000).toFixed(1)}s
                {(() => {
                  const originalSizeMB = (image.file.size / 1024 / 1024)
                  const resultSize = image.result?.pngSize
                  if (resultSize != null) {
                    const resultSizeMB = resultSize / 1024 / 1024
                    return ` | 大小: ${originalSizeMB.toFixed(2)}MB → ${resultSizeMB.toFixed(2)}MB`
                  }
                  return ''
                })()}
              </p>
              
              <div className="download-buttons">
                {image.result?.svgUrl && (
                  <button 
                    className="mini-download-btn svg"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadSingle(image, 'svg')
                    }}
                  >
                    SVG
                  </button>
                )}
                {image.result?.pngUrl && (
                  <button 
                    className="mini-download-btn png"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadSingle(image, 'png')
                    }}
                  >
                    PNG
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>
              ×
            </button>
            
            <h3>{selectedImage.file.name}</h3>
            
            <div className="compare-toggle">
              <button 
                className={!compareMode ? 'active' : ''}
                onClick={() => setCompareMode(false)}
              >
                处理后
              </button>
              <button 
                className={compareMode ? 'active' : ''}
                onClick={() => setCompareMode(true)}
              >
                对比查看
              </button>
            </div>
            
            {!compareMode ? (
              <div className="single-view">
                <img 
                  src={selectedImage.result?.pngUrl || selectedImage.result?.svgUrl || selectedImage.originalUrl}
                  alt="处理后"
                />
              </div>
            ) : (
              <div className="compare-view">
                <div className="compare-item">
                  <h4>原图</h4>
                  <img src={selectedImage.originalUrl} alt="原图" />
                </div>
                <div className="compare-divider">→</div>
                <div className="compare-item">
                  <h4>处理后</h4>
                  <img 
                    src={selectedImage.result?.pngUrl || selectedImage.result?.svgUrl || selectedImage.originalUrl}
                    alt="处理后"
                  />
                </div>
              </div>
            )}
            
            <div className="modal-actions">
              {selectedImage.result?.svgUrl && (
                <button 
                  className="modal-download-btn"
                  onClick={() => handleDownloadSingle(selectedImage, 'svg')}
                >
                  下载 SVG
                </button>
              )}
              {selectedImage.result?.pngUrl && (
                <button 
                  className="modal-download-btn"
                  onClick={() => handleDownloadSingle(selectedImage, 'png')}
                >
                  下载 PNG
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

