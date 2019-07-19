#!/usr/bin/env node

import commandLineArgs from 'command-line-args';

import { push } from './push';

(async () => {
  const mainDefinitions = [
    { name: 'command', defaultOption: true }
  ];
  const mainOptions = commandLineArgs(mainDefinitions, { stopAtFirstUnknown: true });
  const argv = mainOptions._unknown || [];
  switch (mainOptions.command) {
    case 'init': 
      push.init();
      break;
    case 'push':
    case undefined:
      await push.push();
      break;
  }
})()