import path from 'node:path';

const buildEslintCommand = (filenames) =>
    `pnpm exec eslint --fix ${filenames.map((f) => path.relative(process.cwd(), f)).join(' ')}`;

export default {
    'src/**/*.{js,jsx,ts,tsx}': [buildEslintCommand, 'prettier --write'],
    'src/**/*.{md,mdx,css,scss}': 'prettier --write',
    'src/**/*.scss': 'stylelint --fix',
};
