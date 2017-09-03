# heroku-wp

# Warning

This is more than just a proof-of-concept, but it has not been tested by anyone else than me. Make sure to take a database backup of production database as well as a copy of the envirionment if you decide to try this out. Feel free to improve it too!

## Usage

You can install the package by running

```shell
heroku plugins:install heroku-wp

```

This package includes two commands:

* `heroku wp:fork`: Forks an existing WordPress application.
* `heroku wp:cli`: Wrapper for the wp-cli binary installed through composer.

### wp:fork

The command can be seen as an hybrid between `heroku fork` and review apps functionality. It enhances `heroku fork` by setting up the database on the forked app based on the database the fork is based from (with search and replace and WP ENV tweaking). It removes limitations from the review apps functionality so forked apps can be created from the user's local branch instead of being limited to GitHub Pull Requests.

Arguments:

* `--name (-n)`: Fork app name
* `--disable-scale-down`: By default forks will try to use minimal ressources and will not follow the parent application. Use `--disable-scale-down` if you want to uses the same configuration as the parent app.

The application uses a temporary local database to run the search and replace.

### wp:cli

The command is a single wrapper around wp-cli.

Example:

```shell
heroku wp:cli plugin list
```

Instead of having to specify the path to the wp-cli itself (unless it was added to $PATH):

```shell
heroku run ./vendor/bin/wp plugin list

```

## Limitations

App permissions

Remove auto idle apps

