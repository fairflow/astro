import { mount } from 'svelte';
import App from './ui/App.svelte';
import GlyphSheet from './ui/GlyphSheet.svelte';
import './ui/app.css';

const root = location.search.includes('glyphs') ? GlyphSheet : App;
mount(root, { target: document.getElementById('app')! });
