import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from 'tailwindcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tailwindConfigPath = path.join(__dirname, 'tailwind.config.js');

let autoprefixerPlugin = null;

try {
  const { default: autoprefixer } = await import('autoprefixer');
  autoprefixerPlugin = autoprefixer();
} catch (error) {
  autoprefixerPlugin = null;
}

export default {
  plugins: [tailwindcss({ config: tailwindConfigPath }), ...(autoprefixerPlugin ? [autoprefixerPlugin] : [])],
};