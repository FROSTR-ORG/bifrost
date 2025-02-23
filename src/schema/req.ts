// import { z } from 'zod'
// import base  from './base.js'

// const base_req = z.object({
//   idx     : base.num,
//   members : base.num.array()
// })

// const ecdh_req = base_req.extend({
//   ecdh_pk  : base.hex32,
//   keyshare : base.hex
// })

// const psig_req = base_req.extend({
//   message : base.str,
// })

// export default {
//   ecdh_req,
//   psig_req
// }