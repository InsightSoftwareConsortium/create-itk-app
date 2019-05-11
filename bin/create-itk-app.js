#!/usr/bin/env node

const path = require('path')
const inquirer = require('inquirer')
const program = require('commander')

program
  .usage('[options] [destination]')
  .option('-n, --appName <app-name>', 'App name')
  .option('-d, --desc "<description>"',
        'Description (contain in quotes)')
  .option('-a, --author "<full-name>"',
        'Author name (contain in quotes)')
  .option('-e, --email <email>', 'Author email address')
  .option('-h, --homepage <homepage>', 'Project\'s homepage')
  .option('-u, --user <username>', 'GitHub username or org (repo owner)')
  .option('-r, --repo <repo-name>', 'Repository name')
  .option('--overwrite', 'Overwrite existing files', false)
  .parse(process.argv)

const destination = program.args.length
  ? path.resolve(process.cwd(), program.args.shift())
  : process.cwd()

