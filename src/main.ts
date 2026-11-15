import { mount } from 'svelte';
import './styles/app.css';
import App from './ui/App.svelte';
import Beamer from './beamer/Beamer.svelte';

const target = document.getElementById('app')!;
const isBeamer = location.hash.startsWith('#/beamer');
document.title = isBeamer ? 'Turnier · Beamer' : 'Turniermanager';
mount(isBeamer ? Beamer : App, { target });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(err => console.warn('Offline-Modus nicht verfügbar', err));
}
