import type { CanvasStyleData, Postion } from '@/types/storeTypes'
import type { ComponentInfo, ComponentStyle, DOMRectStyle, GroupStyle } from '@/types/component'
import { errorMessage } from '@/utils/message'
import type { Vector } from '@/types/common'

export function swap<T>(arr: Array<T>, i: number, j: number) {
  arr.splice(j, 1, ...arr.splice(i, 1, arr[j]))
}

export function changeStyleWithScale(value: number, scale: number): number {
  return (value * scale) / 100
}

/**
 * 剔除指定样式，并转化为css
 * @param style  原始样式
 * @param excludes 剔除条件
 * @returns css
 */
export function excludeStyle(style: Recordable<any>, excludes: Array<string> = []) {
  let result: Recordable<string> = {}
  Object.keys(style).forEach((key) => {
    if (!excludes.includes(key)) {
      const css = stylePropToCss(key, style[key])
      result = { ...result, ...css }
    }
  })
  return result
}

/**
 * 保留指定样式，并转化为css
 * @param style 原始样式
 * @param filters 过滤条件
 * @returns css
 */
export function filterStyle(style: Recordable<any>, filters: Array<string> = []) {
  let result: Recordable<string> = {}
  Object.keys(style).forEach((key) => {
    if (filters.includes(key)) {
      const css = stylePropToCss(key, style[key])
      result = { ...result, ...css }
    }
  })
  return result
}

/**
 * 生成群组样式
 * @param style 原始样式
 * @returns css
 */

export const getGroupStyle = (style: Recordable<any>) => {
  const filters = ['gtop', 'gheight', 'gwidth', 'gleft', 'grotate']
  return filterStyle(style, filters)
}

/**
 * 转化组件样式为css
 * @param component 主要转化样式的组件
 * @returns css
 */
export const getComponentStyle = (component: ComponentInfo) => {
  return {
    ...excludeStyle(component.style, ['top', 'left', 'width', 'height', 'rotate']),
    ...getGroupStyle(component.groupStyle || {})
  }
}

// 获取一个组件旋转 rotate 后的样式
export function getComponentRotatedStyle(style: DOMRectStyle): DOMRectStyle {
  // 这里很重要，切记不能删除，将属性复制一份，否则会影响原始的属性值
  style = { ...style }

  const {
    width,
    height,
    left,
    top,
    rotate
  }: { width: number; height: number; left: number; top: number; rotate: number } = style
  if (rotate != 0) {
    const newWidth = width * cos(style.rotate) + height * sin(style.rotate)
    const diffX = (width - newWidth) / 2 // 旋转后范围变小是正值，变大是负值
    style.left = (style.left as number) + diffX
    style.right = (style.left as number) + newWidth

    const newHeight = height * cos(rotate) + width * sin(style.rotate)
    const diffY = (newHeight - height) / 2 // 始终是正
    style.top = (style.top as number) - diffY
    style.bottom = style.top + newHeight

    style.width = newWidth
    style.height = newHeight
  } else {
    style.bottom = top + height
    style.right = left + width
  }
  return style
}

/**
 * @description: 角度转弧度
 * Math.PI = 180 度
 */
function angleToRadian(angle: number) {
  return (angle * Math.PI) / 180
}

export function rotatedPointCoordinate(point: Vector, center: Vector, rotate: number): Vector {
  /**
   * 旋转公式：
   *  点a(x, y)
   *  旋转中心c(x, y)
   *  旋转后点n(x, y)
   *  旋转角度θ                tan ??
   * nx = cosθ * (ax - cx) - sinθ * (ay - cy) + cx
   * ny = sinθ * (ax - cx) + cosθ * (ay - cy) + cy
   */

  return {
    x:
      (point.x - center.x) * Math.cos(angleToRadian(rotate)) -
      (point.y - center.y) * Math.sin(angleToRadian(rotate)) +
      center.x,
    y:
      (point.x - center.x) * Math.sin(angleToRadian(rotate)) +
      (point.y - center.y) * Math.cos(angleToRadian(rotate)) +
      center.y
  }
}

