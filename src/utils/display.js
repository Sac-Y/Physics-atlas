// 全局渲染像素比：Retina 全分辨率(2x)对本场景是纯浪费——
// 加法混合的大面积柔和辉光在 1.5x 下肉眼无差，GPU 像素量省 ~44%。
// 渲染器与各 shader 的 uPixelRatio 必须同源，否则点精灵尺寸会错。
export const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5)
