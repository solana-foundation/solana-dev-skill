# Codama-Generated Program Clients

`@solana-program/*` packages are Codama-generated, Kit-compatible clients for Solana programs.

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Program address | `{PROGRAM}_PROGRAM_ADDRESS` | `SYSTEM_PROGRAM_ADDRESS` |
| Instructions | `get{Name}Instruction()` | `getTransferSolInstruction()` |
| Instruction parse | `parse{Name}Instruction()` | `parseTransferSolInstruction()` |
| Account fetch | `fetch{Account}()` | `fetchMint()` |
| Account fetch maybe | `fetchMaybe{Account}()` | `fetchMaybeMint()` |
| Account fetch all | `fetchAll{Account}()` | `fetchAllMint()` |
| Account decode | `decode{Account}()` | `decodeMint()` |
| Account size | `get{Account}Size()` | `getMintSize()` |
| Codec | `get{Type}[Encoder\|Decoder\|Codec]()` | `getMintDecoder()` |
| PDA derivation | `find{Name}Pda()` | `findAssociatedTokenPda()` |
| Errors | `{PROGRAM}_ERROR__{NAME}` | `SYSTEM_ERROR__INSUFFICIENT_FUNDS` |
| Error check | `is{Program}Error()` | `isSystemError()` |

## Quick Examples

### Fetch Typed Account

```ts
import { fetchMint } from '@solana-program/token';

const mint = await fetchMint(rpc, mintAddress);
// mint.data.decimals, mint.data.supply — fully typed
```

### Create Instruction

```ts
import { getTransferSolInstruction } from '@solana-program/system';
import { lamports } from '@solana/kit';

const ix = getTransferSolInstruction({
  source: payer,
  destination: recipient.address,
  amount: lamports(1_000_000n),
});
```

### Derive PDA

```ts
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const [ata] = await findAssociatedTokenPda({
  owner,
  mint,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
```

### Error Handling

```ts
import { isSystemError, SYSTEM_ERROR__INSUFFICIENT_FUNDS } from '@solana-program/system';

try {
  await sendTransaction(tx);
} catch (e) {
  if (isSystemError(e, SYSTEM_ERROR__INSUFFICIENT_FUNDS)) {
    console.error('Not enough SOL');
  }
}
```

## Program-Specific References

For detailed APIs:
- [programs/system.md](programs/system.md) — Account creation, transfers, nonces
- [programs/token.md](programs/token.md) — SPL Token operations
- [programs/token-2022.md](programs/token-2022.md) — Token Extensions
- [programs/compute-budget.md](programs/compute-budget.md) — CU limits & priority fees
