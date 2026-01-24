import type {
  BifrostNode,
  GroupPackage,
  SharePackage,
  SighashCommit,
  SighashShare,
  SignSessionPackage
} from '@/index.js'

export type TestNodeMap = Map<string, BifrostNode>

export interface TestNodes {
  group  : GroupPackage
  nodes  : TestNodeMap
}

export interface TestNetwork extends TestNodes {
  relays : string[]
}

export interface GroupTestVector {
  group   : GroupPackage
  shares  : SharePackage[]
  seeds   : string[]
}

export interface SessionTestVector extends GroupTestVector {
  session     : SignSessionPackage
  sig_commits : SighashCommit[]
  sig_shares  : SighashShare[]
}
