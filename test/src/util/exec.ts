import { exec } from 'node:child_process'

export default async function <T = string> (cmd : string) : Promise<T> {
  return new Promise((res, rej) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error !== null) {
        rej(error)
      } else if (typeof stderr === 'string' && stderr.length !== 0) {
        rej(stderr)
      } else {
        res(parser(stdout))
      }
    })
  })
}

function parser (data : unknown) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return data as string
    }
  } else {
    throw new Error('unknown data type: ' + String(data))
  }
}
