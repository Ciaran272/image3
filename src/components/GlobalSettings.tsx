import { ProcessOptions, ImageType, ImageTypeLabels, OutputFormat } from '../types'
import { getRecommendedPreset } from '../utils/presets'
import './GlobalSettings.css'

interface GlobalSettingsProps {
  options: ProcessOptions
  onUpdateOptions: (options: Partial<ProcessOptions>) => void
}

export default function GlobalSettings({ options, onUpdateOptions }: GlobalSettingsProps) {
  const outputFormatLabels: Record<OutputFormat, string> = {
    svg: 'SVG矢量',
    png: 'PNG位图',
    both: '两种都要'
  }

  const handleTypeChange = (newType: ImageType) => {
    const preset = getRecommendedPreset(newType)
    onUpdateOptions({ imageType: newType, ...preset })
  }

  return (
    <div className="global-settings">
      <div className="settings-header">
        <h3>⚙️ 设置</h3>
        <p className="settings-subtitle">以下设置将应用到所有图片</p>
      </div>

      {/* 1. 图片类型选择 */}
      <div className="settings-section">
        <div className="section-title">图片类型（选择一个）</div>
        <select 
          value={options.imageType}
          onChange={(e) => handleTypeChange(e.target.value as ImageType)}
          className="image-type-select"
        >
          {(Object.entries(ImageTypeLabels) as [ImageType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {value === 'document' && '○ '}
              {value === 'logo' && '○ '}
              {value === 'photo' && '○ '}
              {value === 'auto' && '● '}
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 2. 高级模式（自定义） */}
      <div className="settings-section">
        <div className="section-title">高级模式（自定义）</div>
        <div className="processing-pipeline">
          <div className="pipeline-label">处理流程：</div>
          
          <label className="pipeline-checkbox">
            <input 
              type="checkbox"
              checked={options.enableBasicEnhancement}
              onChange={(e) => onUpdateOptions({ enableBasicEnhancement: e.target.checked })}
            />
            <span>1. 基础放大和去噪</span>
          </label>

          <label className="pipeline-checkbox">
            <input 
              type="checkbox"
              checked={options.enableAIUpscale}
              onChange={(e) => onUpdateOptions({ enableAIUpscale: e.target.checked })}
            />
            <span>2. AI 超分辨率</span>
          </label>
          {options.enableAIUpscale && options.enableBasicEnhancement && (
            <div style={{
              fontSize: '0.75rem',
              color: '#d97706',
              background: '#fff9e6',
              padding: '0.5rem',
              borderRadius: '6px',
              marginTop: '0.25rem',
              marginLeft: '1.5rem'
            }}>
              💡 提示：AI超分会直接处理原图以避免内存超限
            </div>
          )}

          <label className="pipeline-checkbox">
            <input 
              type="checkbox"
              checked={options.enableVectorize}
              onChange={(e) => onUpdateOptions({ enableVectorize: e.target.checked })}
            />
            <span>3. 位图转矢量</span>
          </label>
        </div>
      </div>

      {/* 3. 基础设置 */}
      <div className="settings-section">
        <div className="section-title">基础设置</div>
        <div className="basic-settings-grid">
          <div className="setting-item">
            <label>放大倍数</label>
            <select 
              value={options.upscaleFactor}
              onChange={(e) => onUpdateOptions({ upscaleFactor: Number(e.target.value) as 2 | 4 })}
            >
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          <div className="setting-item">
            <label>去噪强度</label>
            <select 
              value={options.denoiseLevel}
              onChange={(e) => onUpdateOptions({ denoiseLevel: e.target.value as any })}
            >
              <option value="none">不变（不去噪）</option>
              <option value="light">轻度</option>
              <option value="medium">中度</option>
              <option value="heavy">重度</option>
            </select>
          </div>

          <div className="setting-item">
            <label>输出格式</label>
            <select 
              value={options.outputFormat}
              onChange={(e) => onUpdateOptions({ outputFormat: e.target.value as OutputFormat })}
            >
              {Object.entries(outputFormatLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="setting-item">
            <label>输出 DPI</label>
            <select 
              value={options.dpi}
              onChange={(e) => {
                const value = e.target.value === 'original' ? 'original' : Number(e.target.value)
                onUpdateOptions({ dpi: value as any })
              }}
              className="dpi-select"
            >
              <option value="original">不变</option>
              <option value={72}>72 DPI</option>
              <option value={150}>150 DPI</option>
              <option value={300}>300 DPI ⭐</option>
              <option value={600}>600 DPI</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

