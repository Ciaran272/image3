import { useState, useEffect } from 'react'
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
  
  // JPEG 转换相关状态
  const [jpegModalOpen, setJpegModalOpen] = useState(false)
  const [jpegQuality, setJpegQuality] = useState(90)
  const [jpegPreviews, setJpegPreviews] = useState<Map<string, number>>(new Map())
  const [isConverting, setIsConverting] = useState(false)

  const successImages = images.filter(img => img.status === 'completed')
  const failedImages: FailedImage[] = images
    .filter(img => img.status === 'failed')
    .map(img => ({
      id: img.id,
      filename: img.file.name,
      reason: img.error || '未知错误'
    }))
  const successImagesWithPNG = successImages.filter(img => !!img.result?.pngUrl)
  const hasAnyPNGResult = successImagesWithPNG.length > 0
  const checkedImagesWithPNG = successImagesWithPNG.filter(img => checkedImages.has(img.id))
  const checkedPNGCount = checkedImagesWithPNG.length

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
    const checkedSuccessImages = successImagesWithPNG.filter(img => checkedImages.has(img.id))
    
    if (checkedSuccessImages.length === 0) {
      alert('选中的图片中没有可用的 PNG 结果')
      return
    }

    try {
      // 检查浏览器是否支持 File System Access API
      if ('showDirectoryPicker' in window) {
        // 使用新 API 让用户选择文件夹
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        })
        
        for (const image of checkedSuccessImages) {
          const response = await fetch(image.result!.pngUrl!)
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
        for (const image of checkedSuccessImages) {
          const response = await fetch(image.result!.pngUrl!)
          const blob = await response.blob()
          const filename = image.file.name.replace(/\.[^/.]+$/, '') + '_processed.png'
          saveAs(blob, filename)
          
          // 添加延迟避免浏览器阻止多个下载
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        alert(`已触发 ${checkedSuccessImages.length} 个下载，请在浏览器下载栏查看`)
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('下载失败:', error)
        alert('下载失败，请重试')
      }
    }
  }

  // 从 PNG 中读取 DPI
  const readPNGDPI = async (pngUrl: string): Promise<number | null> => {
    try {
      const response = await fetch(pngUrl)
      const arrayBuffer = await response.arrayBuffer()
      const view = new Uint8Array(arrayBuffer)
      
      // 验证 PNG 签名
      if (view[0] !== 137 || view[1] !== 80 || view[2] !== 78 || view[3] !== 71) {
        return null
      }
      
      // 查找 pHYs chunk
      let offset = 8  // 跳过 PNG 签名
      
      while (offset < view.length - 12) {
        const chunkLength = (view[offset] << 24) | (view[offset + 1] << 16) | (view[offset + 2] << 8) | view[offset + 3]
        const chunkType = String.fromCharCode(view[offset + 4], view[offset + 5], view[offset + 6], view[offset + 7])
        
        if (chunkType === 'pHYs') {
          // 读取像素每米
          const pixelsPerMeterX = (view[offset + 8] << 24) | (view[offset + 9] << 16) | (view[offset + 10] << 8) | view[offset + 11]
          const unit = view[offset + 16]
          
          if (unit === 1) {  // 单位是米
            // 转换为 DPI：pixelsPerMeter / 39.3701
            const dpi = Math.round(pixelsPerMeterX / 39.3701)
            return dpi
          }
        }
        
        // IEND 表示文件结束
        if (chunkType === 'IEND') {
          break
        }
        
        // 移动到下一个 chunk
        offset += 12 + chunkLength
      }
      
      return null
    } catch (error) {
      console.warn('读取 PNG DPI 失败:', error)
      return null
    }
  }

  // PNG 转 JPEG 核心函数
  const convertPNGToJPEG = async (
    pngUrl: string,
    quality: number,
    dpi?: number  // DPI 参数（可选）
  ): Promise<{ blob: Blob; size: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'))
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        
        // 填充白色背景（JPEG 不支持透明）
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        
        // 导出为 JPEG
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              // 如果指定了 DPI，则添加 DPI 元数据
              if (dpi && dpi > 0) {
                const blobWithDPI = await addJPEGDPIMetadata(blob, dpi)
                resolve({ blob: blobWithDPI, size: blobWithDPI.size })
              } else {
                resolve({ blob, size: blob.size })
              }
            } catch (error) {
              console.warn('添加 JPEG DPI 元数据失败，使用原始图片', error)
              resolve({ blob, size: blob.size })
            }
          } else {
            reject(new Error('转换失败'))
          }
        }, 'image/jpeg', quality / 100)
      }
      
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = pngUrl
    })
  }

  // 为 JPEG 添加 DPI 元数据（JFIF APP0 标记）
  const addJPEGDPIMetadata = async (blob: Blob, dpi: number): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer()
    const view = new Uint8Array(arrayBuffer)
    
    // JPEG 文件以 SOI (Start of Image) 标记开始：0xFF 0xD8
    if (view[0] !== 0xFF || view[1] !== 0xD8) {
      throw new Error('不是有效的 JPEG 文件')
    }
    
    // 查找 APP0 (JFIF) 标记的位置
    let offset = 2  // 跳过 SOI
    let hasJFIF = false
    let jfifOffset = -1
    
    // 查找现有的 JFIF APP0 标记
    while (offset < view.length - 1) {
      if (view[offset] === 0xFF) {
        const marker = view[offset + 1]
        
        if (marker === 0xE0) {  // APP0 标记
          // 检查是否为 JFIF（验证标识符，不需要段长度）
          const identifier = String.fromCharCode(
            view[offset + 4], view[offset + 5], view[offset + 6], 
            view[offset + 7], view[offset + 8]
          )
          
          if (identifier === 'JFIF\0') {
            hasJFIF = true
            jfifOffset = offset
            break
          }
        }
        
        // 跳过此段
        if (marker >= 0xD0 && marker <= 0xD9) {
          // 独立标记，无长度字段
          offset += 2
        } else if (marker !== 0x00 && marker !== 0xFF) {
          const segmentLength = (view[offset + 2] << 8) | view[offset + 3]
          offset += 2 + segmentLength
        } else {
          offset += 2
        }
      } else {
        offset++
      }
    }
    
    // 创建新的 JFIF APP0 段（包含 DPI 信息）
    const createJFIFSegment = (dpi: number): Uint8Array => {
      const segment = new Uint8Array(18)
      const dv = new DataView(segment.buffer)
      
      // APP0 标记
      dv.setUint8(0, 0xFF)
      dv.setUint8(1, 0xE0)
      
      // 段长度（16 字节，不包括标记本身）
      dv.setUint16(2, 16, false)
      
      // JFIF 标识符
      segment[4] = 0x4A  // 'J'
      segment[5] = 0x46  // 'F'
      segment[6] = 0x49  // 'I'
      segment[7] = 0x46  // 'F'
      segment[8] = 0x00  // 终止符
      
      // JFIF 版本 (1.01)
      dv.setUint8(9, 1)
      dv.setUint8(10, 1)
      
      // 密度单位：1 = DPI (dots per inch)
      dv.setUint8(11, 1)
      
      // X 密度（DPI）
      dv.setUint16(12, dpi, false)
      
      // Y 密度（DPI）
      dv.setUint16(14, dpi, false)
      
      // 缩略图宽度和高度（0 = 无缩略图）
      dv.setUint8(16, 0)
      dv.setUint8(17, 0)
      
      return segment
    }
    
    const jfifSegment = createJFIFSegment(dpi)
    
    if (hasJFIF && jfifOffset >= 0) {
      // 替换现有的 JFIF 段
      const oldSegmentLength = (view[jfifOffset + 2] << 8) | view[jfifOffset + 3]
      const result = new Uint8Array(
        view.length - oldSegmentLength - 2 + jfifSegment.length
      )
      
      result.set(view.slice(0, jfifOffset), 0)
      result.set(jfifSegment, jfifOffset)
      result.set(
        view.slice(jfifOffset + 2 + oldSegmentLength),
        jfifOffset + jfifSegment.length
      )
      
      return new Blob([result], { type: 'image/jpeg' })
    } else {
      // 在 SOI 后插入新的 JFIF 段
      const result = new Uint8Array(view.length + jfifSegment.length)
      result.set(view.slice(0, 2), 0)  // SOI
      result.set(jfifSegment, 2)
      result.set(view.slice(2), 2 + jfifSegment.length)
      
      return new Blob([result], { type: 'image/jpeg' })
    }
  }

  // 实时更新 JPEG 预览大小
  const updateJpegPreviews = async (quality: number) => {
    const checkedSuccessImages = successImages.filter(img => 
      checkedImages.has(img.id) && img.result?.pngUrl
    )
    
    const newPreviews = new Map<string, number>()
    
    for (const image of checkedSuccessImages) {
      try {
        // 获取用户设置的 DPI
        let dpi: number | undefined
        
        if (image.options.dpi === 'original') {
          // 选择"不变"时，尝试从 PNG 中读取 DPI
          const pngDpi = await readPNGDPI(image.result!.pngUrl!)
          dpi = pngDpi || undefined
        } else {
          dpi = Number(image.options.dpi)
        }
        
        const { size } = await convertPNGToJPEG(image.result!.pngUrl!, quality, dpi)
        newPreviews.set(image.id, size)
      } catch (error) {
        console.error(`预览失败: ${image.file.name}`, error)
      }
    }
    
    setJpegPreviews(newPreviews)
  }

  // 处理质量滑动条变化（带防抖）
  useEffect(() => {
    if (!jpegModalOpen) return
    
    const timer = setTimeout(() => {
      updateJpegPreviews(jpegQuality)
    }, 300) // 300ms 防抖
    
    return () => clearTimeout(timer)
  }, [jpegQuality, jpegModalOpen, checkedImages])

  // 执行批量转换并下载
  const handleConvertAndDownloadJPEG = async () => {
    const checkedSuccessImages = successImages.filter(img => 
      checkedImages.has(img.id) && img.result?.pngUrl
    )
    
    if (checkedSuccessImages.length === 0) {
      alert('请先勾选要转换的图片')
      return
    }
    
    setIsConverting(true)
    
    try {
      if (checkedSuccessImages.length === 1) {
        // 单张图片：直接下载
        const image = checkedSuccessImages[0]
        
        // 获取 DPI
        let dpi: number | undefined
        if (image.options.dpi === 'original') {
          // 选择"不变"时，尝试从 PNG 中读取 DPI
          const pngDpi = await readPNGDPI(image.result!.pngUrl!)
          dpi = pngDpi || undefined
        } else {
          dpi = Number(image.options.dpi)
        }
        
        const { blob } = await convertPNGToJPEG(
          image.result!.pngUrl!, 
          jpegQuality,
          dpi
        )
        
        const filename = image.file.name.replace(/\.[^/.]+$/, '') + '.jpg'
        saveAs(blob, filename)
        
        alert('转换完成！')
      } else {
        // 多张图片：打包为 ZIP
        const zip = new JSZip()
        
        for (const image of checkedSuccessImages) {
          // 获取 DPI
          let dpi: number | undefined
          if (image.options.dpi === 'original') {
            // 选择"不变"时，尝试从 PNG 中读取 DPI
            const pngDpi = await readPNGDPI(image.result!.pngUrl!)
            dpi = pngDpi || undefined
          } else {
            dpi = Number(image.options.dpi)
          }
          
          const { blob } = await convertPNGToJPEG(
            image.result!.pngUrl!, 
            jpegQuality,
            dpi
          )
          
          const filename = image.file.name.replace(/\.[^/.]+$/, '') + '.jpg'
          zip.file(filename, blob)
        }
        
        const content = await zip.generateAsync({ type: 'blob' })
        saveAs(content, `jpeg_images_q${jpegQuality}_${Date.now()}.zip`)
        
        alert(`成功转换并打包 ${checkedSuccessImages.length} 张 JPEG 图片！`)
      }
      
      setJpegModalOpen(false)
    } catch (error) {
      console.error('转换失败:', error)
      alert('转换失败，请重试')
    } finally {
      setIsConverting(false)
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
          {hasAnyPNGResult && (
            <button 
              className="download-png-button" 
              onClick={handleDownloadCheckedPNG}
              disabled={checkedPNGCount === 0}
            >
              📥 下载选中 PNG ({checkedPNGCount})
            </button>
          )}
          {hasAnyPNGResult && (
            <button 
              className="convert-jpeg-button" 
              onClick={() => {
                if (checkedPNGCount === 0) {
                  alert('请先勾选包含 PNG 结果的图片')
                  return
                }
                setJpegModalOpen(true)
                updateJpegPreviews(jpegQuality)
              }}
              disabled={checkedPNGCount === 0}
            >
              🎨 转换为 JPEG ({checkedPNGCount})
            </button>
          )}
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

      {/* JPEG 转换模态框 */}
      {jpegModalOpen && (
        <div className="jpeg-modal-overlay" onClick={() => setJpegModalOpen(false)}>
          <div className="jpeg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setJpegModalOpen(false)}>
              ×
            </button>
            
            <h3>🎨 JPEG 转换</h3>
            
            <p className="modal-info">
              已选中 <strong>{checkedImages.size}</strong> 张图片
            </p>
            
            <div className="quality-control">
              <label>
                <span>质量:</span>
                <span className="quality-value">{jpegQuality}%</span>
              </label>
              <input 
                type="range" 
                min="50" 
                max="100" 
                step="5"
                value={jpegQuality}
                onChange={(e) => setJpegQuality(Number(e.target.value))}
                className="quality-slider"
              />
              <div className="quality-marks">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            
            <div className="preview-sizes">
              <h4>预计文件大小:</h4>
              <div className="size-list">
                {successImages
                  .filter(img => checkedImages.has(img.id))
                  .map(image => {
                    const originalSize = image.result?.pngSize || image.file.size
                    const jpegSize = jpegPreviews.get(image.id)
                    const compression = jpegSize 
                      ? Math.round((1 - jpegSize / originalSize) * 100)
                      : 0
                    
                    return (
                      <div key={image.id} className="size-item">
                        <span className="filename">{image.file.name}</span>
                        <span className="size-change">
                          {(originalSize / 1024 / 1024).toFixed(2)}MB 
                          {' → '}
                          {jpegSize 
                            ? `${(jpegSize / 1024 / 1024).toFixed(2)}MB`
                            : '计算中...'
                          }
                          {jpegSize && (
                            <span className="compression"> (↓{compression}%)</span>
                          )}
                        </span>
                      </div>
                    )
                  })}
              </div>
              
              <div className="total-size">
                <strong>总大小:</strong>
                {(() => {
                  const totalOriginal = successImages
                    .filter(img => checkedImages.has(img.id))
                    .reduce((sum, img) => sum + (img.result?.pngSize || img.file.size), 0)
                  
                  const totalJpeg = Array.from(jpegPreviews.values())
                    .reduce((sum, size) => sum + size, 0)
                  
                  const totalCompression = totalJpeg > 0
                    ? Math.round((1 - totalJpeg / totalOriginal) * 100)
                    : 0
                  
                  return (
                    <>
                      {' '}
                      {(totalOriginal / 1024 / 1024).toFixed(1)}MB 
                      {' → '}
                      {jpegPreviews.size > 0 
                        ? `${(totalJpeg / 1024 / 1024).toFixed(1)}MB`
                        : '计算中...'
                      }
                      {jpegPreviews.size > 0 && (
                        <span className="compression"> (节省 {totalCompression}%)</span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="confirm-button" 
                onClick={handleConvertAndDownloadJPEG}
                disabled={isConverting || jpegPreviews.size === 0}
              >
                {isConverting ? '转换中...' : '开始转换并下载'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

