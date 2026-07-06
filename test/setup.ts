import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTexts } from '../src/interpret/textstore.js';

// Tests validate the SHIPPED text packs: load data/texts/*.json into the
// runtime store exactly as the app's loadTexts() would.
const dir = fileURLToPath(new URL('../data/texts/', import.meta.url));
const j = (name: string) => JSON.parse(readFileSync(`${dir}${name}.json`, 'utf8'));

setTexts({
  natal: j('library.natal'),
  transit: j('library.transit'),
  bodyIntro: j('bodyintro'),
  glossary: j('glossary'),
});
