'use strict';

const shell = require('shelljs');

let falseErrors = [
  'Couldn\'t find that app'
];

function stringInFalseErrors(string) {
  let isMatch = false;

  falseErrors.forEach(function(message) {
    let regex = new RegExp(message);
    if (string.match(regex)) {
      isMatch = true;
    }
  });

  return isMatch;
}

function exec(command) {
  let output = shell.exec(command, {silent:true});

  if (output.code !== 0) {
    shell.echo(`Error while running ${command}: ${output.stderr}`);
    return output.stderr.trim();
  } else {
    return output.stdout.trim();
  }
}

function logAndExec(command) {
  console.log(`>>> Executing: ${command}`);
  return exec(command);
}

function exitIfProjectDependenciesNotMet(dependencies) {
  dependencies.forEach(function(app) {
    if (!shell.which(app)) {
      shell.echo(`Error: ${app} not found`);
      shell.exit(1);
    }
  });
}

module.exports = {
  logAndExec,
  exec,
  exitIfProjectDependenciesNotMet
}
