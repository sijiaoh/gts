/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as cp from 'child_process';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';
import {ncp} from 'ncp';
import * as util from 'util';

import {
  getPkgManagerCommand,
  readFilep as read,
  readJsonp as readJson,
  writeFileAtomicp as write,
  Bag,
  DefaultPackage,
  projectRootRelativePath,
  isYarn2,
} from './util';

import {Options} from './cli';
import {PackageJson} from '@npm/types';
import chalk = require('chalk');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

const ncpp = util.promisify(ncp);

const projectTypes = ['ts', 'react', 'next.js'] as const;
type ProjectType = typeof projectTypes[number];

const DEFAULT_PACKAGE_JSON: PackageJson = {
  name: '',
  version: '0.0.0',
  description: '',
  main: 'build/src/index.js',
  types: 'build/src/index.d.ts',
  files: ['build/src'],
  license: 'Apache-2.0',
  keywords: [],
  scripts: {test: 'echo "Error: no test specified" && exit 1'},
};

async function query(
  message: string,
  question: string,
  defaultVal: boolean,
  options: Options
): Promise<boolean> {
  if (options.yes) {
    return true;
  } else if (options.no) {
    return false;
  }

  if (message) {
    options.logger.log(message);
  }

  const answers: inquirer.Answers = await inquirer.prompt({
    type: 'confirm',
    name: 'query',
    message: question,
    default: defaultVal,
  });
  return answers.query;
}

async function select(
  message: string,
  question: string,
  choices: Readonly<string[]>,
  options: Options
): Promise<string> {
  if (options.yes || options.no) {
    return choices[0];
  }

  if (message) {
    options.logger.log(message);
  }

  const answers = await inquirer.prompt({
    type: 'list',
    name: 'select',
    message: question,
    choices: choices,
    default: choices[0],
  });
  return answers.select;
}

export async function addScripts(
  packageJson: PackageJson,
  options: Options
): Promise<boolean> {
  let edits = false;
  const pkgManager = getPkgManagerCommand(options.yarn);
  const scripts: Bag<string> = {
    lint: 'gts lint',
    clean: 'gts clean',
    build: 'tsc --project tsconfig.build.json',
    fix: 'gts fix',
    prepare: `${pkgManager} run build`,
    pretest: `${pkgManager} run build`,
    posttest: `${pkgManager} run lint`,
  };

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  for (const script of Object.keys(scripts)) {
    let install = true;
    const existing = packageJson.scripts[script];
    const target = scripts[script];

    if (existing !== target) {
      if (existing) {
        const message =
          `package.json already has a script for ${chalk.bold(script)}:\n` +
          `-${chalk.red(existing)}\n+${chalk.green(target)}`;
        install = await query(message, 'Replace', false, options);
      }

      if (install) {
        // eslint-disable-next-line require-atomic-updates
        packageJson.scripts[script] = scripts[script];
        edits = true;
      }
    }
  }
  return edits;
}

export async function addDependencies(
  packageJson: PackageJson,
  options: Options
): Promise<boolean> {
  let edits = false;
  const deps: DefaultPackage = {
    'sijiaoh-gts': `^${pkg.version}`,
    typescript: pkg.devDependencies.typescript,
    '@types/node': pkg.devDependencies['@types/node'],
  };

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  for (const dep of Object.keys(deps)) {
    let install = true;
    const existing = packageJson.devDependencies[dep];
    const target = deps[dep];

    if (existing !== target) {
      if (existing) {
        const message =
          `Already have devDependency for ${chalk.bold(dep)}:\n` +
          `-${chalk.red(existing)}\n+${chalk.green(target)}`;
        install = await query(message, 'Overwrite', false, options);
      }

      if (install) {
        // eslint-disable-next-line require-atomic-updates
        packageJson.devDependencies[dep] = deps[dep];
        edits = true;
      }
    }
  }

  return edits;
}

function formatJson(object: {}) {
  const json = JSON.stringify(object, null, '  ');
  return `${json}\n`;
}

async function writePackageJson(
  packageJson: PackageJson,
  options: Options
): Promise<void> {
  options.logger.log('Writing package.json...');
  if (!options.dryRun) {
    await write('./package.json', formatJson(packageJson));
  }
  const preview = {
    scripts: packageJson.scripts,
    devDependencies: packageJson.devDependencies,
  };
  options.logger.dir(preview);
}

export const getEslintConfig = (path: string) => ({
  extends: `${projectRootRelativePath}/node_modules/sijiaoh-gts/${path}`,
});

export const ESLINT_IGNORE = 'build/\n';

