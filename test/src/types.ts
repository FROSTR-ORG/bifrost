import type {
  BifrostNode,
  GroupPackage,
  SharePackage,
  SignSessionCommit,
  SignSessionMember,
  SignSessionPackage
} from '@frostr/bifrost'

export type Membership  = SignSessionMember & SignSessionCommit
export type TestNodeMap = Map<string, BifrostNode>

export interface TestNodes {
  group  : GroupPackage
  nodes  : TestNodeMap
}

export interface TestNetwork extends TestNodes {
  relays : string[]
}

export interface GroupVector {
  group   : GroupPackage
  shares  : SharePackage[]
  seeds   : string[]
}

export interface SessionVector extends GroupVector {
  members : Membership[]
  session : SignSessionPackage
}
