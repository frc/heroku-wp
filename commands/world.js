module.exports = {
  topic: 'wp',
  command: 'fork',
  description: '',
  help: '',
  flags: [
    {
        name: 'name',
        char: 'n',
        description: 'fork name',
        hasValue: true,
        required: true
    }
  ],
  run: function (context) {
    if (context.flags.name) {
        console.log(`Hello ${context.flags.name}`);
    } else {
        console.log('Hello, World!')
    }
  }
}
