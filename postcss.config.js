import tailwindcss from 'tailwindcss';

let autoprefixerPlugin = null;

try {
  const { default: autoprefixer } = await import('autoprefixer');
  autoprefixerPlugin = autoprefixer();
} catch (error) {
  autoprefixerPlugin = null;
}

export default {
  plugins: [tailwindcss(), ...(autoprefixerPlugin ? [autoprefixerPlugin] : [])],
};