// 求两点之间的中点坐标
export function getCenterPoint(p1: Vector, p2: Vector): Vector {
  return {
    x: p1.x + (p2.x - p1.x) / 2,
    y: p1.y + (p2.y - p1.y) / 2
  }
}

export function sin(rotate: number): number {
  return Math.abs(Math.sin(angleToRadian(rotate)))
}

export function cos(rotate: number): number {
  return Math.abs(Math.cos(angleToRadian(rotate)))
}

export function mod360(deg): number {
  deg = deg || 0
  return (deg + 360) % 360
}

export function decomposeComponent(component: ComponentInfo, parentStyle: ComponentStyle) {
  // 获取元素的中心点坐标
  const groupStyle: GroupStyle = component.groupStyle!
  const center: Vector = {
    y: parentStyle.top + parentStyle.height / 2,
    x: parentStyle.left + parentStyle.width / 2
  }

  if (component) {
    const { top, left, height, width, rotate } = {
      top: parentStyle.top + (parentStyle.height * groupStyle.gtop) / 100,
      left: parentStyle.left + (parentStyle.width * groupStyle.gleft) / 100,
      height: (parentStyle.height * groupStyle.gheight) / 100,
      width: (parentStyle.width * groupStyle.gwidth) / 100,
      rotate: mod360(parentStyle.rotate + (groupStyle.grotate || 0))
    }
    const point: Vector = {
      y: top + height / 2,
      x: left + width / 2
    }

    const afterPoint: Vector = rotatedPointCoordinate(point, center, parentStyle.rotate)
    component.style = {
      ...component.style,
      top: Math.round(afterPoint.y - height / 2),
      left: Math.round(afterPoint.x - width / 2),
      height: Math.round(height),
      width: Math.round(width),
      rotate
    }
    component.groupStyle = undefined
  }
}

export function createGroupStyle(groupComponent: ComponentInfo) {
  const parentStyle: ComponentStyle = groupComponent.style
  groupComponent.subComponents!.forEach((component) => {
    // component.groupStyle 的 gtop gsleft 是相对于 group 组件的位置
    // 如果已存在 component.groupStyle，说明已经计算过一次了。不需要再次计算
    const style = { ...component.style } as DOMRectStyle
    component.groupStyle = {
      gleft: toPercent((style.left - parentStyle.left) / parentStyle.width),
      gtop: toPercent((style.top - parentStyle.top) / parentStyle.height),
      gwidth: toPercent(style.width / parentStyle.width),
      gheight: toPercent(style.height / parentStyle.height),
      grotate: style.rotate
    }
  })
}

/**
 * 计算组合组件的位置信息
 */
export function computeGroupPositionStyle(defaultStyle: Postion, components: ComponentInfo[]) {
  if (defaultStyle.width === 0) {
    const xAxis: number[] = []
    const yAxis: number[] = []
    components.forEach((ele) => {
      const left: number = ele.style.left! as number
      const width: number = ele.style.width! as number
      const top: number = ele.style.top! as number
      const height: number = ele.style.height! as number
      xAxis.push(left)
      xAxis.push(left + width)
      yAxis.push(top)
      yAxis.push(top + height)
    })
    const newLeft: number = Math.min(...xAxis)
    const newTop: number = Math.min(...yAxis)
    const newWidth: number = Math.max(...xAxis) - newLeft
    const newHeight: number = Math.max(...yAxis) - newTop
    return { left: newLeft, top: newTop, width: newWidth, height: newHeight }
  }

  return defaultStyle
}

export function toPercent(val: number) {
  return parseFloat((val * 100).toFixed(4))
}

// 判断是否图片，以 png/jpg/jpeg/gif/webp 结尾
export function isImage(file) {
  return /(png|jpg|jpeg|gif|webp)$/.test(file)
}

