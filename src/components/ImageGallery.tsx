import { ImageItem } from '../types'
import './ImageGallery.css'

interface ImageGalleryProps {
  images: ImageItem[]
  onRemoveImage: (id: string) => void
}

export default function ImageGallery({ images, onRemoveImage }: ImageGalleryProps) {
  return (
    <div className="image-gallery">
      <div className="gallery-header">
        <h3>📁 图片列表</h3>
        <span className="image-count">共 {images.length} 张</span>
      </div>

      <div className="gallery-grid">
        {images.map((image) => (
          <div key={image.id} className="gallery-item">
            <div className="gallery-preview">
              <img src={image.originalUrl} alt={image.file.name} />
              <button 
                className="remove-btn"
                onClick={() => onRemoveImage(image.id)}
                title="移除"
              >
                ×
              </button>
            </div>
            <div className="gallery-info">
              <h4 className="gallery-name" title={image.file.name}>
                {image.file.name}
              </h4>
              <p className="gallery-size">
                {(image.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

