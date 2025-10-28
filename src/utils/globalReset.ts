export function handleGlobalReset() {
  if (typeof window !== 'undefined') {
    try {
      // 清理 state 缓存并回到初始视图
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch (error) {
      console.warn('清除本地缓存失败', error)
    }

    // 直接刷新页面恢复默认状态
    window.location.reload()
  }
}

