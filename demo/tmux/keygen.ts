/**
 * FROSTR Demo - Key Generation
 *
 * Generates group credentials (GroupPackage + SharePackages + OnboardPackages)
 * for the demo suite.
 *
 * Usage:
 *   npm run demo:keygen              # Generate 2-of-3 (default)
 *   npm run demo:keygen -- --fresh   # Force regenerate
 *   npm run demo:keygen -- -t 3 -n 5 # Custom threshold
 */

import {
  print_banner,
  parse_args,
  colors,
  log_info,
  log_success,
  log_error,
  log_warn,
  format_pubkey,
  ensure_data_dir,
  credentials_exist,
  save_group,
  save_share,
  save_onboard,
  create_deterministic_secrets,
  DEFAULT_MEMBERS,
  DEMO_RELAY_URL
} from './shared.js'

import { generate_dealer_package } from '@/lib/package.js'
import { get_pubkey }              from '@/util/crypto.js'
import { encode_onboard_package }  from '@/encoder/onboard.js'
import { encode_group_package }    from '@/encoder/group.js'
import { encode_share_package }    from '@/encoder/share.js'

import type { OnboardPackage } from '@/types/index.js'

/* ================ [ Main ] ================ */

async function main () {
  print_banner('FROSTR Demo - Key Generation')
  console.log()

  // Parse arguments
  const args = parse_args()

  const threshold = Number(args.get('t') ?? args.get('threshold') ?? 2)
  const count     = Number(args.get('n') ?? args.get('count') ?? 3)
  const fresh     = args.has('fresh')

  // Validate
  if (threshold < 2) {
    log_error('Threshold must be at least 2')
    process.exit(1)
  }

  if (count < threshold) {
    log_error(`Count (${count}) must be >= threshold (${threshold})`)
    process.exit(1)
  }

  if (count > DEFAULT_MEMBERS.length) {
    log_error(`Count (${count}) exceeds available names (${DEFAULT_MEMBERS.length})`)
    process.exit(1)
  }

  // Check existing credentials
  if (credentials_exist() && !fresh) {
    log_warn('Credentials already exist. Use --fresh to regenerate.')
    process.exit(0)
  }

  // Get member names for this group
  const names = DEFAULT_MEMBERS.slice(0, count)

  log_info(`Generating ${threshold}-of-${count} group...`)
  log_info(`Members: ${names.join(', ')}`)
  console.log()

  // Create deterministic secrets from names
  const secrets = await create_deterministic_secrets(names)

  // Generate the dealer package
  const pkg = generate_dealer_package(threshold, count, secrets)

  // Save group
  ensure_data_dir()
  save_group(pkg.group)
  log_success('Saved group.json')

  // Save shares and generate onboard packages
  const onboard_strings : string[] = []

  for (let i = 0; i < pkg.shares.length; i++) {
    const name  = names[i]
    const share = pkg.shares[i]

    // Save share
    save_share(name, share)
    log_success(`Saved share-${name}.json`)

    // Get peer pubkey for onboarding (use first other member)
    // For alice, use bob's pubkey. For bob, use alice's pubkey, etc.
    const peer_idx = i === 0 ? 1 : 0
    const peer_share = pkg.shares[peer_idx]
    const peer_pk = get_pubkey(peer_share.seckey, 'bip340')

    // Create onboard package
    const onboard : OnboardPackage = {
      share   : share,
      peer_pk : peer_pk,
      relays  : [ DEMO_RELAY_URL ]
    }

    // Save onboard package
    save_onboard(name, onboard)
    log_success(`Saved onboard-${name}.json`)

    // Encode for display
    const encoded = encode_onboard_package(onboard)
    onboard_strings.push(encoded)
  }

  // Summary
  console.log()
  console.log(`${colors.bold}═══════════════════════════════════════════${colors.reset}`)
  console.log(`${colors.bold} Summary${colors.reset}`)
  console.log(`${colors.bold}═══════════════════════════════════════════${colors.reset}`)
  console.log()
  console.log(`  Group pubkey: ${colors.cyan}${format_pubkey(pkg.group.group_pk)}${colors.reset}`)
  console.log(`  Threshold:    ${threshold}-of-${count}`)
  console.log(`  Members:      ${names.join(', ')}`)
  console.log()

  // Encoded packages
  console.log(`${colors.bold}Encoded Packages${colors.reset}`)
  console.log()

  const group_encoded = encode_group_package(pkg.group)
  console.log(`  Group: ${colors.dim}${group_encoded.slice(0, 40)}...${colors.reset}`)
  console.log()

  for (let i = 0; i < names.length; i++) {
    const share_encoded = encode_share_package(pkg.shares[i])
    console.log(`  ${names[i]}:`)
    console.log(`    Share:   ${colors.dim}${share_encoded.slice(0, 40)}...${colors.reset}`)
    console.log(`    Onboard: ${colors.dim}${onboard_strings[i].slice(0, 40)}...${colors.reset}`)
    console.log()
  }

  // Member pubkeys
  console.log(`${colors.bold}Member Pubkeys${colors.reset}`)
  console.log()

  for (let i = 0; i < pkg.group.members.length; i++) {
    const member = pkg.group.members[i]
    const name = names[i]
    const pk = get_pubkey(pkg.shares[i].seckey, 'bip340')
    console.log(`  ${name} (idx=${member.idx}):`)
    console.log(`    ECDSA:  ${colors.dim}${format_pubkey(member.pubkey)}${colors.reset}`)
    console.log(`    BIP340: ${colors.dim}${format_pubkey(pk)}${colors.reset}`)
    console.log()
  }

  // Usage hints
  console.log(`${colors.bold}Next Steps${colors.reset}`)
  console.log()
  console.log(`  1. Start the relay:`)
  console.log(`     ${colors.cyan}npm run demo:relay${colors.reset}`)
  console.log()
  console.log(`  2. Start nodes in separate terminals:`)
  for (const name of names) {
    console.log(`     ${colors.cyan}npm run demo:${name}${colors.reset}`)
  }
  console.log()
  console.log(`  3. Or test onboarding:`)
  console.log(`     ${colors.cyan}npm run demo:onboard -- --name ${names[names.length - 1]}${colors.reset}`)
  console.log()
}

main().catch(err => {
  log_error('Fatal error:', err)
  process.exit(1)
})
