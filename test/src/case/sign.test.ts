import { Test }       from 'tape'
import { get_pubkey } from '@cmdcode/frost/lib'
import { FrostNode }  from '@frostr/bifrost'

const TIMEOUT = 6000

const ECDH_SECKEY = '9e1aa53570f21eb33373b526853b409bb735d085b0238326d3014dbdd39cbcb0'
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY)
const ECDH_TARGET = '0272af2dea337c5c214f5f0934ec32257312da1889e40f3fd95fec9913f1db2ceb'

export default async function (
  tape  : Test,
  nodes : FrostNode[]
) {

  const [ Alice ] = nodes

  return new Promise<void>(resolve => {

    tape.test('ECDH test', t => {

      const timer = setTimeout(() => {
        t.fail('timed out!')
        t.end()
        resolve()
      }, TIMEOUT)

      const peers = Alice.peers

      Alice.req_sig(peers, ECDH_PUBKEY).then(response => {
        clearTimeout(timer)
        t.equal(response, ECDH_TARGET, 'response does not match target')
        t.end()
        resolve()
      })
    })
  })
}
