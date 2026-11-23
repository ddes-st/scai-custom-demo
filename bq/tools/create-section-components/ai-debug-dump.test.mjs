import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  _resetAiDebugClearedDirsForTests,
  aiDebugStem,
  buildImageLabelByIndexFromMessages,
  clearAiDebugDumpDir,
  clearSectionRegistryAiDebugTrees,
  CREATE_SECTION_PROMPTS_DIR,
  derivePageDirFromAiDebugOutDir,
  formatAiDebugIndexMarkdown,
  isAiDebugDumpEnabled,
  registryChildFolderStem,
  resolveAiDebugIndexAbsPath,
  resolveAiDebugOutDir,
  serializeMessagesForPromptDump,
  setSkipAiDebugDump,
  tryParseRawCodegenFields,
  writeAiDebugDump,
  writeDefinitionAfterFixupsDump,
  writeDefinitionSanitizeDump,
} from './ai-debug-dump.mjs';
import { findSitecoreizeRaw } from './diagnose-sitecoreize-preview.mjs';

describe('ai-debug-dump', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('aiDebugStem builds safe names', () => {
    assert.equal(
      aiDebugStem('codegen-child', 'SitecoreNavigation'),
      'codegen-child-SitecoreNavigation',
    );
    assert.match(aiDebugStem('visual-fidelity', 'Foo', { iteration: 2 }), /i2/);
  });

  it('serializeMessagesForPromptDump replaces images', () => {
    const text = serializeMessagesForPromptDump(
      [
        { role: 'system', content: 'sys' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
          ],
        },
      ],
      { imageLabelByIndex: new Map([[1, 'sections/s/a.png']]) },
    );
    assert.match(text, /AI REQUEST \(input only\)/);
    assert.match(text, /role=system/);
    assert.match(text, /hello/);
    assert.match(text, /\[image attachment: sections\/s\/a\.png\]/);
    assert.doesNotMatch(text, /base64,AAA/);
  });

  it('serializeMessagesForPromptDump omits assistant/tool output turns', () => {
    const text = serializeMessagesForPromptDump([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task please' },
      {
        role: 'assistant',
        content: JSON.stringify({
          tsx: 'export const Default = () => null;',
          packages: [{ componentName: 'Leaked' }],
        }),
      },
      { role: 'tool', content: 'tool noise' },
    ]);
    assert.match(text, /AI REQUEST \(input only\)/);
    assert.match(text, /task please/);
    assert.doesNotMatch(text, /role=assistant/);
    assert.doesNotMatch(text, /role=tool/);
    assert.doesNotMatch(text, /export const Default/);
    assert.doesNotMatch(text, /Leaked/);
  });

  it('annotates prior visual TSX as request input, not this call\'s response', () => {
    const text = serializeMessagesForPromptDump([
      {
        role: 'user',
        content: [
          '=== VISUAL TSX (authoritative structure/classes) ===',
          '```tsx',
          'export const Default = () => <div/>;',
          '```',
          'Return JSON only.',
        ].join('\n'),
      },
    ]);
    assert.match(text, /prior visual-step INPUT/);
    assert.match(text, /export const Default/);
    assert.match(text, /\.raw\.ai\.json/);
  });

  it('labels tablet/mobile by message order, not sorted attachment names', () => {
    const desktop = 'sections/section-01/section-01-desktop.png';
    const tablet = 'sections/section-01/section-01-tablet.png';
    const mobile = 'sections/section-01/section-01-mobile.png';
    // Evidence order: desktop → tablet → mobile (not alphabetical).
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Screenshot (desktop):' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,D' } },
          { type: 'text', text: 'Screenshot (tablet):' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,T' } },
          { type: 'text', text: 'Screenshot (mobile):' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,M' } },
        ],
      },
    ];
    // Alphabetically sorted list would be desktop, mobile, tablet — must NOT drive labels.
    const sortedWrong = [desktop, mobile, tablet];
    const imageRelsInOrder = [desktop, tablet, mobile];
    const map = buildImageLabelByIndexFromMessages(messages, {
      imageRelsInOrder,
    });
    assert.equal(map.get(1), desktop);
    assert.equal(map.get(2), tablet);
    assert.equal(map.get(3), mobile);
    assert.notEqual(map.get(2), sortedWrong[1]);

    const text = serializeMessagesForPromptDump(messages, { imageRelsInOrder });
    const tabletBlock = text.match(
      /Screenshot \(tablet\):\n(\[image attachment: [^\]]+\])/,
    );
    const mobileBlock = text.match(
      /Screenshot \(mobile\):\n(\[image attachment: [^\]]+\])/,
    );
    assert.equal(
      tabletBlock?.[1],
      '[image attachment: sections/section-01/section-01-tablet.png]',
    );
    assert.equal(
      mobileBlock?.[1],
      '[image attachment: sections/section-01/section-01-mobile.png]',
    );
  });

  it('prefers part._bqRelPath over imageRelsInOrder', () => {
    const part = {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,X' },
    };
    Object.defineProperty(part, '_bqRelPath', {
      value: 'sections/s/from-part.png',
      enumerable: false,
    });
    const text = serializeMessagesForPromptDump(
      [{ role: 'user', content: [part] }],
      { imageRelsInOrder: ['sections/s/wrong-order.png'] },
    );
    assert.match(text, /\[image attachment: sections\/s\/from-part\.png\]/);
  });

  it('tryParseRawCodegenFields extracts without normalize', () => {
    const raw = JSON.stringify({
      tsx: "export const Default = () => <div className='outline-indigo-500' />;",
      definitionTs: 'export const x = {};',
      clientTsx: "'use client';\nexport default function C(){return null}",
    });
    const parsed = tryParseRawCodegenFields(raw);
    assert.match(parsed.tsx, /outline-indigo-500/);
    assert.ok(parsed.definitionTs);
    assert.ok(parsed.clientTsx);
  });

  it('writeAiDebugDump writes artifacts under section-registry ai-debug/', async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    assert.equal(isAiDebugDumpEnabled(), true);
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-'));
    temps.push(root);
    const componentFolder = 'main-nav';
    await writeAiDebugDump({
      projectRoot: root,
      componentFolder,
      sectionFolder: 'section-03',
      purpose: 'codegen',
      componentName: 'SitecoreMainHeader',
      messages: [
        { role: 'system', content: 'stub' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'task' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,XX' } },
          ],
        },
      ],
      result: {
        ok: true,
        model: 'test-model',
        content: JSON.stringify({
          tsx: 'export const Default = () => null;',
          definitionTs: 'export const def = {};',
        }),
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      },
      attachments: ['sections/section-03/section-03-desktop.png'],
      imageRelsInOrder: ['sections/section-03/section-03-desktop.png'],
      evidenceMode: 'png',
      sources: [
        'sections/section-03/original-section.html',
        'prompts/system-codegen-visual.md',
      ],
    });

    const stem = 'codegen-SitecoreMainHeader';
    const base = path.join(
      root,
      'section-registry',
      componentFolder,
      'ai-debug',
      stem,
    );
    const prompt = await readFile(`${base}.prompt.ai`, 'utf8');
    assert.match(prompt, /\[image attachment: sections\/section-03\/section-03-desktop\.png\]/);
    const attachments = await readFile(`${base}.attachments.md`, 'utf8');
    assert.match(attachments, /# Attachments \(multimodal images sent\)/);
    assert.match(
      attachments,
      /\[section-03-desktop\.png\]\([^)]+section-03-desktop\.png\)/,
    );
    assert.doesNotMatch(attachments, /system-codegen\.md/);
    assert.doesNotMatch(attachments, /section\.html/);
    const sources = await readFile(`${base}.sources.md`, 'utf8');
    assert.match(sources, /# Sources \(inlined in the request\)/);
    assert.match(
      sources,
      /\[system-codegen-visual\.md\]\([^)]+system-codegen-visual\.md\)/,
    );
    assert.match(sources, /\[original-section\.html\]/);
    const raw = await readFile(`${base}.raw.ai.json`, 'utf8');
    assert.match(raw, /definitionTs/);
    // Pretty-printed JSON when parseable
    assert.match(raw, /^\{\s*\n/);
    JSON.parse(raw);
    const tsx = await readFile(`${base}.tsx.ai`, 'utf8');
    assert.match(tsx, /export const Default/);
    const meta = JSON.parse(await readFile(`${base}.meta.json`, 'utf8'));
    assert.equal(meta.purpose, 'codegen');
    assert.equal(meta.ok, true);
    assert.equal(meta.evidenceMode, 'png');
    assert.equal(meta.attachmentCount, 1);
    assert.equal(meta.sourceCount, 2);
  });

  it('html evidence mode: attachments empty; sources list inlined HTML', async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-html-'));
    temps.push(root);
    await writeAiDebugDump({
      projectRoot: root,
      componentFolder: 'consent',
      sectionFolder: 'section-01',
      purpose: 'codegen-visual',
      componentName: 'section-01',
      messages: [{ role: 'user', content: '=== SECTION EVIDENCE ===\n<html/>' }],
      result: { ok: true, content: '{"tsx":"x"}' },
      attachments: [],
      imageRelsInOrder: [],
      evidenceMode: 'html',
      sources: [
        'sections/section-01/section.html',
        'prompts/system-codegen-visual.md',
      ],
    });
    const base = path.join(
      root,
      'section-registry',
      'consent',
      'ai-debug',
      'codegen-visual-section-01',
    );
    const attachments = await readFile(`${base}.attachments.md`, 'utf8');
    assert.match(attachments, /_\(none\)_/);
    const sources = await readFile(`${base}.sources.md`, 'utf8');
    assert.match(sources, /\[section\.html\]\([^)]+section\.html\)/);
    assert.match(
      sources,
      /\[system-codegen-visual\.md\]\([^)]+system-codegen-visual\.md\)/,
    );
    assert.doesNotMatch(sources, /\.png/);
    const meta = JSON.parse(await readFile(`${base}.meta.json`, 'utf8'));
    assert.equal(meta.evidenceMode, 'html');
    assert.equal(meta.attachmentCount, 0);
    assert.equal(meta.sourceCount, 2);
  });

  it('splits legacy extraAttachments: images→attachments, md/html→sources', async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-legacy-'));
    temps.push(root);
    await writeAiDebugDump({
      projectRoot: root,
      componentFolder: 'legacy',
      sectionFolder: 'section-02',
      purpose: 'codegen',
      componentName: 'Legacy',
      messages: [],
      result: { ok: true, content: '{}' },
      attachments: [
        'sections/section-02/section-02-desktop.png',
        'sections/section-02/states/menu-a/section.html',
      ],
      imageRelsInOrder: [],
      extraAttachments: ['prompts/system-codegen-visual.md'],
    });
    const base = path.join(
      root,
      'section-registry',
      'legacy',
      'ai-debug',
      'codegen-Legacy',
    );
    const attachments = await readFile(`${base}.attachments.md`, 'utf8');
    assert.match(attachments, /section-02-desktop\.png/);
    assert.doesNotMatch(attachments, /section\.html/);
    assert.doesNotMatch(attachments, /system-codegen/);
    const sources = await readFile(`${base}.sources.md`, 'utf8');
    assert.match(sources, /states\/menu-a\/section\.html/);
    assert.match(sources, /system-codegen-visual\.md/);
  });

  it('clears prior ai-debug dumps once per registry folder', async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-clear-'));
    temps.push(root);
    const componentFolder = 'consent-banner';
    await writeAiDebugDump({
      projectRoot: root,
      componentFolder,
      purpose: 'decompose',
      componentName: 'A',
      messages: [{ role: 'user', content: 'first' }],
      result: { ok: true, content: '{"tsx":"old"}' },
    });
    await writeAiDebugDump({
      projectRoot: root,
      componentFolder,
      purpose: 'codegen',
      componentName: 'B',
      messages: [{ role: 'user', content: 'second' }],
      result: { ok: true, content: '{"tsx":"new"}' },
    });
    const debugDir = path.join(
      root,
      'section-registry',
      componentFolder,
      'ai-debug',
    );
    const { readdir } = await import('node:fs/promises');
    const names = await readdir(debugDir);
    assert.ok(names.some((n) => n.startsWith('decompose-A')));
    assert.ok(names.some((n) => n.startsWith('codegen-B')));
  });

  it('respects skip override', async () => {
    setSkipAiDebugDump(true);
    assert.equal(isAiDebugDumpEnabled(), false);
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-off-'));
    temps.push(root);
    const out = await writeAiDebugDump({
      projectRoot: root,
      componentFolder: 'consent-banner',
      purpose: 'decompose',
      messages: [],
      result: { ok: true, content: '{}' },
    });
    assert.equal(out, null);
    setSkipAiDebugDump(false);
  });

  it('nests child ai-debug under page section folder', () => {
    assert.equal(registryChildFolderStem('HeaderNavigation'), 'header-navigation');
    const pageSection =
      '/proj/www-crelan-be--nl-particulieren/sections/section-02';
    const parent = resolveAiDebugOutDir({
      pageSectionDir: pageSection,
    });
    const child = resolveAiDebugOutDir({
      pageSectionDir: pageSection,
      childFolder: 'header-navigation',
    });
    assert.match(
      parent.replace(/\\/g, '/'),
      /sections\/section-02\/ai-debug$/,
    );
    assert.match(
      child.replace(/\\/g, '/'),
      /sections\/section-02\/ai-debug\/header-navigation$/,
    );
  });

  it('legacy resolve falls back to section-registry path', () => {
    const parent = resolveAiDebugOutDir({
      projectRoot: '/proj',
      componentFolder: 'header',
    });
    assert.match(parent.replace(/\\/g, '/'), /section-registry\/header\/ai-debug$/);
  });

  it('Markdown indexes use relative links; prompts resolve outside capture tree', async () => {
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-md-'));
    temps.push(root);
    const pageDir = path.join(root, 'www-example--home');
    const sectionDir = path.join(pageDir, 'sections', 'section-01');
    const aiDebugRoot = path.join(sectionDir, 'ai-debug');
    await mkdir(sectionDir, { recursive: true });
    await writeFile(path.join(sectionDir, 'section.html'), '<section/>');
    await writeFile(path.join(sectionDir, 'section-01-desktop.png'), 'png');

    assert.equal(
      derivePageDirFromAiDebugOutDir(aiDebugRoot)?.replace(/\\/g, '/'),
      pageDir.replace(/\\/g, '/'),
    );

    const promptAbs = resolveAiDebugIndexAbsPath('prompts/system-codegen-visual.md', {
      outDir: aiDebugRoot,
      pageDir,
    });
    assert.equal(
      promptAbs.replace(/\\/g, '/'),
      path.join(CREATE_SECTION_PROMPTS_DIR, 'system-codegen-visual.md').replace(/\\/g, '/'),
    );
    const sectionAbs = resolveAiDebugIndexAbsPath('sections/section-01/section.html', {
      outDir: aiDebugRoot,
      pageDir,
    });
    assert.equal(
      sectionAbs.replace(/\\/g, '/'),
      path.join(pageDir, 'sections', 'section-01', 'section.html').replace(/\\/g, '/'),
    );

    const md = formatAiDebugIndexMarkdown(
      'Sources (inlined in the request)',
      [
        'sections/section-01/section.html',
        'prompts/system-codegen-visual.md',
      ],
      { outDir: aiDebugRoot, pageDir },
    );
    assert.match(md, /\[section\.html\]\(\.\.\/section\.html\)/);
    assert.match(
      md,
      /\[system-codegen-visual\.md\]\([^)]*create-section-components\/prompts\/system-codegen-visual\.md\)/,
    );

    await writeAiDebugDump({
      aiDebugRoot,
      pageDir,
      purpose: 'codegen-visual',
      componentName: 'section-01',
      messages: [{ role: 'user', content: 'go' }],
      result: { ok: true, content: '{"tsx":"x"}' },
      attachments: [],
      imageRelsInOrder: ['sections/section-01/section-01-desktop.png'],
      evidenceMode: 'png',
      sources: [
        'sections/section-01/section.html',
        'prompts/system-codegen-visual.md',
      ],
    });
    const stem = 'codegen-visual-section-01';
    const base = path.join(aiDebugRoot, stem);
    const attachments = await readFile(`${base}.attachments.md`, 'utf8');
    assert.match(
      attachments,
      /\[section-01-desktop\.png\]\(\.\.\/section-01-desktop\.png\)/,
    );
    const sources = await readFile(`${base}.sources.md`, 'utf8');
    assert.match(sources, /\[section\.html\]\(\.\.\/section\.html\)/);
    assert.match(
      sources,
      /\[system-codegen-visual\.md\]\([^)]*prompts\/system-codegen-visual\.md\)/,
    );
  });

  it('writeDefinitionAfterFixupsDump writes post-lean source under ai-debug', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-after-'));
    temps.push(root);
    setSkipAiDebugDump(false);
    const written = writeDefinitionAfterFixupsDump({
      aiDebugRoot: path.join(root, 'ai-debug'),
      componentName: 'ExampleBlock',
      definitionKey: 'example-block',
      source: 'export const broken = {\n',
    });
    assert.ok(written?.path);
    assert.match(written.stem, /definition-after-fixups-ExampleBlock/);
    const body = await readFile(written.path, 'utf8');
    assert.match(body, /export const broken/);
  });

  it('writeDefinitionAfterFixupsDump no-ops when dumps disabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-skip-'));
    temps.push(root);
    setSkipAiDebugDump(true);
    const written = writeDefinitionAfterFixupsDump({
      aiDebugRoot: path.join(root, 'ai-debug'),
      componentName: 'ExampleBlock',
      source: 'x',
    });
    assert.equal(written, null);
    setSkipAiDebugDump(false);
  });

  it('writeDefinitionSanitizeDump no-ops when changed === 0', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-sanitize-noop-'));
    temps.push(root);
    setSkipAiDebugDump(false);
    const written = writeDefinitionSanitizeDump({
      aiDebugRoot: path.join(root, 'ai-debug'),
      stem: 'codegen-sitecoreize-Foo',
      changed: 0,
      changes: [],
      packagesJson: { packages: [] },
    });
    assert.equal(written, null);
  });

  it('writeDefinitionSanitizeDump writes meta + sanitized raw when changed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-sanitize-write-'));
    temps.push(root);
    setSkipAiDebugDump(false);
    const aiDebugRoot = path.join(root, 'ai-debug');
    const written = writeDefinitionSanitizeDump({
      aiDebugRoot,
      stem: 'codegen-sitecoreize-Foo',
      purpose: 'codegen-sitecoreize',
      componentName: 'Foo',
      changed: 1,
      changes: [
        {
          kind: 'field-seed',
          keyHint: 'Body',
          before: 'bad\ftext',
          after: 'badtext',
        },
      ],
      packagesJson: {
        packages: [{ componentName: 'Foo', definitionTs: 'export const x = {};' }],
      },
    });
    assert.ok(written?.metaPath);
    assert.ok(written?.sanitizedPath);
    const meta = JSON.parse(await readFile(written.metaPath, 'utf8'));
    assert.equal(meta.changed, 1);
    assert.equal(meta.changes[0].keyHint, 'Body');
    const sanitized = JSON.parse(await readFile(written.sanitizedPath, 'utf8'));
    assert.equal(sanitized.packages[0].componentName, 'Foo');
  });

  it('findSitecoreizeRaw prefers sanitized over raw.ai.json over legacy', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-find-raw-'));
    temps.push(root);
    const aiDebugRoot = path.join(root, 'ai-debug');
    await mkdir(aiDebugRoot, { recursive: true });
    await writeFile(
      path.join(aiDebugRoot, 'codegen-sitecoreize-Foo.raw.json.ai'),
      '{"packages":[]}\n',
    );
    await writeFile(
      path.join(aiDebugRoot, 'codegen-sitecoreize-Foo.raw.ai.json'),
      '{"packages":[]}\n',
    );
    await writeFile(
      path.join(aiDebugRoot, 'codegen-sitecoreize-Foo.sanitized.raw.ai.json'),
      '{"packages":[{"definitionTs":"clean"}]}\n',
    );
    const found = await findSitecoreizeRaw(aiDebugRoot);
    assert.match(found || '', /sanitized\.raw\.ai\.json$/);
  });

  it('clearSectionRegistryAiDebugTrees wipes stale files; recreates parent when dumps on', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-debug-wipe-'));
    temps.push(root);
    const { mkdir, writeFile, access, readdir } = await import('node:fs/promises');
    const sectionDir = path.join(root, 'section-registry', 'header');
    const debugDir = path.join(sectionDir, 'ai-debug');
    const childDebug = path.join(sectionDir, 'header-navigation', 'ai-debug');
    await mkdir(debugDir, { recursive: true });
    await mkdir(childDebug, { recursive: true });
    await writeFile(path.join(debugDir, 'stale.prompt.ai'), 'old');
    await writeFile(path.join(childDebug, 'stale.prompt.ai'), 'old');
    setSkipAiDebugDump(true);
    _resetAiDebugClearedDirsForTests();
    await clearSectionRegistryAiDebugTrees(sectionDir);
    await assert.rejects(() => access(path.join(debugDir, 'stale.prompt.ai')));
    await assert.rejects(() => access(path.join(childDebug, 'stale.prompt.ai')));
    setSkipAiDebugDump(false);
    _resetAiDebugClearedDirsForTests();
    await mkdir(debugDir, { recursive: true });
    await writeFile(path.join(debugDir, 'stale2.prompt.ai'), 'old');
    await clearSectionRegistryAiDebugTrees(sectionDir);
    await assert.rejects(() => access(path.join(debugDir, 'stale2.prompt.ai')));
    // Parent ai-debug recreated empty for new dumps
    const names = await readdir(debugDir);
    assert.deepEqual(names, []);
  });
});
