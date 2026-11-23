import { defineCliConfig } from '@sitecore-content-sdk/nextjs/config-cli';
import {
  generateSites,
  generateMetadata,
  extractFiles,
  writeImportMap,
} from '@sitecore-content-sdk/nextjs/tools';
import scConfig from './sitecore.config';

export default defineCliConfig({
  config: scConfig,
  build: {
    commands: [
      generateMetadata(),
      generateSites(),
      extractFiles(),
      writeImportMap({
        paths: ['src/components'],
      }),
    ],
  },
  componentMap: {
    paths: ['src/components'],
    exclude: [
      'src/components/content-sdk/*',
      // Shadcn/ui primitives — local React UI, not Sitecore components
      'src/components/primitives/*',
      'src/components/theme-provider.tsx',
      'src/components/lib/*',
      'src/components/hooks/*',
      'src/components/icons/*',
      // Definition / content definitions — generators only, not React components
      'src/components/**/*.definition.ts',
      'src/components/**/*.content.ts',
      'src/components/**/*.props.ts',
      'src/components/**/*.props.tsx',
      // Companion client chrome for RSC-safe Placeholder parents
      'src/components/**/*.client.tsx',
      'src/components/**/*.search.tsx',
      'src/components/enums/*',
      // Shared helpers / data seeds (not Sitecore renderings)
      'src/components/**/*.util.ts',
      // Codegen type primers (not Sitecore renderings) — any packageKind
      'src/components/**/*.reference.tsx',
      'src/components/**/*.reference.ts',
    ],
  },
});
