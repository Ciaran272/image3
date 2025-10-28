import { ProcessOptions, OutputFormat } from '../types'
import StyledSelect, { StyledSelectOption } from './StyledSelect'
import './GlobalSettings.css'

const UPSCALE_FACTOR_OPTIONS: StyledSelectOption<2 | 3 | 4>[] = [
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' }
]

const DENOISE_OPTIONS: StyledSelectOption<ProcessOptions['denoiseLevel']>[] = [
  { value: 'none', label: '不变' },
  { value: 'light', label: '轻度去噪' },
  { value: 'medium', label: '中度去噪' },
  { value: 'heavy', label: '重度去噪' }
]

const OUTPUT_FORMAT_OPTIONS: StyledSelectOption<OutputFormat>[] = [
  { value: 'svg', label: 'SVG' },
  { value: 'png', label: 'PNG' },
  { value: 'both', label: '两种' }
]

const DPI_OPTIONS: StyledSelectOption<ProcessOptions['dpi']>[] = [
  { value: 'original', label: '不变' },
  { value: 72, label: '72DPI' },
  { value: 150, label: '150DPI' },
  { value: 300, label: '300DPI' },
  { value: 600, label: '600DPI' }
]

interface GlobalSettingsProps {
  options: ProcessOptions
  onUpdateOptions: (options: Partial<ProcessOptions>) => void
  showBasicSettings?: boolean
}

interface BasicSettingsRowProps {
  options: ProcessOptions
  onUpdateOptions: (options: Partial<ProcessOptions>) => void
  variant?: 'default' | 'compact'
  className?: string
}

interface PipelineControlsProps {
  options: ProcessOptions
  onUpdateOptions: (options: Partial<ProcessOptions>) => void
  variant?: 'default' | 'compact'
  className?: string
  showReminders?: boolean
}

export function BasicSettingsRow({ options, onUpdateOptions, variant = 'default', className }: BasicSettingsRowProps) {
  const gridClassNames = ['basic-settings-grid']
  if (variant === 'compact') {
    gridClassNames.push('basic-settings-grid--compact')
  }
  if (className) {
    gridClassNames.push(className)
  }

  return (
    <div className={gridClassNames.join(' ')}>
      <div className="setting-item">
        <label>放大倍数</label>
        <StyledSelect
          value={options.upscaleFactor}
          options={UPSCALE_FACTOR_OPTIONS}
          onChange={(nextValue) => onUpdateOptions({ upscaleFactor: nextValue })}
          compact={variant === 'compact'}
        />
      </div>

      <div className="setting-item">
        <label>去噪强度</label>
        <StyledSelect
          value={options.denoiseLevel}
          options={DENOISE_OPTIONS}
          onChange={(nextValue) => onUpdateOptions({ denoiseLevel: nextValue })}
          compact={variant === 'compact'}
        />
      </div>

      <div className="setting-item">
        <label>输出格式</label>
        <StyledSelect
          value={options.outputFormat}
          options={OUTPUT_FORMAT_OPTIONS}
          onChange={(nextValue) => onUpdateOptions({ outputFormat: nextValue })}
          compact={variant === 'compact'}
        />
      </div>

      <div className="setting-item">
        <label>输出 DPI</label>
        <StyledSelect
          value={options.dpi}
          options={DPI_OPTIONS}
          onChange={(nextValue) => onUpdateOptions({ dpi: nextValue })}
          compact={variant === 'compact'}
        />
      </div>
    </div>
  )
}

export function PipelineControls({ options, onUpdateOptions, variant = 'default', className, showReminders = true }: PipelineControlsProps) {
  const containerClasses = ['processing-pipeline']
  if (variant === 'compact') {
    containerClasses.push('processing-pipeline--compact')
  }
  if (className) {
    containerClasses.push(className)
  }

  return (
    <div className={containerClasses.join(' ')}>
      <div className={variant === 'compact' ? 'pipeline-pill-group' : 'pipeline-checkbox-group'}>
        <label className={variant === 'compact' ? 'pipeline-pill' : 'pipeline-checkbox'}>
          <input
            type="checkbox"
            checked={options.enableBasicEnhancement}
            onChange={(e) => onUpdateOptions({ enableBasicEnhancement: e.target.checked })}
          />
          <span>基础放大和去噪</span>
        </label>

        <label className={variant === 'compact' ? 'pipeline-pill' : 'pipeline-checkbox'}>
          <input
            type="checkbox"
            checked={options.enableAIUpscale}
            onChange={(e) => onUpdateOptions({ enableAIUpscale: e.target.checked })}
          />
          <span>AI 超分辨率</span>
        </label>

        <label className={variant === 'compact' ? 'pipeline-pill' : 'pipeline-checkbox'}>
          <input
            type="checkbox"
            checked={options.enableVectorize}
            onChange={(e) => onUpdateOptions({ enableVectorize: e.target.checked })}
          />
          <span>位图转矢量</span>
        </label>
      </div>

      {showReminders ? (
        variant === 'compact' ? (
          <div className="pipeline-reminders pipeline-reminders--compact">
            {options.enableAIUpscale ? (
              <div className="pipeline-warning">
                <span className="pipeline-warning__icon" aria-hidden="true">⚠️</span>
                <span className="pipeline-warning__text">耗时较久，占用显存（显卡/浏览器性能）</span>
              </div>
            ) : null}
            {options.enableAIUpscale && options.enableBasicEnhancement ? (
              <div className="pipeline-hint">
                <span className="pipeline-hint__icon" aria-hidden="true">💡</span>
                <span className="pipeline-hint__text">AI 超分会直接处理原图以避免内存超限</span>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {options.enableAIUpscale && (
              <div className="pipeline-warning">
                <span className="pipeline-warning__icon" aria-hidden="true">⚠️</span>
                <span className="pipeline-warning__text">耗时较久，占用显存（显卡/浏览器性能）</span>
              </div>
            )}
            {options.enableAIUpscale && options.enableBasicEnhancement && (
              <div className="pipeline-hint">
                <span className="pipeline-hint__icon" aria-hidden="true">💡</span>
                <span className="pipeline-hint__text">AI 超分会直接处理原图以避免内存超限</span>
              </div>
            )}
          </>
        )
      ) : null}
    </div>
  )
}

export default function GlobalSettings({ options, onUpdateOptions, showBasicSettings = true }: GlobalSettingsProps) {
  return (
    <div className="global-settings">
      <div className="settings-section settings-section--compact">
        <PipelineControls options={options} onUpdateOptions={onUpdateOptions} />
      </div>

      {showBasicSettings && (
        <div className="settings-section settings-section--compact">
          <BasicSettingsRow options={options} onUpdateOptions={onUpdateOptions} />
        </div>
      )}
    </div>
  )
}

