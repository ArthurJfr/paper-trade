// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxt/icon',
  ],

  css: [
    '~/assets/scss/main.scss',
  ],

  // Injection globale des variables et mixins SCSS.
  // Les fichiers partiels (`_variables.scss`, `_mixins.scss`) gèrent leur propre scope
  // interne ; ici on les expose à tous les `<style lang="scss">` et à `main.scss`.
  vite: {
    optimizeDeps: {
      // Empêche Vite de pré-bundler `nuxt/dist/*`, ce qui peut casser
      // la résolution des imports virtuels Nuxt comme `#app-manifest`.
      exclude: ['nuxt'],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @use "~/assets/scss/variables" as *;
            @use "~/assets/scss/mixins" as *;
          `,
        },
      },
    },
  },

  runtimeConfig: {
    coingeckoApiKey: process.env.COINGECKO_API_KEY || '',
    public: {
      initialBalanceUsdc: Number(process.env.INITIAL_BALANCE_USDC ?? 10000),
      tradingFeeBps: Number(process.env.TRADING_FEE_BPS ?? 10),
      appName: 'Paper-Trade',
      appVersion: '0.1.0',
    },
  },

  nitro: {
    preset: process.env.NITRO_PRESET || undefined,
  },

  app: {
    head: {
      title: 'Paper-Trade — Visualisation crypto & paper trading',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Dashboard crypto self-hosted : visualisation classifiée, heatmaps, et portefeuille simulé.' },
        { name: 'theme-color', content: '#0a0b0d' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap' },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  future: {
    compatibilityVersion: 4,
  },
})
