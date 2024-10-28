import type {
  BifrostNode,
  GroupPackage,
  SessionCommit,
  SessionMember,
  SessionPackage,
  SharePackage
} from '@frostr/bifrost'

export type Membership  = SessionMember & SessionCommit
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
  session : SessionPackage
}
