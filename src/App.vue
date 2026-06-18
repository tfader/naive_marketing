<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { RouterView } from 'vue-router'

// Cockpit brand theme — indigo accent + IBM Plex, applied app-wide
// (buttons, tags, inputs, modals all pick this up from Naive's config).
const themeOverrides = {
  common: {
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
    primaryColor: '#5b50d6',
    primaryColorHover: '#4a40c2',
    primaryColorPressed: '#3f37a8',
    primaryColorSuppl: '#4a40c2',
    infoColor: '#5b50d6',
    infoColorHover: '#4a40c2',
    infoColorPressed: '#3f37a8',
    infoColorSuppl: '#4a40c2',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: 'IBM Plex Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
