import { useCallback, useState } from 'react'
import './UploadZone.css'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
}

export default function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    )
    
    if (files.length > 0) {
      onFilesSelected(files)
    }
  }, [onFilesSelected])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onFilesSelected(files)
    }
  }, [onFilesSelected])

  return (
    <div className="upload-zone-container">
      <div 
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="url(#uploadGradient)" strokeWidth="2" strokeDasharray="4 4" />
            <path 
              d="M40 25V55M40 25L30 35M40 25L50 35" 
              stroke="url(#uploadGradient)" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M25 50C25 50 25 60 30 60H50C55 60 55 50 55 50" 
              stroke="url(#uploadGradient)" 
              strokeWidth="3" 
              strokeLinecap="round" 
            />
            <defs>
              <linearGradient id="uploadGradient" x1="0" y1="0" x2="80" y2="80">
                <stop offset="0%" stopColor="#4A90E2" />
                <stop offset="100%" stopColor="#7DD3C0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <h2>上传图片开始处理</h2>
        <p className="upload-description">
          拖拽图片到此处，或点击下方按钮选择文件
        </p>
        
        <label className="upload-button">
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
          <span>选择图片</span>
        </label>
        
        <div className="upload-tips">
          <div className="tip-item">
            <span className="tip-icon">✓</span>
            <span>支持 JPG、PNG、WebP 等格式</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">✓</span>
            <span>支持批量上传处理</span>
          </div>
        </div>
      </div>
    </div>
  )
}

