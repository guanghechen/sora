import { chalk, chalkStderr } from '../src/node'

console.log(`${chalk.hex('#ff6159')('testout')} ${chalkStderr.hex('#ff6159')('testerr')}`)
