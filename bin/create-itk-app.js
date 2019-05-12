#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')
const program = require('commander')
const chalk = require('chalk')
const kebabCase = require('lodash.kebabcase')
const validatePackageName = require('validate-npm-package-name')
const {guessEmail, guessAuthor, guessGitHubUsername} = require('conjecture')
const stringifyAuthor = require('stringify-author')
const spawn = require('cross-spawn')
const replace = require('replace-in-file')

program
  .usage('[options] [destination]')
  .option('-n, --appName <app-name>', 'App name')
  .option('-d, --desc "<description>"',
        'Description (contain in quotes)')
  .option('-a, --author "<full-name>"',
        'Author name (contain in quotes)')
  .option('-e, --email <email>', 'Author email address')
  .option('--homepage <homepage>', 'Project\'s homepage')
  .option('-u, --user <username>', 'GitHub username or org (repo owner)')
  .option('-r, --repo <repo-name>', 'Repository name')
  .parse(process.argv)

const destination = program.args.length
  ? path.resolve(process.cwd(), program.args.shift())
  : process.cwd()

const prompts = [
  {
    type: 'input',
    name: 'appName',
    default (answers) {
      return answers.repo || kebabCase(path.basename(destination))
    },
    message: 'App name:',
    when: !program.appName,
    validate (appName) {
      const result = validatePackageName(appName)
      if (result.errors && result.errors.length > 0) {
        return result.errors.join(',')
      }

      return true
    }
  },
  {
    type: 'input',
    name: 'description',
    default () {
      return 'An Insight Toolkit (ITK) app'
    },
    message: 'Description of app:',
    when: !program.desc
  },
  {
    type: 'input',
    name: 'author',
    default () {
      return guessAuthor()
    },
    message: 'Author\'s full name:',
    when: !program.author
  },
  {
    type: 'input',
    name: 'email',
    default () {
      return guessEmail()
    },
    message: 'Author\'s email address:',
    when: !program.email
  },
  {
    type: 'input',
    name: 'homepage',
    message: 'Homepage:',
    when: !program.homepage
  },
  {
    type: 'input',
    name: 'user',
    default (answers) {
      return guessGitHubUsername(answers.email)
    },
    message: 'GitHub user or org name:',
    when: !program.user
  },
  {
    type: 'input',
    name: 'repo',
    default (answers) {
      return answers.appName || kebabCase(path.basename(destination))
    },
    message: 'Repository name:',
    when: !program.repo
  }
]

console.log(chalk.blue('\nLet\'s create a itk.js app!\n\nHit enter to accept the suggestion.\n'))

inquirer.prompt(prompts)
  .then(answers => {
    answers.author = stringifyAuthor({
      name: program.author || answers.author,
      email: program.email || answers.email,
      url: program.homepage || answers.homepage
    })
    answers.year = new Date().getFullYear()
    answers.appName = program.appName || answers.appName
    answers.description = program.desc || answers.description
    answers.user = program.user || answers.user
    answers.repo = program.repo || answers.repo

    console.log(answers)

    console.log(chalk.blue('\nCreating React app!'))
    const craResult = spawn.sync('npx', ['create-react-app', destination], { stdio: ['ignore', 'inherit', 'inherit'] })
    if (craResult.status != 0) {
      console.log(chalk.red(`Could not run create-react-app.`))
      return
    }


    console.log(chalk.blue('\nSetting up craco...\n'))
    const cracoResult = spawn.sync('npm', ['install', '--save', '--silent', '@craco/craco', 'craco-itk', 'itk'], { stdio: 'inherit', cwd: destination })
    if (cracoResult.status != 0) {
      console.log(chalk.red(`Could not install craco.`))
      return
    }
    const packageJson = path.resolve(destination, 'package.json')
    const replaceOptions = {
      files: packageJson,
      from: [/react-scripts start/, /react-scripts build/, /react-scripts test/],
      to: ['craco start', 'craco build', 'craco test']
    }
    replace.sync(replaceOptions)

    const cracoConfig = `
const CracoItkPlugin = require("craco-itk")

module.exports = {
  plugins: [
    {
      plugin: CracoItkPlugin()
    }
  ]
}
`
    fs.writeFileSync(path.resolve(destination, 'craco.config.js'), cracoConfig)

    console.log(chalk.green(`${chalk.bold('Enjoy building your itk.js app!')}`))
  })
