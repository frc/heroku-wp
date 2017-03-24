'use strict';

const cli = require('heroku-cli-util');
const co = require('co');
const shell = require('shelljs');
const tmp = require('tmp');
const parseDbUrl = require('parse-database-url');

let flags = require('../util/flags');
let logAndExec = require('../util/functions').logAndExec;
let exec = require('../util/functions').exec;
let exitIfProjectDependenciesNotMet = require('../util/functions').exitIfProjectDependenciesNotMet;

let appRegion = 'eu';

module.exports = {
  topic: 'wp',
  command: 'fork',
  description: '',
  help: '',
  needsApp: true,
  needsAuth: true,
  flags: flags,
  run: cli.command(co.wrap(app))
}

function* app (context, heroku) {
  exitIfProjectDependenciesNotMet(['curl', 'heroku', 'git', 'mysql', 'mysqldump', 'php']);

  let appParentName = context.app;
  let appForkName = context.flags.name;

  exitIfAppDoesAlreadyExist(appForkName);

  createFork(appParentName, appForkName);
  replaceJawsForClearDbIfJawsIsInitializing(appForkName, heroku);
  pushLocalBranchToFork(appForkName);
  fixWordPressEnvironment(appForkName, heroku);
  yield deployDatabaseToFork(appParentName, appForkName, heroku);
  discourageSearchEngineVisibility(appForkName);

  if (!context.flags['disable-scale-down']) {
    scaleDownAppDynos(appForkName);
  }

  shell.echo(`\nYour app now available at https://${appForkName}.herokuapp.com\n`);
}