// 获取大屏样式
export const getScreenStyle = (canvasStyle: CanvasStyleData) => {
  let backgroundImage = ''
  if (isImage(canvasStyle.image)) {
    if (canvasStyle.image.startsWith('http')) {
      backgroundImage = `url('${canvasStyle.image}')`
    } else {
      backgroundImage = `url('/${canvasStyle.image}')`
    }
  }

  return {
    width: changeStyleWithScale(canvasStyle.width, canvasStyle.scale) + 'px',
    height: changeStyleWithScale(canvasStyle.height, canvasStyle.scale) + 'px',
    backgroundImage: backgroundImage,
    backgroundSize: 'cover'
  }
}

// 检测两个对象不同的属性值
export const checkDiff = (obj1: Recordable<any>, obj2: Recordable<any>) => {
  const result: Recordable<any> = {}
  if (!obj2) {
    return obj1
  }

  Object.keys(obj1).forEach((key) => {
    if (obj1[key] !== obj2[key]) {
      result[key] = obj1[key]
    }
  })

  return result
}

// 清除对象属性
export const cleanObjectProp = (obj) => {
  Object.keys(obj).forEach((key) => delete obj[key])
}

// 生成随机字符串
export const uuid = (hasHyphen?: string) => {
  return (
    hasHyphen ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' : 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'
  ).replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 下载本地数据到文件
export const exportRaw = (name: string, data: string) => {
  const downLink = document.createElement('a')
  const blob = new Blob([data])
  downLink.href = URL.createObjectURL(blob)

  // 将下载链接插入页面中
  document.body.appendChild(downLink)
  downLink.download = name
  downLink.click()

  // 然后移除
  document.body.removeChild(downLink)
}

// 导入本地数据
export const importRaw = (fileHandler, accept = '.*') => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = (e) => {
    if (e.currentTarget && e.currentTarget['files']) {
      const length = e.currentTarget['files'].length || 0
      if (length === 0) {
        errorMessage('请选择文件')
      } else {
        const reader = new FileReader()
        reader.readAsText(e.currentTarget['files'][0])
        reader.onload = fileHandler
      }
    }
  }
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

// 复制文本到剪贴板
export const copyText = (text: string): void => {
  const copy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text', text)
    event.preventDefault()
  }
  document.addEventListener('copy', copy)
  document.execCommand('copy')
  document.removeEventListener('copy', copy)
}

/**
 * 从剪切板获取文本
 * @returns  文本
 */
export const pasteText = (): string => {
  let textData
  const paste = (event: ClipboardEvent) => {
    textData = event.clipboardData?.getData('text')
    event.preventDefault()
  }
  document.addEventListener('paste', paste)
  document.execCommand('paste')
  document.removeEventListener('paste', paste)
  return textData
}

export const isFloat = (n: number): boolean => {
  return n % 1 !== 0
}

export const stylePropToCss = (key: string, value: any): Recordable<any> => {
  switch (key) {
    case 'gwidth':
    case 'gheight':
    case 'gtop':
    case 'gleft':
      return { [key.slice(1)]: `${value}%` }
    case 'width':
    case 'height':
    case 'top':
    case 'left':
    case 'bottom':
    case 'right':
      return { [key]: `${value}px` }
    case 'fontSize':
    case 'borderWidth':
    case 'letterSpacing':
    case 'borderRadius':
      return { [key]: `${value}px` }
    case 'rotate':
    case 'scaleX':
    case 'scaleY':
      return { transform: `${key}(${value}deg)` }

    case 'scale':
      return { transform: `${key}(${(value[0], value[1])}deg)` }
    case 'backgroundImage':
      return { backgroundImage: `url(${value})` }
    default:
      return { [key]: value }
  }
}


/**
 * @prarms point 鼠标右击点
 * @prarms width 菜单栏宽度
 * @prarms height 菜单栏高度
 * @return 菜单栏坐标
 */
export const calcContextMenuLoccation = (point: Vector, width: number, height:number): Vector => {
  const result: Vector = {
    x:0,
    y:0
  }
  if(point.x+ width > window.innerWidth){
    result.x = window.innerWidth - width -10
  } else {
    result.x = point.x
  }

  if(point.y + height > window.innerHeight) {
    result.y = window.innerHeight - height -10
  } else {
    result.y = point.y
  }

  return result

  

}