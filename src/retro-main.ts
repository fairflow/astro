// Standalone build of the Retrograde tab (npm run build:retro): the same
// view as the app, without charts, saved data or the service worker.
import { mount } from 'svelte';
import RetrogradeStandalone from './ui/RetrogradeStandalone.svelte';
import './ui/app.css';

mount(RetrogradeStandalone, { target: document.getElementById('app')! });
