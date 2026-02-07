import { createContext, useContext, useState, useEffect } from 'react';

const ColorblindContext = createContext();

export function ColorblindProvider({ children }) {
  const [colorblindMode, setColorblindMode] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('colorblindMode');
    if (stored === 'true') {
      setColorblindMode(true);
      document.documentElement.classList.add('colorblind');
    }
  }, []);

  // Save to localStorage and toggle CSS class when changed
  const toggleColorblindMode = (enabled) => {
    setColorblindMode(enabled);
    localStorage.setItem('colorblindMode', enabled.toString());
    if (enabled) {
      document.documentElement.classList.add('colorblind');
    } else {
      document.documentElement.classList.remove('colorblind');
    }
  };

  return (
    <ColorblindContext.Provider value={{ colorblindMode, toggleColorblindMode }}>
      {children}
    </ColorblindContext.Provider>
  );
}

export function useColorblindMode() {
  const context = useContext(ColorblindContext);
  if (!context) {
    throw new Error('useColorblindMode must be used within ColorblindProvider');
  }
  return context;
}

/* ── Color Mappings ────────────────────────────────────────── */

/** 
 * Colorblind-friendly palette
 * Deuteranopia (red-green colorblindness) affects ~5% of males, ~0.4% of females
 * Strategy: Replace green → blue, yellow → orange, emerald → teal, keep red but add icons
 */

/** Get colors for Recharts fills/strokes (need raw hex, not Tailwind) */
export function getChartColors(colorblindMode) {
  if (colorblindMode) {
    return {
      barFill: '#3b82f6',       // blue-500
      areaFill: '#ccfbf1',      // teal-100
      areaStroke: '#0d9488',     // teal-600
      savingsBar: '#3b82f6',    // blue-500
    };
  }
  return {
    barFill: '#10b981',         // emerald-500
    areaFill: '#d1fae5',        // emerald-100
    areaStroke: '#059669',       // emerald-600
    savingsBar: '#22c55e',      // green-500
  };
}

export function getRiskColors(risk_level, colorblindMode) {
  if (colorblindMode) {
    // Colorblind-friendly: blue/orange/red
    return {
      LOW: { bar: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', icon: '✓' },
      MEDIUM: { bar: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50', icon: '⚠' },
      HIGH: { bar: 'bg-red-500', text: 'text-red-800', bg: 'bg-red-50', icon: '✕' },
      UNKNOWN: { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50', icon: '?' },
    }[risk_level] || { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50', icon: '?' };
  }

  // Standard traffic light colors
  return {
    LOW: { bar: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50', icon: '✓' },
    MEDIUM: { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', icon: '⚠' },
    HIGH: { bar: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50', icon: '✕' },
    UNKNOWN: { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50', icon: '?' },
  }[risk_level] || { bar: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50', icon: '?' };
}

export function getSuccessColors(colorblindMode) {
  if (colorblindMode) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      textBold: 'text-blue-600',
      border: 'border-blue-200',
    };
  }
  return {
    bg: 'bg-green-50',
    text: 'text-green-700',
    textBold: 'text-green-600',
    border: 'border-green-200',
  };
}

export function getDeltaColors(deltaT, colorblindMode) {
  const isClose = Math.abs(deltaT) < 3;
  const isModerate = Math.abs(deltaT) < 8;
  
  if (colorblindMode) {
    return isClose
      ? 'bg-blue-100 text-blue-700'
      : isModerate
        ? 'bg-orange-100 text-orange-700'
        : 'bg-red-100 text-red-700';
  }
  
  return isClose
    ? 'bg-green-100 text-green-700'
    : isModerate
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700';
}

export function getRecommendationColors(action, colorblindMode) {
  if (colorblindMode) {
    return {
      OPEN_WINDOW: { bg: 'bg-blue-50 border-blue-200', icon: '🪟', color: 'text-blue-700' },
      CLOSE_WINDOW: { bg: 'bg-orange-50 border-orange-200', icon: '🔒', color: 'text-orange-700' },
      USE_AC: { bg: 'bg-cyan-50 border-cyan-200', icon: '❄️', color: 'text-cyan-700' },
      USE_HEAT: { bg: 'bg-orange-50 border-orange-200', icon: '🔥', color: 'text-orange-700' },
      DO_NOTHING: { bg: 'bg-blue-50 border-blue-200', icon: '✅', color: 'text-blue-700' },
    }[action] || { bg: 'bg-gray-50 border-gray-200', icon: '💡', color: 'text-gray-700' };
  }

  return {
    OPEN_WINDOW: { bg: 'bg-green-50 border-green-200', icon: '🪟', color: 'text-green-700' },
    CLOSE_WINDOW: { bg: 'bg-orange-50 border-orange-200', icon: '🔒', color: 'text-orange-700' },
    USE_AC: { bg: 'bg-cyan-50 border-cyan-200', icon: '❄️', color: 'text-cyan-700' },
    USE_HEAT: { bg: 'bg-orange-50 border-orange-200', icon: '🔥', color: 'text-orange-700' },
    DO_NOTHING: { bg: 'bg-green-50 border-green-200', icon: '✅', color: 'text-green-700' },
  }[action] || { bg: 'bg-gray-50 border-gray-200', icon: '💡', color: 'text-gray-700' };
}
