import fs from 'fs/promises'

import logger from './logger.js'
import { DEBUG } from './flags.js'

const RE_NUMBER = /[\d]/
const RE_WHITESPACE = /(\s|\n)/
const RE_PUNCTUATION = /;/
const RE_IDENTIFIER = /[\w]/
const RE_OPERATORS = /(>|<|\+|-|\.|,)/
const RE_KEYWORDS = /(write|for|do)/

const tokenizer = (program) => {
  let tokens = []
  let current = 0
  let row = 1

  while (current < program.length) {
    let char = program[current]

    if (RE_WHITESPACE.test(char)) {
      current++

      if (char === '\n') {
        row++
      }

      continue
    }

    if (RE_PUNCTUATION.test(char)) {
      tokens.push({ type: 'punctuation', value: char })
      current++
      continue
    }

    if (RE_NUMBER.test(char)) {
      let value = ''

      while (RE_NUMBER.test(char)) {
        value += char
        char = program[++current]
      }

      tokens.push({ type: 'number', value })

      continue
    }

    if (RE_IDENTIFIER.test(char)) {
      let value = ''

      while (RE_IDENTIFIER.test(char)) {
        value += char
        char = program[++current]
      }

      if (RE_KEYWORDS.test(value)) {
        tokens.push({ type: 'keyword', value })
        continue
      }

      throw new Error(`Unknown identifier: '${value}' on line ${row}`)
    }

    if (RE_OPERATORS.test(char)) {
      let value = ''

      while (RE_OPERATORS.test(char)) {
        value += char
        char = program[++current]
      }

      tokens.push({ type: 'operation', value })
      continue
    }

    current++
  }

  return tokens
}

/**
 *
 * @param { any[] } tokens
 */
const parser = (tokens) => {
  const ast = {
    type: 'Program',
    body: [],
  }

  while (tokens.length > 0) {
    const indexOfPunctuation = tokens.findIndex(
      (token) => token.type === 'punctuation'
    )

    if (indexOfPunctuation === -1) {
      throw new Error('Missing semicolon at end of program')
    }

    const slice = tokens.slice(0, indexOfPunctuation)

    ast.body.push({
      type: 'Expression',
      body: slice,
    })

    tokens.splice(0, indexOfPunctuation + 1)
  }

  return ast
}

const BASE_CODE = `#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MAX_BUFFER_SIZE 512

typedef struct buffer
{
    int buffer[MAX_BUFFER_SIZE];
    int pointer;
} buffer_t;

typedef char *string_t;

buffer_t make_buffer()
{
    buffer_t buffer;

    for (int i = 0; i < MAX_BUFFER_SIZE; i++)
    {
        buffer.buffer[i] = 0;
    }

    buffer.pointer = 0;
    return buffer;
}

void clear_buffer(buffer_t *buffer)
{
    buffer->pointer = 0;

    for (int i = 0; i < MAX_BUFFER_SIZE; i++)
    {
        buffer->buffer[i] = 0;
    }
}

void write(buffer_t *buffer)
{
    for (int i = 0; i < buffer->pointer + 1; i++)
    {
        printf("%c", buffer->buffer[i] + 64);
    }

    printf("\\n");
}

void execute(buffer_t *buffer, string_t instructions)
{
    int instructions_length = strlen(instructions);

    for (int i = 0; i < instructions_length; i++)
    {
        switch (instructions[i])
        {
        case '>':
            buffer->pointer++;
            break;
        case '<':
            buffer->pointer--;
            break;
        case '+':
            buffer->buffer[buffer->pointer]++;
            break;
        case '-':
            buffer->buffer[buffer->pointer]--;
            break;
        case '.':
            write(buffer);
            break;
        case ',':
            clear_buffer(buffer);
        default:
            break;
        }
    }
}
`

const generateCode = (ast) => {
  const code = [BASE_CODE]
  const expressions = ast.body

  code.push(`int main(void) {`)
  code.push(`\tbuffer_t buffer = make_buffer();\n`)

  for (const expression of expressions) {
    const [firstToken, ...leftTokens] = expression.body

    if (firstToken.value == 'do') {
      const [operation] = leftTokens
      code.push(`\texecute(&buffer, "${operation.value}");`)
    }

    if (firstToken.value == 'for') {
      const [times, operation] = leftTokens
      code.push(
        `\tfor(int i = 0; i < ${times.value}; i++) {\n\t\texecute(&buffer, "${operation.value}");\n\t}\n\tbuffer.pointer++;\n`
      )
    }

    if (firstToken.value === 'write') {
      code.push(`\twrite(&buffer);`)
    }
  }

  code.push(`\treturn 0;`)
  code.push(`}`)

  return code.join('\n')
}

export function doCompile(program) {
  logger.info('Generating tokens...')
  const tokens = tokenizer(program)

  if (DEBUG) {
    fs.writeFile('representation/tokens.json', JSON.stringify(tokens, null, 2))
  }

  logger.info('Generating AST...')
  const ast = parser(tokens)

  if (DEBUG) {
    fs.writeFile('representation/ast.json', JSON.stringify(ast, null, 2))
  }

  logger.info('Generating code...')
  return generateCode(ast)
}
