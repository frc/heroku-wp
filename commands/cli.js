'use strict';

const cli = require('heroku-cli-util');
const co = require('co');

let exec = require('../util/functions').exec;
let exitIfProjectDependenciesNotMet = require('../util/functions').exitIfProjectDependenciesNotMet;

module.exports = {
  topic: 'wp',
  command: 'cli',
  description: '',
  help: '',
  needsApp: true,
  needsAuth: true,
  variableArgs: true,
  run: cli.command(co.wrap(app))
}

function* app (context, heroku) {
  exitIfProjectDependenciesNotMet(['heroku']);

  let app = context.app;
  let args = context.args.join(' ');

  let command = `heroku run --app ${app} 'if [ -d "bedrock-on-heroku" ]; then ./bedrock-on-heroku/vendor/bin/wp ${args}; else ./vendor/bin/wp ${args}; fi'`;
  console.log(exec(command));
}
