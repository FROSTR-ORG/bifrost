import generate_group   from '@/test/gen/group.vec.js'
import generate_session from '@/test/gen/session.vec.js'

const group   = generate_group()
const session = generate_session()

console.log(JSON.stringify(group, null, 2))
console.log(JSON.stringify(session, null, 2))
