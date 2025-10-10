import { ImageItem, ProcessingStats } from '../types'
import './ProcessingPanel.css'

interface ProcessingPanelProps {
  images: ImageItem[]
  stats: ProcessingStats
  onComplete: () => void
}

export default function ProcessingPanel({ images, stats, onComplete }: ProcessingPanelProps) {
  
  // 检查是否所有图片都已处理完成
  const isAllComplete = stats.completed + stats.failed >= stats.total && stats.total > 0
  const currentImage = images[stats.currentIndex]
  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
  
  // 计算预计剩余时间
  const getEstimatedTime = () => {
    // 如果已经全部完成
    if (stats.completed + stats.failed >= stats.total) {
      return '即将完成...'
    }
    
    if (!stats.startTime || stats.completed === 0) return '计算中...'
    
    const elapsed = Date.now() - stats.startTime
    const avgTime = elapsed / stats.completed
    const remaining = (stats.total - stats.completed - stats.failed) * avgTime
    
    if (remaining <= 0) return '即将完成...'
    
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    
    if (minutes > 0) {
      return `约 ${minutes} 分 ${seconds} 秒`
    }
    return `约 ${seconds} 秒`
  }

  return (
    <div className="processing-panel">
      <div className="processing-header">
        <h2>{isAllComplete ? '处理已完成！' : '正在处理图片...'}</h2>
        <p className="processing-subtitle">
          {isAllComplete 
            ? '所有图片处理完成，即将跳转到结果页面...' 
            : '请耐心等待，所有处理在浏览器本地完成'}
        </p>
        {isAllComplete && (
          <button 
            className="view-results-button" 
            onClick={onComplete}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              background: 'var(--gradient-3)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
          >
            📊 查看处理结果
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.currentIndex + 1} / {stats.total}</div>
          <div className="stat-label">当前进度</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">已完成</div>
        </div>
        
        <div className="stat-card error">
          <div className="stat-value">{stats.failed}</div>
          <div className="stat-label">失败/跳过</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{getEstimatedTime()}</div>
          <div className="stat-label">预计剩余</div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-header">
          <span>总体进度</span>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentImage && (
        <div className="current-image-section">
          <h3>当前处理</h3>
          <div className="current-image-card">
            <div className="current-image-preview">
              <img src={currentImage.originalUrl} alt={currentImage.file.name} />
            </div>
            <div className="current-image-info">
              <h4>{currentImage.file.name}</h4>
              <div className="processing-steps">
                <div className="step active">
                  <div className="step-icon">
                    <div className="spinner" />
                  </div>
                  <span>处理中...</span>
                </div>
              </div>
              <div className="mini-progress">
                <div className="mini-progress-bar">
                  <div 
                    className="mini-progress-fill" 
                    style={{ width: `${currentImage.progress}%` }}
                  />
                </div>
                <span className="mini-progress-text">{currentImage.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="completed-list">
        <h3>已处理列表</h3>
        <div className="completed-items">
          {images.filter(img => img.status === 'completed' || img.status === 'failed').map(img => (
            <div key={img.id} className={`completed-item ${img.status}`}>
              <div className="completed-icon">
                {img.status === 'completed' ? '✓' : '✗'}
              </div>
              <span className="completed-name">{img.file.name}</span>
              <span className="completed-status">
                {img.status === 'completed' 
                  ? `${(img.result?.processingTime || 0) / 1000}s` 
                  : img.error || '失败'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

