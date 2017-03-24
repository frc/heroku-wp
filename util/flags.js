
let forkName = {
  name: 'name',
  char: 'n',
  description: 'fork name',
  hasValue: true,
  required: true
};

let disableScaleDown = {
  name: 'disable-scale-down',
  description: 'disable scale down',
  hasValue: false,
  required: false
};

module.exports = [
  forkName,
  disableScaleDown
];
