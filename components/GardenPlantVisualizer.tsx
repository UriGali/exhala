'use client'

import React, { useMemo } from 'react'

import { PLANT_SPECIES, PlantSpecies } from '@/lib/plant-species'
export { PLANT_SPECIES }
export type { PlantSpecies }

interface GardenPlantVisualizerProps {
  stage: number // 0 to 30
  speciesIndex?: number
  isWithering?: boolean
  isWateringAnim?: boolean
  size?: 'sm' | 'md' | 'lg'
  showStageBadge?: boolean
  className?: string
}

export default function GardenPlantVisualizer({
  stage = 0,
  speciesIndex = 0,
  isWithering = false,
  isWateringAnim = false,
  size = 'lg',
  showStageBadge = false,
  className = '',
}: GardenPlantVisualizerProps) {
  // Asegurar límites
  const safeStage = Math.max(0, Math.min(30, stage))
  const species = PLANT_SPECIES[speciesIndex % PLANT_SPECIES.length]
  const theme = species.colorTheme

  // Dimensiones según tamaño
  const containerClasses =
    size === 'sm'
      ? 'w-24 h-24'
      : size === 'md'
      ? 'w-44 h-44'
      : 'w-64 h-64 sm:w-72 sm:h-72'

  // Porcentaje de madurez
  const progressPercent = Math.round((safeStage / 30) * 100)

  // Cálculos procedurales de crecimiento
  const stemHeightProgress = Math.min(1, safeStage / 20) // 0 a 1 entre 0 y 20 riegos
  const stemStartY = 172
  const stemEndY = 172 - 120 * (0.2 + 0.8 * stemHeightProgress) // de Y=148 a Y=52

  // Ancho y grosor de tallo
  const stemStroke = 2 + (safeStage / 30) * 3

  // Cantidad de pares de hojas según stage (0 a 6 pares)
  const leafPairs = Math.floor(safeStage / 5) // 0 a 6
  // Escala de hojas
  const leafScale = 0.4 + (safeStage / 30) * 0.7

  // Floración / Madurez (a partir de etapa 18 a 30)
  const bloomProgress = Math.max(0, Math.min(1, (safeStage - 18) / 12)) // 0 a 1

  // Colores dinámicos con efecto marchito si aplica
  const currentStemColor = isWithering ? '#737373' : theme.primary
  const currentLeafColor = isWithering ? '#A3A3A3' : theme.secondary
  const currentAccentColor = isWithering ? '#D4D4D4' : theme.accent
  const currentBloomColor = isWithering ? '#A3A3A3' : theme.bloom

  return (
    <div className={`relative ${containerClasses} mx-auto flex items-center justify-center select-none ${className}`}>
      {/* Halo de energía / vitalidad */}
      <div
        className={`absolute inset-2 rounded-full transition-all duration-1000 ${
          isWithering
            ? 'bg-neutral-100/50 scale-95'
            : isWateringAnim
            ? 'scale-110 ring-8 ring-emerald-300/40 animate-pulse'
            : 'scale-100'
        }`}
        style={{
          backgroundColor: isWateringAnim ? 'rgba(52, 211, 153, 0.35)' : safeStage >= 25 ? theme.glow : 'rgba(236, 253, 245, 0.7)',
          animationDuration: isWateringAnim ? '0.7s' : '4s',
        }}
      />

      {/* Partículas de polen y luz si la planta está madura (etapa 25+) */}
      {safeStage >= 25 && !isWithering && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
          <span className="absolute top-8 left-12 w-1.5 h-1.5 bg-amber-300 rounded-full animate-ping opacity-75" />
          <span className="absolute top-14 right-10 w-2 h-2 bg-emerald-300 rounded-full animate-pulse opacity-80" />
          <span className="absolute bottom-16 left-14 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-bounce opacity-70" />
        </div>
      )}

      {/* ANIMACIÓN INTERACTIVA DE RIEGO */}
      {isWateringAnim && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center animate-in fade-in duration-300">
          {/* Regadera flotante inclinada */}
          <div className="absolute -top-3 right-4 transition-transform duration-700 animate-in slide-in-from-top-4">
            <svg
              viewBox="0 0 100 80"
              className="w-20 h-20 drop-shadow-lg text-emerald-800 -rotate-25 transform origin-bottom-left"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M30 45 C30 35, 38 28, 50 28 L72 28 C80 28, 86 35, 86 45 L84 68 C84 73, 78 76, 72 76 L44 76 C38 76, 32 73, 32 68 Z"
                fill="#065F46"
                stroke="#022C22"
                strokeWidth="2"
              />
              <path d="M50 28 C50 14, 76 14, 76 28" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M84 38 C94 40, 94 62, 82 66" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M36 50 L14 36 L12 40 L34 58" fill="#047857" stroke="#022C22" strokeWidth="1.5" />
              <ellipse cx="12" cy="36" rx="4" ry="7" transform="rotate(-20 12 36)" fill="#10B981" stroke="#022C22" strokeWidth="1.2" />
            </svg>
          </div>

          {/* Gotas de agua cayendo en cascada */}
          <div className="absolute top-14 right-16 flex flex-col items-center gap-1.5 pointer-events-none">
            <span className="w-2 h-3.5 bg-sky-400 rounded-full animate-bounce shadow-xs" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-3 bg-sky-300 rounded-full animate-bounce shadow-xs" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-3 bg-teal-400 rounded-full animate-bounce shadow-xs" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* SVG ILUSTRACIÓN ORGÁNICA PROCEDURAL */}
      <svg
        viewBox="0 0 200 200"
        className={`w-full h-full transition-all duration-700 ${
          isWithering ? 'opacity-60 rotate-2' : 'opacity-100'
        } ${isWateringAnim ? 'scale-105' : 'scale-100'}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`stem-grad-${species.id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={currentStemColor} />
            <stop offset="100%" stopColor={currentLeafColor} />
          </linearGradient>

          <radialGradient id={`bloom-grad-${species.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={species.colorTheme.bud} />
            <stop offset="70%" stopColor={currentBloomColor} />
            <stop offset="100%" stopColor={species.colorTheme.accent} />
          </radialGradient>
        </defs>

        {/* 1. SUELO Y MACETA ORGÁNICA */}
        {/* Maceta cerámica moderna */}
        <path
          d="M74 172 L82 192 C83 194, 117 194, 118 192 L126 172 Z"
          fill="#1C1917"
          stroke="#44403C"
          strokeWidth="1.5"
        />
        {/* Borde superior de maceta */}
        <ellipse cx="100" cy="172" rx="26" ry="4" fill="#292524" stroke="#44403C" strokeWidth="1.2" />
        {/* Tierra húmeda fértil */}
        <ellipse cx="100" cy="172" rx="23" ry="3" fill="#1C1917" />

        {/* 2. ETAPA 0: SEMILLA / BROTE MINÚSCULO */}
        {safeStage === 0 && (
          <g className="animate-pulse">
            {/* Semilla enterrada */}
            <ellipse cx="100" cy="170" rx="3.5" ry="2.5" fill="#78350F" />
            {/* Pequeño brote verde emergiendo */}
            <path d="M100 170 C99 166, 102 165, 101 162" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="101" cy="162" r="1.5" fill="#4ADE80" />
          </g>
        )}

        {/* 3. TALLO PRINCIPAL PROCEDURAL (crece con stage 1 a 30) */}
        {safeStage > 0 && (
          <path
            d={`M100 172 C 100 ${172 - 30 * stemHeightProgress}, ${
              species.id === 'bonsai' ? 108 : 96
            } ${stemEndY + 35}, 100 ${stemEndY}`}
            stroke={`url(#stem-grad-${species.id})`}
            strokeWidth={stemStroke}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        )}

        {/* 4. HOJA APICAL / BROTE SUPERIOR */}
        {safeStage > 0 && (
          <g className="transition-all duration-500 origin-bottom" style={{ transformOrigin: `100px ${stemEndY}px` }}>
            <path
              d={`M100 ${stemEndY} C 94 ${stemEndY - 12 * leafScale}, 106 ${stemEndY - 12 * leafScale}, 100 ${stemEndY}`}
              fill={currentLeafColor}
              stroke={currentStemColor}
              strokeWidth="1.2"
            />
          </g>
        )}

        {/* 5. RAMAS Y HOJAS LATERALES SEGÚN ETAPAS */}
        {/* Par 1: Etapa 2+ (Hojas inferiores) */}
        {safeStage >= 2 && (
          <g className="transition-all duration-500">
            {/* Hoja Izquierda 1 */}
            <path
              d={`M99 155 C 80 150, 68 138, 62 128`}
              stroke={currentStemColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d={`M62 128 C 55 116, 70 118, 77 125 C 84 132, 68 138, 62 128 Z`}
              fill={currentLeafColor}
              stroke={currentStemColor}
              strokeWidth="1"
              transform={`scale(${leafScale})`}
              style={{ transformOrigin: '70px 125px' }}
            />

            {/* Hoja Derecha 1 */}
            <path
              d={`M101 150 C 120 144, 132 132, 138 122`}
              stroke={currentStemColor}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d={`M138 122 C 145 110, 130 112, 123 119 C 116 126, 132 132, 138 122 Z`}
              fill={currentLeafColor}
              stroke={currentStemColor}
              strokeWidth="1"
              transform={`scale(${leafScale})`}
              style={{ transformOrigin: '130px 119px' }}
            />
          </g>
        )}

        {/* Par 2: Etapa 8+ (Hojas medias) */}
        {safeStage >= 8 && (
          <g className="transition-all duration-500">
            <path
              d={`M98 130 C 78 120, 65 105, 58 92`}
              stroke={currentStemColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d={`M58 92 C 50 78, 66 80, 74 88 C 82 96, 64 102, 58 92 Z`}
              fill={currentAccentColor}
              stroke={currentStemColor}
              strokeWidth="1"
              transform={`scale(${leafScale})`}
              style={{ transformOrigin: '66px 88px' }}
            />

            <path
              d={`M102 125 C 122 116, 135 100, 142 88`}
              stroke={currentStemColor}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d={`M142 88 C 150 74, 134 76, 126 84 C 118 92, 136 98, 142 88 Z`}
              fill={currentAccentColor}
              stroke={currentStemColor}
              strokeWidth="1"
              transform={`scale(${leafScale})`}
              style={{ transformOrigin: '134px 84px' }}
            />
          </g>
        )}

        {/* Par 3: Etapa 15+ (Follaje superior exuberante) */}
        {safeStage >= 15 && (
          <g className="transition-all duration-500">
            <path
              d={`M98 100 C 82 88, 76 72, 72 58`}
              stroke={currentStemColor}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d={`M72 58 C 65 46, 79 48, 86 54 C 93 60, 78 66, 72 58 Z`}
              fill={currentLeafColor}
              stroke={currentStemColor}
              strokeWidth="1"
            />

            <path
              d={`M102 96 C 118 84, 124 68, 128 54`}
              stroke={currentStemColor}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d={`M128 54 C 135 42, 121 44, 114 50 C 107 56, 122 62, 128 54 Z`}
              fill={currentLeafColor}
              stroke={currentStemColor}
              strokeWidth="1"
            />
          </g>
        )}

        {/* 6. FLORACIÓN Y CAPULLOS SEGÚN ESPECIE (Etapa 20 a 30) */}
        {safeStage >= 20 && (
          <g className="transition-all duration-700 animate-in fade-in zoom-in">
            {/* Especie 1: Sakura (Pétalos rosados flotantes) */}
            {species.id === 'sakura' && (
              <>
                {/* Flor central superior */}
                <g transform={`translate(100, ${stemEndY}) scale(${bloomProgress})`} className="origin-center">
                  <circle cx="0" cy="0" r="10" fill="#FBCFE8" />
                  <circle cx="-5" cy="-5" r="5" fill="#F472B6" />
                  <circle cx="5" cy="-5" r="5" fill="#F472B6" />
                  <circle cx="-5" cy="5" r="5" fill="#F472B6" />
                  <circle cx="5" cy="5" r="5" fill="#F472B6" />
                  <circle cx="0" cy="0" r="3.5" fill="#F59E0B" />
                </g>
                {/* Flores laterales */}
                <circle cx="62" cy="115" r={4 * bloomProgress} fill="#F472B6" />
                <circle cx="138" cy="110" r={4 * bloomProgress} fill="#F472B6" />
                <circle cx="72" cy="58" r={5 * bloomProgress} fill="#EC4899" />
                <circle cx="128" cy="54" r={5 * bloomProgress} fill="#EC4899" />
              </>
            )}

            {/* Especie 2: Girasol (Corona dorada) */}
            {species.id === 'sunflower' && (
              <g transform={`translate(100, ${stemEndY}) scale(${bloomProgress})`} className="origin-center">
                {/* Pétalos radiales */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <ellipse
                    key={deg}
                    cx="0"
                    cy="-14"
                    rx="4"
                    ry="8"
                    fill="#F59E0B"
                    transform={`rotate(${deg} 0 0)`}
                  />
                ))}
                {/* Centro de semillas */}
                <circle cx="0" cy="0" r="9" fill="#78350F" stroke="#451A03" strokeWidth="1.5" />
              </g>
            )}

            {/* Especie 3: Rosa de la Perseverancia */}
            {species.id === 'rose' && (
              <g transform={`translate(100, ${stemEndY}) scale(${bloomProgress})`} className="origin-center">
                <circle cx="0" cy="0" r="11" fill="#BE123C" />
                <circle cx="-3" cy="-3" r="7" fill="#E11D48" />
                <circle cx="3" cy="2" r="6" fill="#F43F5E" />
                <circle cx="0" cy="0" r="3.5" fill="#FB7185" />
              </g>
            )}

            {/* Especie 4: Bonsái Zen / Monstera / Árbol de la Vida */}
            {species.id !== 'sakura' && species.id !== 'sunflower' && species.id !== 'rose' && (
              <>
                {/* Brotes dorados o flores zen */}
                <circle cx="100" cy={stemEndY} r={5 * bloomProgress} fill={species.colorTheme.bloom} />
                <circle cx="58" cy="92" r={4 * bloomProgress} fill={species.colorTheme.bloom} />
                <circle cx="142" cy="88" r={4 * bloomProgress} fill={species.colorTheme.bloom} />
                <circle cx="72" cy="58" r={4 * bloomProgress} fill={species.colorTheme.bloom} />
                <circle cx="128" cy="54" r={4 * bloomProgress} fill={species.colorTheme.bloom} />
                {safeStage === 30 && (
                  <path
                    d={`M100 ${stemEndY - 4} L102 ${stemEndY - 14} L106 ${stemEndY - 16} L102 ${stemEndY - 18} L100 ${stemEndY - 28} L98 ${stemEndY - 18} L94 ${stemEndY - 16} L98 ${stemEndY - 14} Z`}
                    fill="#FDE047"
                    className="animate-pulse"
                  />
                )}
              </>
            )}
          </g>
        )}
      </svg>

      {/* BADGE FLOTANTE DE MADUREZ (Opcional) */}
      {showStageBadge && (
        <div className="absolute -bottom-2 px-3 py-1 bg-white/95 backdrop-blur-xs border border-emerald-200/80 rounded-full shadow-xs flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{safeStage === 30 ? '¡Completamente Madura! 🌺' : `Riego ${safeStage}/30 (${progressPercent}%)`}</span>
        </div>
      )}
    </div>
  )
}
