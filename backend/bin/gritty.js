#!/usr/bin/env node
/**
 * Gritty CLI entry point. Thin commander wiring: each subcommand delegates to a
 * function under src/cli/commands, and `wrap` handles printing + turning typed
 * GrittyErrors into clean `gritty: <message>` diagnostics with exit code 1.
 */

import { Command } from 'commander';
import { initCommand } from '../src/cli/commands/init.js';
import { addCommand } from '../src/cli/commands/add.js';
import { commitCommand } from '../src/cli/commands/commit.js';
import { logCommand } from '../src/cli/commands/log.js';
import { diffCommand } from '../src/cli/commands/diff.js';
import { statusCommand } from '../src/cli/commands/status.js';
import { branchCommand } from '../src/cli/commands/branch.js';
import { checkoutCommand } from '../src/cli/commands/checkout.js';
import { GrittyError } from '../src/util/errors.js';

const program = new Command();
program
  .name('gritty')
  .description('A Git implementation from scratch — objects, refs, DAG, and a CLI.')
  .version('0.1.0');

program
  .command('init')
  .argument('[dir]', 'directory to initialize (defaults to cwd)')
  .description('Create an empty Gritty repository')
  .action(wrap((dir) => initCommand({ dir })));

program
  .command('add')
  .argument('<paths...>', 'files or directories to stage')
  .description('Stage file contents into the index')
  .action(wrap((paths) => addCommand({ paths })));

program
  .command('commit')
  .requiredOption('-m, --message <msg>', 'commit message')
  .description('Record staged changes as a new commit')
  .action(wrap((opts) => commitCommand({ message: opts.message })));

program
  .command('log')
  .option('-n, --max-count <n>', 'limit the number of commits shown', (v) => parseInt(v, 10))
  .description('Show commit history from HEAD')
  .action(wrap((opts) => logCommand({ max: opts.maxCount })));

program
  .command('diff')
  .argument('[revs...]', 'two commit-ish to compare; omit for working-vs-index')
  .description('Show changes between commits, or the working tree and the index')
  .action(wrap((revs) => diffCommand({ revs })));

program
  .command('status')
  .description('Show the working tree status')
  .action(wrap(() => statusCommand({})));

program
  .command('branch')
  .argument('[name]', 'branch to create; omit to list branches')
  .description('List or create branches')
  .action(wrap((name) => branchCommand({ name })));

program
  .command('checkout')
  .argument('<target>', 'branch name or commit to switch to')
  .description('Switch branches or restore working-tree files')
  .action(wrap((target) => checkoutCommand({ target })));

await program.parseAsync(process.argv);

/**
 * Wrap a command action: await it, print any returned string, and translate
 * GrittyError into a friendly message + non-zero exit.
 * @param {(...args: any[]) => Promise<string|void>} fn
 */
function wrap(fn) {
  return async (...args) => {
    try {
      const out = await fn(...args);
      if (out) process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
    } catch (err) {
      if (err instanceof GrittyError) {
        process.stderr.write(`gritty: ${err.message}\n`);
        process.exitCode = 1;
      } else {
        throw err;
      }
    }
  };
}