async function generateConfigFile(
  options: Options,
  filename: string,
  contents: string
) {
  let existing;
  try {
    existing = await read(filename, 'utf8');
  } catch (e) {
    const err = e as Error & {code?: string};
    if (err.code === 'ENOENT') {
      /* not found, create it. */
    } else {
      throw new Error(`Unknown error reading ${filename}: ${err.message}`);
    }
  }

  let writeFile = true;
  if (existing && existing === contents) {
    options.logger.log(`No edits needed in ${filename}`);
    return;
  } else if (existing) {
    writeFile = await query(
      `${chalk.bold(filename)} already exists`,
      'Overwrite',
      false,
      options
    );
  }

  if (writeFile) {
    options.logger.log(`Writing ${filename}...`);
    if (!options.dryRun) {
      await write(filename, contents);
    }
    options.logger.log(contents);
  }
}

async function generateESLintConfig(
  projectType: ProjectType,
  options: Options
): Promise<void> {
  let path = '';
  switch (projectType) {
    case 'react':
      path = 'build/src/react';
      break;
    case 'next.js':
      path = 'build/src/next';
      break;
  }
  return generateConfigFile(
    options,
    './.eslintrc.js',
    `module.exports = ${formatJson(getEslintConfig(path))};\n`
  );
}

async function generateESLintIgnore(options: Options): Promise<void> {
  return generateConfigFile(options, './.eslintignore', ESLINT_IGNORE);
}

async function generateTsConfig(
  projectType: ProjectType,
  options: Options
): Promise<void> {
  if (projectType === 'next.js') return;

  const buildConfig = formatJson({
    extends: './tsconfig.json',
    exclude: ['build', '**/*.test.ts', '**/*.test.tsx'],
  });
  await generateConfigFile(options, './tsconfig.build.json', buildConfig);

  const postfix = projectType === 'react' ? '-react' : '';
  const additionalInclude = projectType === 'react' ? ['**/*.tsx'] : [];
  const config = formatJson({
    extends: `${projectRootRelativePath}/node_modules/sijiaoh-gts/tsconfig-google${postfix}.json`,
    compilerOptions: {rootDir: '.', outDir: 'build'},
    include: ['**/*.ts', ...additionalInclude],
  });
  await generateConfigFile(options, './tsconfig.json', config);
}

async function generatePrettierConfig(options: Options): Promise<void> {
  const style = `module.exports = {
  ...require('sijiaoh-gts/.prettierrc.json')
}
`;
  return generateConfigFile(options, './.prettierrc.js', style);
}

async function generateEditorConfig(options: Options): Promise<void> {
  const config = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
insert_final_newline = true
`;
  return generateConfigFile(options, './.editorconfig', config);
}

export async function installDefaultTemplate(
  options: Options
): Promise<boolean> {
  const cwd = process.cwd();
  const sourceDirName = path.join(__dirname, '../template');
  const targetDirName = path.join(cwd, 'src');

  try {
    fs.mkdirSync(targetDirName);
  } catch (e) {
    const err = e as Error & {code?: string};
    if (err.code !== 'EEXIST') {
      throw err;
    }
    // Else, continue and populate files into the existing directory.
  }

  // Only install the template if no ts files exist in target directory.
  const files = fs.readdirSync(targetDirName);
  const tsFiles = files.filter(file => file.toLowerCase().endsWith('.ts'));
  if (tsFiles.length !== 0) {
    options.logger.log(
      'Target src directory already has ts files. ' +
        'Template files not installed.'
    );
    return false;
  }
  await ncpp(sourceDirName, targetDirName);
  options.logger.log('Default template installed.');
  return true;
}

export async function init(options: Options): Promise<boolean> {
  let generatedPackageJson = false;
  let packageJson;
  try {
    packageJson = await readJson('./package.json');
  } catch (e) {
    const err = e as Error & {code?: string};
    if (err.code !== 'ENOENT') {
      throw new Error(`Unable to open package.json file: ${err.message}`);
    }
    const generate = await query(
      `${chalk.bold('package.json')} does not exist.`,
      'Generate',
      true,
      options
    );

    if (!generate) {
      options.logger.log('Please run from a directory with your package.json.');
      return false;
    }

    packageJson = DEFAULT_PACKAGE_JSON;
    generatedPackageJson = true;
  }

  const projectType = (await select(
    '',
    'Choice your project type',
    projectTypes,
    options
  )) as ProjectType;

  const addedDeps = await addDependencies(packageJson, options);
  const addedScripts = await addScripts(packageJson, options);
  if (generatedPackageJson || addedDeps || addedScripts) {
    await writePackageJson(packageJson, options);
  } else {
    options.logger.log('No edits needed in package.json.');
  }
  await generateTsConfig(projectType, options);
  await generateESLintConfig(projectType, options);
  await generateESLintIgnore(options);
  await generatePrettierConfig(options);
  await generateEditorConfig(options);
  await installDefaultTemplate(options);

  // Run `npm install` after initial setup so `npm run lint` works right away.
  if (!options.dryRun) {
    // --ignore-scripts so that compilation doesn't happen because there's no
    // source files yet.

    cp.spawnSync(
      getPkgManagerCommand(options.yarn),
      ['install', ...(isYarn2() ? [] : ['--ignore-scripts'])],
      {stdio: 'inherit'}
    );
  }

  return true;
}