function exitIfAppDoesAlreadyExist(appName) {
  let command = `heroku apps:info --app ${appName}`;
  let commandOutput = logAndExec(command);

  if (!commandOutput.match(/Couldn't find that app./)) {
    shell.echo('App already exists or you do not have access to the app. Exiting.');
    shell.exit(1);
  }
}

function createFork(from, to) {
  let command = `heroku fork --from ${from} --to ${to} --region ${appRegion}`;
  logAndExec(command);
}

function* replaceJawsForClearDbIfJawsIsInitializing(appName, heroku) {
  let forkAppConfig = yield getConfigVars(heroku, appName);

  if (!forkAppConfig) return;
  if (!forkAppConfig.JAWSDB_URL) return;

  let dbObject = parseDbUrl(forkAppConfig.JAWSDB_URL);

  if (!dbObject) return;
  if (dbObject.driver !== 'mysql') return;

  shell.echo(`Remove jawsdb addon from app ${appName}`);
  let command = `heroku addons:destroy jawsdb --app ${appName}`;
  let commandOutput = logAndExec(command);

  // There might be weird cases where an app would have both JawsDB AND ClearDB
  // if this is the case do not create a new addon
  if (forkAppConfig.CLEARDB_DATABASE_URL) return;

  shell.echo(`Attach new cleardb:punch for app ${appName}`);
  command = `heroku addons:create cleardb:punch --app ${appName}`;
  commandOutput = logAndExec(command);
}

function pushLocalBranchToFork(appName) {
  // TODO add to remote?
  //git push https://git.heroku.com/wp-themosis-test-staging-fork.git feature/more_printing_in_functions:master
  let currentBranch = getGitBranchName();
  let pushCommand = `git push https://git.heroku.com/${appName}.git ${currentBranch}:master`;
  let output = logAndExec(pushCommand);
}

function getGitBranchName() {
  let command = `git symbolic-ref --short HEAD`;
  let output = logAndExec(command);

  if (output.startsWith("fatal")) {
    shell.echo(`Error: could not find a git repository in current directory`);
    shell.exit(1);
  }
  return output;
}

function fixWordPressEnvironment(appName, heroku) {
  console.log('>>> Adjust env vars WP_HOME, WP_SITEURL and WP_ENV');
  let home_url = `https://${appName}.herokuapp.com`;
  let payload = {
    WP_HOME: home_url,
    WP_SITEURL: `${home_url}/wp`,
    WP_ENV: 'development'
  };

  heroku.patch(`/apps/${appName}/config-vars`, { body: payload });
}

function* deployDatabaseToFork(appParentName, appForkName, heroku) {
  let tmpDir = createTemporaryDirectory();
  console.log(`>>> Temporary directory created at ${tmpDir}`);

  let parentAppDbObject = yield getDatabaseObject(heroku, appParentName);
  takeDbDumpToTemporaryDirectory(parentAppDbObject, tmpDir);

  let localTmpDbName = "wpsync" + Date.now();
  installDumpToLocalMysql(tmpDir, localTmpDbName);

  let searchString = yield getConfigVar(heroku, appParentName, 'WP_HOME');
  let replaceString = yield getConfigVar(heroku, appForkName, 'WP_HOME');
  if (searchString && replaceString) {
    runSearchAndReplace(tmpDir, localTmpDbName, searchString, replaceString);
  }

  let forkAppDbObject = yield getDatabaseObject(heroku, appForkName);
  deployToNewMysql(localTmpDbName, tmpDir, forkAppDbObject);
  dropTemporaryLocalMysqlDatabase(localTmpDbName);
}

function createTemporaryDirectory() {
  return tmp.dirSync().name;
}

function* getDatabaseObject(heroku, appName) {
  let appConfig = yield getConfigVars(heroku, appName);

  let dbObject;

  if (appConfig.CLEARDB_DATABASE_URL) {
    dbObject = parseDbUrl(appConfig.CLEARDB_DATABASE_URL);
  } else if (appConfig.JAWSDB_URL) {
    dbObject = parseDbUrl(appConfig.JAWSDB_URL);
  }

  if (!dbObject || dbObject.driver !== 'mysql') {
    shell.echo('mysql database not found');
    shell.exit(1);
  }

  return dbObject;
}

function takeDbDumpToTemporaryDirectory(dbObject, tmpDir) {
  let command = `mysqldump -v -u${dbObject.user} -p${dbObject.password} -h${dbObject.host} ${dbObject.database} > ${tmpDir}/dump.sql`;
  logAndExec(command);
}

function installDumpToLocalMysql(tmpDir, localTmpDbName) {
  let command = `mysql -uroot -e "create database ${localTmpDbName}"`;
  logAndExec(command);
  command = `mysql -uroot ${localTmpDbName} < ${tmpDir}/dump.sql`;
  logAndExec(command);
}

function runSearchAndReplace(tmpDir, localTmpDbName, searchString, replaceString) {
  console.log(">>> Downloading Search-Replace-DB files");
  exec(`curl -fsS https://raw.githubusercontent.com/interconnectit/Search-Replace-DB/f42c62c6427eba78f2ecb9e9f1c00afea0a835a8/srdb.class.php -o ${tmpDir}/srdb.class.php`);
  exec(`curl -fsS https://raw.githubusercontent.com/interconnectit/Search-Replace-DB/f42c62c6427eba78f2ecb9e9f1c00afea0a835a8/srdb.cli.php -o ${tmpDir}/srdb.cli.php`);

  console.log(">>> Run Search-Replace-DB script");
  logAndExec(`php ${tmpDir}/srdb.cli.php -u root -p '' -h localhost -n ${localTmpDbName} -s ${searchString} -r ${replaceString}`);
}

function deployToNewMysql(dbName, tmpDir, dbObject) {
  let command = `mysqldump -uroot ${dbName} > ${tmpDir}/new_dump.sql`;
  logAndExec(command);

  command = `mysql -u${dbObject.user} -p${dbObject.password} -h${dbObject.host} ${dbObject.database} < ${tmpDir}/new_dump.sql`;
  let commandOutput = logAndExec(command);
  console.log(commandOutput);
}

function dropTemporaryLocalMysqlDatabase(localTmpDbName) {
  let command = `mysql -uroot -e "drop database ${localTmpDbName}"`;
  logAndExec(command);
}

function discourageSearchEngineVisibility(appName) {
  shell.echo(`Discourage search engine visibility for Heroku app ${appName}`);
  let command = `heroku wp:cli option set blog_public 0 --app ${appName}`;
  let commandOutput = logAndExec(command);
}

function scaleDownAppDynos(appName) {
  let command = `heroku ps:scale web=1:standard-1x --app ${appName}`;
  logAndExec(command);
}

function* getConfigVar(heroku, appName, environmentKey) {
  let appConfig = yield getConfigVars(heroku, appName);
  if (!appConfig || !appConfig[environmentKey]) {
    return false;
  }

  return appConfig[environmentKey];
}

function getConfigVars(heroku, appName) {
  return heroku.get(`/apps/${appName}/config-vars`);
}
