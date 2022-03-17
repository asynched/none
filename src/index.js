import * as fs from 'fs/promises'
import { promisify } from 'util'
import { exec } from 'child_process'

import logger from './logger.js'
import * as compiler from './compiler.js'
import { DEBUG } from './flags.js'

const execAsync = promisify(exec)

const main = async (...args) => {
  const filePath = args.slice(2)[0]

  logger.info('Reading source file...')
  const file = await fs.readFile(filePath, 'utf8').then((f) => f.toString())

  logger.info('Compiling...')
  const code = compiler.doCompile(file)

  logger.info('Writing output...')

  const outputIntermediateFilePath = `${filePath}.c`
  await fs.writeFile(outputIntermediateFilePath, code)

  logger.info('Generating binary executable...')
  await execAsync(
    `gcc ${filePath}.c -O3 -o ${filePath.replace('.none', '.out')}`
  )

  if (!DEBUG) {
    logger.info('Removing artifacts...')
    await fs.rm(outputIntermediateFilePath)
  }

  logger.success('Done!')
}

main(...process.argv)
