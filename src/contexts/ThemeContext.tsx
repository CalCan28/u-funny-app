import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// LIGHT THEME (current warm beige)
// ============================================
const lightTheme = {
  mode: 'light' as const,
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  navBar: '#3d3126',
  live: '#e85d4c',
  error: '#d9534f',
  success: '#5cb85c',
  // Glassmorphism
  glassBg: 'rgba(253, 252, 250, 0.75)',
  glassBorder: 'rgba(217, 209, 195, 0.5)',
  // Overlays
  overlay: 'rgba(0,0,0,0.5)',
  shimmer: '#d9d1c3',
};

// ============================================
// DARK THEME (warm dark)
// ============================================
const darkTheme = {
  mode: 'dark' as const,
  background: '#1a1612',
  cardBg: '#2a2420',
  cardBorder: '#3d352e',
  primary: '#7fa882',
  accent: '#e8b944',
  textDark: '#f0ece4',
  textMuted: '#9b8b7a',
  navBar: '#121010',
  live: '#e85d4c',
  error: '#e87c73',
  success: '#6fcf6a',
  // Glassmorphism
  glassBg: 'rgba(42, 36, 32, 0.75)',
  glassBorder: 'rgba(61, 53, 46, 0.5)',
  // Overlays
  overlay: 'rgba(0,0,0,0.7)',
  shimmer: '#3d352e',
};

export type Theme = Omit<typeof lightTheme, 'mode'> & { mode: 'light' | 'dark' };

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
});

const THEME_STORAGE_KEY = '@ufunny_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load saved theme preference
    if (Platform.OS === 'web') {
      const value = localStorage.getItem(THEME_STORAGE_KEY);
      if (value === 'dark') setIsDark(true);
    } else {
      AsyncStorage.getItem(THEME_STORAGE_KEY).then((value) => {
        if (value === 'dark') setIsDark(true);
      });
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    const value = newMode ? 'dark' : 'light';
    if (Platform.OS === 'web') {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } else {
      AsyncStorage.setItem(THEME_STORAGE_KEY, value);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Export themes for direct access
export { lightTheme, darkTheme };
