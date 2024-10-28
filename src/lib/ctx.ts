
export function get_dealer_ctx (
  seeds     : string[],
  share_ct  : number,
  threshold : number
) : DealerPackage {
  const share_pkg = create_share_pkg(seeds, threshold, share_ct)
  const group_pk  = share_pkg.group_pubkey
  const commits : CommitPackage[] = []
  const secrets : SecretPackage[] = [] 

  for (const share of share_pkg.sec_shares) {
    const { idx, seckey } = share
    const pubkey    = get_pubkey(seckey)
    const nonce_pkg = create_commit_pkg(share)
    const { binder_sn, hidden_sn } = nonce_pkg.secnonce
    const { binder_pn, hidden_pn } = nonce_pkg.pubnonce
    commits.push({ idx, binder_pn, hidden_pn, share_pk: pubkey })
    secrets.push({ idx, binder_sn, hidden_sn, share_sk: seckey })
  }

  return { commits, group_pk, secrets, threshold }
}
