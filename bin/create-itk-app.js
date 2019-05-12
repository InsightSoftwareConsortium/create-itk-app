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
const editJsonFile = require("edit-json-file")
const simpleGit = require('simple-git')

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
  },
  {
    type: 'input',
    name: 'homepage',
    default (answers) {
      return `https://github.com/${answers.user}/${answers.repo}`
    },
    message: 'Homepage:',
    when: !program.homepage
  },
]

console.log(chalk.blue('\nLet\'s create a itk.js app!\n\nHit enter to accept the suggestion.\n'))

inquirer.prompt(prompts)
  .then(answers => {
    answers.author = stringifyAuthor({
      name: program.author || answers.author,
      email: program.email || answers.email
    })
    answers.appName = program.appName || answers.appName
    answers.description = program.desc || answers.description
    answers.user = program.user || answers.user
    answers.repo = program.repo || answers.repo
    answers.homepage = program.homepage || answers.homepage

    console.log(chalk.blue('\nCreating React app!'))
    const craResult = spawn.sync('npx', ['create-react-app', destination], { stdio: ['ignore', 'inherit', 'inherit'] })
    if (craResult.status != 0) {
      console.log(chalk.red(`Could not run create-react-app.`))
      return
    }


    console.log(chalk.blue('\nSetting up craco...'))
    const cracoResult = spawn.sync('npm', ['install', '--save', '--silent',
      '@craco/craco',
      'craco-itk', 'itk',
      'craco-vtk', 'vtk.js', 'shader-loader', 'worker-loader'
      ],
      { stdio: 'inherit', cwd: destination }
    )
    if (cracoResult.status != 0) {
      console.log(chalk.red(`Could not install craco.`))
      return
    }

    const packageJson = path.resolve(destination, 'package.json')
    const editPackageJson = editJsonFile(packageJson)
    editPackageJson.set("name", answers.appName)
    editPackageJson.set("author", answers.author)
    editPackageJson.set("description", answers.description)
    editPackageJson.set("keywords", ['itk.js'])
    editPackageJson.set("license", ['Apache-2.0'])
    editPackageJson.set("repository", answers.repository)
    editPackageJson.set("homepage", answers.homepage)
    editPackageJson.set("scripts.start", "craco start")
    editPackageJson.set("scripts.build", "craco build")
    editPackageJson.set("scripts.test", "craco test")
    editPackageJson.set("repository.type", "git")
    editPackageJson.set("repository.url", `git+https://github.com/${answers.user}/${answers.repo}.git`)
    editPackageJson.save()


    const cracoConfig = `
const CracoItkPlugin = require("craco-itk")
const CracoVtkPlugin = require("craco-vtk")

module.exports = {
  plugins: [
    {
      plugin: CracoItkPlugin()
    },
    {
      plugin: CracoVtkPlugin()
    }
  ]
}
`
    fs.writeFileSync(path.resolve(destination, 'craco.config.js'), cracoConfig)

const appJs = `
import React, { Component } from 'react';
import './App.css';

import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkTubeFilter from 'vtk.js/Sources/Filters/General/TubeFilter';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';
import { VtkDataTypes } from 'vtk.js/Sources/Common/Core/DataArray/Constants';

class App extends Component {
  constructor(props) {
    super(props);

    this.fullScreenRenderer = null;
    this.container = React.createRef();
    this.pipeline = null;
  }

  createPipeline(resolution = 20) {
    const sphereSource = vtkSphereSource.newInstance({ radius: 1.5, thetaResolution: resolution, phiResolution: resolution });

    const atomColorR = 0.380
    const atomColorG = 0.855
    const atomColorB = 0.984

    const sphereMapper = vtkMapper.newInstance();
    sphereMapper.setInputConnection(sphereSource.getOutputPort());

    const sphereActor = vtkActor.newInstance();
    sphereActor.setMapper(sphereMapper);
    sphereActor.getProperty().setColor(atomColorR, atomColorG, atomColorB)


    const numberOfSegments = resolution;
    let pointType = VtkDataTypes.FLOAT;
    const tubeRadius = 5.0;

    const polyDataXY = vtkPolyData.newInstance();
    const pointsXY = vtkPoints.newInstance({ dataType: pointType });
    pointsXY.setNumberOfPoints(numberOfSegments + 1);
    const pointDataXY = new Float32Array(3 * (numberOfSegments + 1));
    const vertsXY = new Uint32Array(2 * (numberOfSegments + 1));
    const linesXY = new Uint32Array(numberOfSegments + 2);
    linesXY[0] = numberOfSegments + 1;

    for (let i = 0; i < numberOfSegments + 1; i++) {
      for (let j = 0; j < 3; j++) {
        const angle = i / (numberOfSegments - 1) * 2.0 * Math.PI;
        pointDataXY[3 * i + 0] = tubeRadius * Math.cos(angle);
        pointDataXY[3 * i + 1] = tubeRadius * Math.sin(angle);
        pointDataXY[3 * i + 2] = 0.0;
      }
      vertsXY[i] = 1;
      vertsXY[i + 1] = i;
      linesXY[i + 1] = i;
    }
    pointsXY.setData(pointDataXY);
    polyDataXY.setPoints(pointsXY);
    polyDataXY.getVerts().setData(vertsXY);
    polyDataXY.getLines().setData(linesXY);

    const tubeFilterXY = vtkTubeFilter.newInstance();
    tubeFilterXY.setCapping(false);
    tubeFilterXY.setNumberOfSides(resolution);
    tubeFilterXY.setRadius(0.5);

    tubeFilterXY.setInputData(polyDataXY);

    const polyDataMapperXY = vtkMapper.newInstance();
    polyDataMapperXY.setInputData(polyDataXY);

    const polyDataActorXY = vtkActor.newInstance();
    polyDataActorXY.setMapper(polyDataMapperXY)

    const tubeMapperXY = vtkMapper.newInstance();
    tubeMapperXY.setInputConnection(tubeFilterXY.getOutputPort());

    const tubeActorXY = vtkActor.newInstance();
    tubeActorXY.setMapper(tubeMapperXY)
    tubeActorXY.getProperty().setColor(atomColorR, atomColorG, atomColorB)

    const polyDataXZ = vtkPolyData.newInstance();
    const pointsXZ = vtkPoints.newInstance({ dataType: pointType });
    pointsXZ.setNumberOfPoints(numberOfSegments + 1);
    const pointDataXZ = new Float32Array(3 * (numberOfSegments + 1));
    const vertsXZ = new Uint32Array(2 * (numberOfSegments + 1));
    const linesXZ = new Uint32Array(numberOfSegments + 2);
    linesXZ[0] = numberOfSegments + 1;

    for (let i = 0; i < numberOfSegments + 1; i++) {
      for (let j = 0; j < 3; j++) {
        const angle = i / (numberOfSegments - 1) * 2.0 * Math.PI;
        pointDataXZ[3 * i + 0] = tubeRadius * Math.cos(angle);
        pointDataXZ[3 * i + 1] = 0.0;
        pointDataXZ[3 * i + 2] = tubeRadius * Math.sin(angle);
      }
      vertsXZ[i] = 1;
      vertsXZ[i + 1] = i;
      linesXZ[i + 1] = i;
    }
    pointsXZ.setData(pointDataXZ);
    polyDataXZ.setPoints(pointsXZ);
    polyDataXZ.getVerts().setData(vertsXZ);
    polyDataXZ.getLines().setData(linesXZ);

    const tubeFilterXZ = vtkTubeFilter.newInstance();
    tubeFilterXZ.setCapping(false);
    tubeFilterXZ.setNumberOfSides(resolution);
    tubeFilterXZ.setRadius(0.5);

    tubeFilterXZ.setInputData(polyDataXZ);

    const polyDataMapperXZ = vtkMapper.newInstance();
    polyDataMapperXZ.setInputData(polyDataXZ);

    const polyDataActorXZ = vtkActor.newInstance();
    polyDataActorXZ.setMapper(polyDataMapperXZ)

    const tubeMapperXZ = vtkMapper.newInstance();
    tubeMapperXZ.setInputConnection(tubeFilterXZ.getOutputPort());

    const tubeActorXZ = vtkActor.newInstance();
    tubeActorXZ.setMapper(tubeMapperXZ)
    tubeActorXZ.getProperty().setColor(atomColorR, atomColorG, atomColorB)

    const polyDataYZ = vtkPolyData.newInstance();
    const pointsYZ = vtkPoints.newInstance({ dataType: pointType });
    pointsYZ.setNumberOfPoints(numberOfSegments + 1);
    const pointDataYZ = new Float32Array(3 * (numberOfSegments + 1));
    const vertsYZ = new Uint32Array(2 * (numberOfSegments + 1));
    const linesYZ = new Uint32Array(numberOfSegments + 2);
    linesYZ[0] = numberOfSegments + 1;

    for (let i = 0; i < numberOfSegments + 1; i++) {
      for (let j = 0; j < 3; j++) {
        const angle = i / (numberOfSegments - 1) * 2.0 * Math.PI;
        pointDataYZ[3 * i + 0] = 0.0;
        pointDataYZ[3 * i + 1] = tubeRadius * Math.cos(angle);
        pointDataYZ[3 * i + 2] = tubeRadius * Math.sin(angle);
      }
      vertsYZ[i] = 1;
      vertsYZ[i + 1] = i;
      linesYZ[i + 1] = i;
    }
    pointsYZ.setData(pointDataYZ);
    polyDataYZ.setPoints(pointsYZ);
    polyDataYZ.getVerts().setData(vertsYZ);
    polyDataYZ.getLines().setData(linesYZ);

    const tubeFilterYZ = vtkTubeFilter.newInstance();
    tubeFilterYZ.setCapping(false);
    tubeFilterYZ.setNumberOfSides(resolution);
    tubeFilterYZ.setRadius(0.5);

    tubeFilterYZ.setInputData(polyDataYZ);

    const polyDataMapperYZ = vtkMapper.newInstance();
    polyDataMapperYZ.setInputData(polyDataYZ);

    const polyDataActorYZ = vtkActor.newInstance();
    polyDataActorYZ.setMapper(polyDataMapperYZ)

    const tubeMapperYZ = vtkMapper.newInstance();
    tubeMapperYZ.setInputConnection(tubeFilterYZ.getOutputPort());

    const tubeActorYZ = vtkActor.newInstance();
    tubeActorYZ.setMapper(tubeMapperYZ)
    tubeActorYZ.getProperty().setColor(atomColorR, atomColorG, atomColorB)

    return { sphereMapper, sphereActor, tubeActorXY, tubeMapperXY, tubeActorXZ, tubeMapperXZ, tubeActorYZ, tubeMapperYZ };
  }

  updatePipeline() {
    const renderer = this.fullScreenRenderer.getRenderer();
    const renderWindow = this.fullScreenRenderer.getRenderWindow();

    if (this.pipeline) {
      renderer.removeActor(this.pipeline.actor);
      this.pipeline = null;
    }

    const resolution = this.props.resolution || 40
    this.pipeline = this.createPipeline(resolution);
    const pipeline = this.pipeline
    renderer.addActor(pipeline.sphereActor);
    renderer.addActor(pipeline.tubeActorXY);
    renderer.addActor(pipeline.tubeActorXZ);
    renderer.addActor(pipeline.tubeActorYZ);
    renderer.resetCamera();
    renderWindow.render();

    const camera = renderer.getActiveCamera();
    camera.elevation(30.)
    camera.azimuth(30.)

    setInterval(function() {
      pipeline.tubeActorXY.rotateX(2.)
      pipeline.tubeActorXZ.rotateZ(3.)
      pipeline.tubeActorYZ.rotateY(5.)
      renderWindow.render();
    }, 100)

    window.pipeline = this.pipeline;

    renderWindow.render();
  }

  componentDidMount() {
    this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      background: [0.157, 0.172, 0.204],
      rootContainer: this.container.current,
      containerStyle: {},
    });
    this.updatePipeline();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resolution !== this.props.resolution) {
      this.updatePipeline();
    }
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <div ref={this.container} />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://insightsoftwareconsortium.github.io/itk-js/docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn itk.js
          </a>
          <a
            className="App-link"
            href="https://kitware.github.io/vtk-js/docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn vtk.js
          </a>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header>
      </div>
    );
  }
}

export default App;
`
    fs.writeFileSync(path.resolve(destination, 'src', 'App.js'), appJs)

    const git = simpleGit(destination)
    git.add(['craco.config.js', 'package.json', 'package-lock.json', 'src/App.js'])
    git.commit('Updates from Create ITK App')

    console.log(chalk.green(`${chalk.bold('Enjoy building your itk.js app!')}`))
  })
