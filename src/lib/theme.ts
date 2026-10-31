import type { ThemeConfig } from 'antd';

export const customTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0d9488', // Teal 600
    colorSuccess: '#10b981', // Emerald 500
    colorWarning: '#f59e0b', // Amber 500
    colorError: '#ef4444',   // Red 500
    colorInfo: '#0284c7',    // Sky 600
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    colorBgLayout: '#f8fafc',
  },
  components: {
    Button: {
      controlHeight: 40,
      borderRadius: 8,
      fontWeight: 600,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowSecondary: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Badge: {
      indicatorHeight: 18,
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};

