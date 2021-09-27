#!/usr/bin/env node

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

import * as path from 'path';
import * as meow from 'meow';
import * as updateNotifier from 'update-notifier';
import {init} from './init';
import {clean} from './clean';
import {isYarnUsed} from './util';
import * as execa from 'execa';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json');

export interface Logger {
  log: (...args: Array<{}>) => void;
  error: (...args: Array<{}>) => void;
  dir: (obj: {}, options?: {}) => void;
}

export interface Options {
  dryRun: boolean;
  gtsRootDir: string;
  targetRootDir: string;
  yes: boolean;
  no: boolean;
  logger: Logger;
  yarn?: boolean;
}

export type VerbFilesFunction = (
  options: Options,
  files: string[],
  fix?: boolean
) => Promise<boolean>;

const logger: Logger = console;

const cli = meow({
  help: `
	Usage
	  $ gts <verb> [<file>...] [options]

    Verb can be:
      init        Adds default npm scripts to your package.json.
      lint        Checks code for formatting and lint issues.
      check       Alias for lint. Kept for backward compatibility.
      fix         Fixes formatting and linting issues (if possible).
      clean       Removes all files generated by the build.

  Options
    --help        Prints this help message.
    -y, --yes     Assume a yes answer for every prompt.
    -n, --no      Assume a no answer for every prompt.
    --dry-run     Don't make any actual changes.
    --yarn        Use yarn instead of npm.

	Examples
    $ gts init -y
    $ gts lint
    $ gts fix
    $ gts fix src/file1.ts src/file2.ts
    $ gts clean`,
  flags: {
    help: {type: 'boolean'},
    yes: {type: 'boolean', alias: 'y'},
    no: {type: 'boolean', alias: 'n'},
    dryRun: {type: 'boolean'},
    yarn: {type: 'boolean'},
  },
});

/**
 * Get the current version of node.js being run.
 * Exported purely for stubbing purposes.
 * @private
 */
export function getNodeVersion() {
  return process.version;
}

function usage(msg?: string): void {
  if (msg) {
    logger.error(msg);
  }
  cli.showHelp(1);
}

export async function run(verb: string, files: string[]): Promise<boolean> {
  // throw if running on an old version of nodejs
  const nodeMajorVersion = Number(getNodeVersion().slice(1).split('.')[0]);
  console.log(`version: ${nodeMajorVersion}`);
  if (nodeMajorVersion < 10) {
    throw new Error(
      `gts requires node.js 10.x or up. You are currently running
      ${process.version}, which is not supported. Please upgrade to
      a safe, secure version of nodejs!`
    );
  }

  const options = {
    dryRun: cli.flags.dryRun || false,
    // Paths are relative to the transpiled output files.
    gtsRootDir: path.resolve(__dirname, '../..'),
    targetRootDir: process.cwd(),
    yes: cli.flags.yes || cli.flags.y || false,
    no: cli.flags.no || cli.flags.n || false,
    logger,
    yarn: cli.flags.yarn || isYarnUsed(),
  } as Options;
  // Linting/formatting depend on typescript. We don't want to load the
  // typescript module during init, since it might not exist.
  // See: https://github.com/google/gts/issues/48
  if (verb === 'init') {
    return init(options);
  }

  const flags = Object.assign([], files);
  if (flags.length === 0) {
    flags.push(
      '**/*.ts',
      '**/*.js',
      '**/*.tsx',
      '**/*.jsx',
      '--no-error-on-unmatched-pattern'
    );
  }

  switch (verb) {
    case 'lint':
    case 'check': {
      try {
        await execa('node', ['./node_modules/eslint/bin/eslint', ...flags], {
          stdio: 'inherit',
        });
        return true;
      } catch (e) {
        return false;
      }
    }
    case 'fix': {
      const fixFlag = options.dryRun ? '--fix-dry-run' : '--fix';
      try {
        await execa(
          'node',
          ['./node_modules/eslint/bin/eslint', fixFlag, ...flags],
          {
            stdio: 'inherit',
          }
        );
        await execa(
          'node',
          [
            './node_modules/prettier/bin/prettier',
            '--write',
            '**/*.json',
            '**/.*.js',
          ],
          {
            stdio: 'inherit',
          }
        );
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
    case 'clean':
      return clean(options);
    default:
      usage(`Unknown verb: ${verb}`);
      return false;
  }
}

updateNotifier({pkg: packageJson}).notify();

if (cli.input.length < 1) {
  usage();
}

run(cli.input[0], cli.input.slice(1)).then(success => {
  if (!success) {
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
});
