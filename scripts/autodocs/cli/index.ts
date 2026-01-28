#!/usr/bin/env node

import { Command } from 'commander';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig, Config } from '../config/index.js';
import { ComponentExtractor } from '../core/extract.js';
import { DocumentationGenerator } from '../core/llm.js';
import { DocumentationRenderer } from '../core/render.js';
import { CodeValidator } from '../core/validate.js';
import { parallelWithLimit } from '../utils/concurrency.js';
import { logger } from '../utils/logger.js';
import { simpleGit } from 'simple-git';

const git = simpleGit();

const program = new Command();

program
  .name('autodocs')
  .description('Automatically generate documentation for React components')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate documentation for components')
  .option('-i, --incremental', 'Only process changed files')
  .option('-w, --watch', 'Watch for changes')
  .option('-d, --dry-run', 'Preview without writing files')
  .option('-c, --concurrency <n>', 'Parallel processing limit', '3')
  .option('--no-cache', 'Disable caching')
  .option('--validate', 'Validate generated code examples')
  .option('--verbose', 'Enable verbose logging')
  .option('-o, --overrides <json>', 'JSON config overrides')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    if (options.verbose) {
      logger.setLevel('debug');
    }

    try {
      // Parse CLI overrides safely
      let cliOverrides: Partial<Config> = {};
      if (options.overrides) {
        try {
          cliOverrides = JSON.parse(options.overrides);
          // Basic validation to ensure it's an object
          if (typeof cliOverrides !== 'object' || cliOverrides === null) {
            throw new Error('Overrides must be a JSON object');
          }
        } catch (e) {
          spinner.fail(`Invalid JSON in --overrides: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      // Load config with overrides
      const config = await loadConfig({
        ...cliOverrides,
        features: {
          extractFromStories: cliOverrides.features?.extractFromStories ?? true,
          generateChangelog: cliOverrides.features?.generateChangelog ?? false,
          watchMode: cliOverrides.features?.watchMode ?? false,
          // CLI flag takes precedence > overrides > config file
          validateCodeExamples: options.validate ?? cliOverrides.features?.validateCodeExamples ?? false,
        },
      });

      // Log if we are in "External Mode"
      if (options.overrides && cliOverrides.paths?.components) {
        spinner.info(chalk.blue(`Using external component path: ${config.paths.components}`));
      }

      spinner.text = 'Initializing...';

      const extractor = new ComponentExtractor();
      const generator = new DocumentationGenerator(config);
      const renderer = new DocumentationRenderer(config);
      const validator = new CodeValidator();

      await generator.init();
      await renderer.init();

      // Get files to process
      spinner.text = 'Finding component files...';

      let files: string[];

      if (options.incremental) {
        try {
          const diff = await git.diff(['--name-only', 'HEAD~1']);
          const componentDir = path.relative(config.root, config.paths.components);

          files = diff
            .split('\n')
            .filter(f => f.startsWith(componentDir))
            .filter(f => config.patterns.include.some(p =>
              new RegExp(p.replace('**/', '').replace('*', '.*')).test(f)
            ))
            .filter(f => !config.patterns.exclude.some(p =>
              new RegExp(p.replace('**/', '').replace('*', '.*')).test(f)
            ))
            .map(f => path.resolve(config.root, f));
        } catch {
          // If git diff fails, fall back to full scan
          logger.warn('Git diff failed, falling back to full scan');
          files = await glob(
            config.patterns.include.map(p => path.join(config.paths.components, p)),
            { ignore: config.patterns.exclude }
          );
        }
      } else {
        files = await glob(
          config.patterns.include.map(p => path.join(config.paths.components, p)),
          { ignore: config.patterns.exclude }
        );
      }

      spinner.succeed(`Found ${files.length} files to process`);

      if (files.length === 0) {
        console.log(chalk.yellow('No files to process.'));
        return;
      }

      // Process files
      console.log(chalk.blue('\nProcessing components...\n'));

      const results = await parallelWithLimit(
        files,
        parseInt(options.concurrency, 10),
        async (file, index) => {
          logger.progress(index + 1, files.length, path.basename(file));

          const content = await fs.readFile(file, 'utf-8');
          const astResult = extractor.extract(file, content);

          if (!astResult.componentName) {
            return { skipped: true, reason: 'No component found' };
          }

          const doc = await generator.generate(file, content, astResult);

          if (!doc) {
            return { skipped: true, reason: 'Generation failed' };
          }

          // Validate if requested
          if (options.validate) {
            const validation = validator.validateExamples(doc);
            if (!validation.valid) {
              logger.warn(`Validation issues in ${doc.name}`, { errors: validation.errors });
            }
          }

          // Render
          const output = renderer.render(doc);
          const outputPath = path.join(config.paths.docs, `${doc.name}.mdx`);

          if (!options.dryRun) {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, output);
          }

          return { doc, outputPath };
        }
      );

      // Summary
      const successful = results.filter(r => r.result && !r.result.skipped);
      const skipped = results.filter(r => r.result?.skipped);
      const failed = results.filter(r => r.error);

      console.log('\n' + chalk.bold('Summary:'));
      console.log(chalk.green(`  ✓ ${successful.length} documented`));
      console.log(chalk.yellow(`  ○ ${skipped.length} skipped`));
      console.log(chalk.red(`  ✗ ${failed.length} failed`));

      // Generate index
      if (!options.dryRun && successful.length > 0) {
        const docs = successful
          .map(r => r.result?.doc)
          .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined);
        const index = renderer.renderIndex(docs);
        await fs.writeFile(path.join(config.paths.docs, 'index.mdx'), index);
        console.log(chalk.blue('  → Generated index.mdx'));
      }

      // Write suggestions
      const allSuggestions = successful
        .map(r => r.result?.doc)
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined)
        .flatMap(doc => doc.suggestions.map(s => ({
          component: doc.name,
          ...s,
        })));

      if (allSuggestions.length > 0 && !options.dryRun) {
        await fs.mkdir(path.dirname(config.paths.suggestions), { recursive: true });
        await fs.writeFile(config.paths.suggestions, JSON.stringify(allSuggestions, null, 2));
        console.log(chalk.blue(`  → ${allSuggestions.length} suggestions saved`));
      }

      // Exit with error code if any failed
      if (failed.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      spinner.fail('Failed');
      logger.error('Generation failed', { error: (error as Error).message });
      process.exit(1);
    }
  });

program
  .command('cache')
  .description('Manage documentation cache')
  .option('--clear', 'Clear all cached documentation')
  .option('--stats', 'Show cache statistics')
  .action(async (options) => {
    const config = await loadConfig();
    const generator = new DocumentationGenerator(config);
    await generator.init();

    if (options.clear) {
      await generator.clearCache();
      console.log(chalk.green('Cache cleared'));
    }

    if (options.stats || (!options.clear && !options.stats)) {
      const stats = generator.getCacheStats();
      console.log(chalk.bold('Cache Statistics:'));
      console.log(`  Entries: ${stats.total}`);
      console.log(`  Size: ${stats.sizeKB} KB`);
    }
  });

program
  .command('validate <file>')
  .description('Validate a single component file')
  .action(async (file) => {
    const config = await loadConfig();
    const extractor = new ComponentExtractor();

    try {
      const content = await fs.readFile(file, 'utf-8');
      const result = extractor.extract(file, content);

      console.log(chalk.bold('AST Extraction Result:'));
      console.log(JSON.stringify(result, null, 2));

      if (result.astSuccess) {
        console.log(chalk.green('\n✓ AST extraction successful'));
      } else {
        console.log(chalk.red('\n✗ AST extraction failed'));
        console.log(chalk.yellow('Errors:'), result.astErrors.join(', '));
      }
    } catch (error) {
      console.error(chalk.red('Error reading file:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize AutoDocs configuration')
  .action(async () => {
    const configPath = path.join(process.cwd(), 'autodocs.config.ts');

    try {
      await fs.access(configPath);
      console.log(chalk.yellow('Configuration file already exists.'));
      return;
    } catch {
      // File doesn't exist, create it
    }

    const defaultConfig = `import type { Config } from './scripts/autodocs/config/schema';

const config: Partial<Config> = {
  paths: {
    components: 'src/components',
    docs: 'pages/docs/components',
  },
  patterns: {
    include: ['**/*.tsx'],
    exclude: [
      '**/*.stories.tsx',
      '**/*.test.tsx',
      '**/internal/**',
    ],
  },
  llm: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  },
  output: {
    format: 'mdx',
    includeSourceLink: true,
  },
  features: {
    extractFromStories: true,
    validateCodeExamples: true,
  },
};

export default config;
`;

    await fs.writeFile(configPath, defaultConfig);
    console.log(chalk.green('Created autodocs.config.ts'));
    console.log(chalk.blue('\nNext steps:'));
    console.log('  1. Update the configuration to match your project structure');
    console.log('  2. Set your ANTHROPIC_API_KEY environment variable');
    console.log('  3. Run: pnpm autodocs generate');
  });

program.parse();
