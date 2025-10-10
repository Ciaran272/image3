import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="url(#gradient)" />
            <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#4A90E2" />
                <stop offset="100%" stopColor="#5BA3F5" />
              </linearGradient>
            </defs>
          </svg>
          <div className="logo-text">
            <h1>图片工具</h1>
            <p>高清化 · 去锯齿</p>
          </div>
        </div>
      </div>
    </header>
  )
}

