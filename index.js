exports.topic = {
  name: 'wp',
  description: ''
}

exports.commands = [
  require('./commands/fork.js'),
  require('./commands/cli.js')
]
