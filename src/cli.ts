#!/usr/bin/env node

import { clone } from './clone';
import { push } from './push';

void (async () => {
  switch (process.argv[2]) {
    case 'init':
      push.init();
      break;
    case 'clone':
      if (process.argv.length < 4) {
        console.log('Clone requires a transaction id as an argument: ');
        console.log('\tbsvpush clone txid');
        process.exit(1);
      }
      const txid = process.argv[3];
      await clone.clone(txid);
      break;
    case 'help':
      console.log('Use one of the following:');
      console.log('\tbsvpush init');
      console.log('\tbsvpush clone txid');
      console.log('\tbsvpush push');
      break;
    case 'push':
    case undefined:
      try {
        await push.push();
      } catch (e) {
        console.log(e);
      }
      break;
  }
})();
