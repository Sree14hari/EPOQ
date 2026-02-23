"use client"

import React, { useEffect, useRef, useState } from "react"

interface Icon {
  x: number
  y: number
  z: number
}

interface IconCloudProps {
  images: string[]
}

export function IconCloud({ images }: IconCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const rotationRef = useRef({ x: 0, y: 0 })

  const [icons, setIcons] = useState<Icon[]>([])
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // ---------------------------------------
  // Generate sphere positions
  // ---------------------------------------
  useEffect(() => {
    if (!images.length) return

    const newIcons: Icon[] = []
    const count = images.length
    const offset = 2 / count
    const increment = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < count; i++) {
      const y = i * offset - 1 + offset / 2
      const r = Math.sqrt(1 - y * y)
      const phi = i * increment

      const x = Math.cos(phi) * r
      const z = Math.sin(phi) * r

      newIcons.push({
        x: x * 120,
        y: y * 120,
        z: z * 120,
      })
    }

    setIcons(newIcons)
  }, [images])

  // ---------------------------------------
  // Load images properly
  // ---------------------------------------
  useEffect(() => {
    if (!images.length) return

    let loadedCount = 0
    const imgs: HTMLImageElement[] = []

    images.forEach((src) => {
      const img = new Image()
      img.src = src

      img.onload = () => {
        loadedCount++
        if (loadedCount === images.length) {
          setLoadedImages(imgs)
        }
      }

      img.onerror = () => {
        console.error("Failed to load image:", src)
      }

      imgs.push(img)
    })
  }, [images])

  // ---------------------------------------
  // Animation
  // ---------------------------------------
  useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas || loadedImages.length !== images.length) return

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!isDragging) {
      rotationRef.current.x += 0.002
      rotationRef.current.y += 0.003
    }

    icons.forEach((icon, index) => {
      const cosX = Math.cos(rotationRef.current.x)
      const sinX = Math.sin(rotationRef.current.x)
      const cosY = Math.cos(rotationRef.current.y)
      const sinY = Math.sin(rotationRef.current.y)

      const x = icon.x * cosY - icon.z * sinY
      const z = icon.x * sinY + icon.z * cosY
      const y = icon.y * cosX + z * sinX

      const scale = (z + 200) / 300
      const opacity = Math.max(0.4, Math.min(1, (z + 150) / 200))

      ctx.save()
      ctx.translate(canvas.width / 2 + x, canvas.height / 2 + y)
      ctx.scale(scale, scale)
      ctx.globalAlpha = opacity

      
      ctx.beginPath()
      ctx.arc(0, 0, 24, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()

      ctx.filter = "invert(1)" // converts black icons to white
      ctx.shadowColor = "rgba(255,255,255,0.4)" // subtle glow
      ctx.shadowBlur = 15

      ctx.drawImage(loadedImages[index], -24, -24, 48, 48)

      ctx.filter = "none"
      ctx.shadowBlur = 0

      ctx.restore()
    })

    animationRef.current = requestAnimationFrame(animate)
  }

  animate()

  return () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }
}, [icons, loadedImages, isDragging, images.length])
  // ---------------------------------------
  // Mouse Events
  // ---------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y

    rotationRef.current.x += dy * 0.003
    rotationRef.current.y += dx * 0.003

    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={420}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="rounded-xl"
    />
  )
}