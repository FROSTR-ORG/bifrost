import type { Test } from 'tape'

import type {
  BifrostNode,
  GroupPackage
} from '@frostr/bifrost'

export type TestNodeMap = Map<string, BifrostNode>

export interface TestGroupPackage {
  group  : GroupPackage
  nodes  : TestNodeMap
}

export interface TestGroupContext extends TestGroupPackage {
  relays : string[]
  tape   : Test
}

export interface TestGroupVector {
  group  : string
  shares : [ label : string, share : string ][]
}
