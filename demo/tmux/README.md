# FROSTR Demo Suite

An interactive CLI demo suite that showcases the FROSTR threshold signing protocol. Run multiple nodes in separate terminals and execute protocol operations in real-time.

## Quick Start

### 1. Generate Credentials

Generate the group credentials (group package, share packages, and onboard packages):

```bash
npm run demo:keygen
```

This creates a 2-of-3 threshold group by default with members: alice, bob, carol.

**Options:**
- `--fresh` - Force regenerate credentials
- `-t <N>` - Set threshold (default: 2)
- `-n <N>` - Set member count (default: 3)

Example: Create a 3-of-5 group:
```bash
npm run demo:keygen -- -t 3 -n 5
```

### 2. Launch the Demo

#### Option A: tmux (Recommended)

Launch everything with a single command:

```bash
npm run demo
```

This opens a new terminal window with a 4-pane tmux layout (relay + alice/bob/carol). Close the terminal window to stop - cleanup is automatic.

#### Option B: Manual (4 Terminals)

**Terminal 1 - Relay:**
```bash
npm run demo:relay
```

**Terminal 2 - Alice:**
```bash
npm run demo:alice
```

**Terminal 3 - Bob:**
```bash
npm run demo:bob
```

**(Optional) Terminal 4 - Carol:**
```bash
npm run demo:carol
```

## Basic Commands

Once connected, you can use these commands in the interactive CLI:

| Command | Description |
|---------|-------------|
| `ping <name>` | Ping a peer to check online status |
| `sign <message>` | Request threshold signature for a message |
| `ecdh <pubkey>` | Derive shared secret with a public key |
| `echo <message>` | Test relay connectivity |
| `status` | Show node status, peers, and pool health |
| `peers` | List peers with online/offline status |
| `pool` | Show nonce pool details per peer |
| `pubkey` | Display this node's pubkey |
| `group` | Display group pubkey and info |
| `help` | Show available commands |
| `quit` | Exit gracefully |

## Example Session

**Terminal 1 - Relay:**
```
$ npm run demo:relay
╔═══════════════════════════════════════════╗
║     FROSTR Demo Relay                     ║
╚═══════════════════════════════════════════╝

[OK] Relay listening on ws://localhost:8194
[INFO] Press Ctrl+C to stop
```

**Terminal 2 - Alice:**
```
$ npm run demo:alice
╔═══════════════════════════════════════════╗
║     FROSTR Demo Node - alice              ║
╚═══════════════════════════════════════════╝

[INFO] Connecting to relay...
[OK] Connected!
[INFO] Group: 02a1b2c3...
[INFO] Your pubkey: 03d4e5f6...

alice> ping bob
[SEND] Pinging bob...
[OK] Pong! Policy: send=true, recv=true
[RECV] Received 50 nonces

alice> sign Hello FROSTR!
[SEND] Signing: "Hello FROSTR!"
[RECV] Sign request from bob
[SEND] Sent partial signature
[OK] Signature obtained!
[INFO] Signature: e3b0c442...98fb23c4

alice> status
Node Status
───────────────────────────────────
  Name:      alice
  Pubkey:    03d4e5f6...
  Connected: Yes

Peers
───────────────────────────────────
  02abc123... (bob) - online
    Policy: send=true, recv=true
  02def456... (carol) - offline
    Policy: send=true, recv=true
```

## Onboarding Demo

The onboarding demo shows how a new member can join the group with minimal information (just an onboard package).

### Setup

1. Start the relay:
   ```bash
   npm run demo:relay
   ```

2. Start at least one existing node (e.g., alice):
   ```bash
   npm run demo:alice
   ```

### Onboard as Carol

In a new terminal:

```bash
npm run demo:onboard -- --name carol
```

This will:
1. Load Carol's onboard package (share + peer pubkey + relay URL)
2. Connect to the relay
3. Request the GroupPackage from the specified peer (alice)
4. Receive initial nonces for signing
5. Transition to interactive mode

**Example Output:**
```
╔═══════════════════════════════════════════╗
║     FROSTR Onboarding - carol             ║
╚═══════════════════════════════════════════╝

[INFO] Loading onboard package...
[INFO] Peer contact: 02abc123... (alice)
[INFO] Relay: ws://localhost:8194
[INFO] Connecting to relay...
[OK] Connected!
[SEND] Requesting onboard from 02abc123...
[RECV] GroupPackage received!
[INFO] Group pubkey: 02def456...
[INFO] Threshold: 2-of-3
[INFO] Members: 3
[RECV] Received 50 initial nonces
[OK] Onboarding complete!
[INFO] Transitioning to interactive mode...

carol> ping alice
[SEND] Pinging alice...
[OK] Pong! Policy: send=true, recv=true

carol> sign "I just joined!"
[SEND] Signing: "I just joined!"
[RECV] Partial sig from alice
[OK] Signature obtained!
```

### Using Bech32 Onboard Strings

You can also onboard using a bech32-encoded string (e.g., from a QR code):

```bash
npm run demo:onboard -- bfonboard1qyp8x9...
```

## File Structure

```
demo/tmux/
├── shared.ts      # Shared utilities (colors, formatting, file I/O)
├── keygen.ts      # Group/share generation (includes onboard packages)
├── relay.ts       # Standalone Nostr relay
├── node.ts        # Interactive node CLI (full mode)
├── onboard.ts     # Onboarding demo (join with minimal info)
├── tmux.sh        # tmux session launcher
├── README.md      # This documentation
└── data/          # Generated credentials (gitignored)
    ├── group.json
    ├── share-alice.json
    ├── share-bob.json
    ├── share-carol.json
    ├── onboard-alice.json
    ├── onboard-bob.json
    └── onboard-carol.json
```

## Troubleshooting

### "Credentials not found"

Run the keygen script first:
```bash
npm run demo:keygen
```

### "Connection refused" or timeout

Make sure the relay is running:
```bash
npm run demo:relay
```

### Ping times out

- Ensure the target peer is running
- Check that both nodes are connected to the same relay
- Try running `echo test` to verify relay connectivity

### Sign fails

- You need at least `threshold` nodes online and connected
- Ping peers first to exchange nonces
- Check `pool` command to see nonce availability

### Port already in use

Use a different port for the relay:
```bash
npm run demo:relay -- 8195
```

Then update the relay URL when starting nodes, or regenerate credentials with the new relay URL.

## Understanding the Protocol

### Threshold Signing

FROSTR uses a 2-of-3 threshold scheme by default:
- **3 members** hold secret shares
- **2 members** must collaborate to sign
- No single member can sign alone

### Nonce Management

The protocol uses dynamic nonces for security:
- Nonces are exchanged during `ping` operations
- Each signing operation consumes nonces
- The pool is automatically replenished as needed
- `critical_low` warnings appear when nonces are running low

### Onboarding Flow

1. New member receives OnboardPackage (share + peer + relays)
2. Connects to relay and contacts the specified peer
3. Receives GroupPackage and initial nonces
4. Ready to participate in signing operations

## Development

### Adding New Commands

Edit `demo/tmux/node.ts` and add to the `COMMANDS` object:

```typescript
my_command: {
  description: 'Description here',
  usage: 'my_command <arg>',
  handler: async (ctx, args) => {
    // Implementation
  }
}
```

### Custom Threshold/Members

```bash
npm run demo:keygen -- -t 4 -n 7 --fresh
```

This creates a 4-of-7 group with members: alice, bob, carol, dave, eve, plus two more.
