// Fitter Design System v1 — JS/TS 토큰
// CSS 변수가 정본이다. 이 파일은 캔버스·차트·인라인 스타일 등 JS에서 값이 필요할 때만 쓴다.

export const color = {
  primary: {
    50: '#EEF3F8',
    100: '#D8E4EF',
    200: '#B3C9DE',
    300: '#85A7C7',
    400: '#5583AC',
    500: '#2F6390',
    600: '#245176',
    700: '#1C405D',
    800: '#163348',
  },
  secondary: { 100: '#F3E9E2', 300: '#D9AE92', 500: '#A8623C', 600: '#8B4E2D' },
  bg: '#FFFFFF',
  bgSubtle: '#F5F7F9',
  bgSunken: '#EDF0F3',
  surface: '#FFFFFF',
  surfaceHover: '#F5F7F9',
  textPrimary: '#171B20',
  textSecondary: '#515A65',
  textTertiary: '#69737F',
  textInverse: '#FFFFFF',
  success: '#1F7A4C',
  successBg: '#E7F3EC',
  warning: '#9A6B0F',
  warningBg: '#FBF1DC',
  danger: '#B03A2E',
  dangerBg: '#FBEAE7',
  border: '#DFE4E9',
  borderStrong: '#C7CED6',
  borderFocus: '#2F6390',
  scrim: 'rgba(14,17,20,.56)',
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 999 } as const;
export const controlHeight = { sm: 32, md: 40, touch: 44, lg: 48 } as const;
export const fontSize = { display: 40, h1: 28, h2: 22, h3: 17, body: 16, caption: 13 } as const;
export const fontFamily = {
  sans: '"Pretendard Variable",Pretendard,-apple-system,system-ui,sans-serif',
  mono: 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace',
} as const;
export const breakpoint = { mobile: 390, tablet: 768, desktop: 1280 } as const;
