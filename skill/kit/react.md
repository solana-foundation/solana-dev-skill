# Solana Kit React Reference

## Setup

```tsx
import {
  SelectedWalletAccountContextProvider,
  useSelectedWalletAccount,
  useSignAndSendTransaction,
} from '@solana/react';
```

## Provider

```tsx
const STORAGE_KEY = 'wallet-account';

function App() {
  return (
    <SelectedWalletAccountContextProvider
      filterWallet={(wallet) => wallet.accounts.length > 0}
      stateSync={{
        getSelectedWallet: () => localStorage.getItem(STORAGE_KEY),
        storeSelectedWallet: (k) => localStorage.setItem(STORAGE_KEY, k),
        deleteSelectedWallet: () => localStorage.removeItem(STORAGE_KEY),
      }}
    >
      <YourApp />
    </SelectedWalletAccountContextProvider>
  );
}
```

## Wallet Selection

```tsx
function WalletSelector() {
  const [account, setAccount, wallets] = useSelectedWalletAccount();

  if (!account) {
    return (
      <div>
        {wallets.map((wallet) => (
          <div key={wallet.name}>
            {wallet.accounts.map((acc) => (
              <button key={acc.address} onClick={() => setAccount(acc)}>
                {wallet.name}: {acc.address.slice(0, 8)}...
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p>Connected: {account.address}</p>
      <button onClick={() => setAccount(undefined)}>Disconnect</button>
    </div>
  );
}
```

## Sign In With Solana

```tsx
const signIn = useSignIn(wallet);

const handleSignIn = async () => {
  const { account, signedMessage, signature } = await signIn({
    requestId: csrfToken,
  });
  // Verify on server
};
```

## Sign Message

```tsx
const signMessage = useSignMessage(account);

const { signature, signedMessage } = await signMessage({
  message: new TextEncoder().encode('Hello'),
});
```

## Sign Transaction

```tsx
const signTx = useSignTransaction(account, 'solana:devnet');

const { signedTransaction } = await signTx({
  transaction: txBytes,
  options: { minContextSlot },
});
```

## Sign & Send

```tsx
const signAndSend = useSignAndSendTransaction(account, 'solana:devnet');

const { signature } = await signAndSend({ transaction: txBytes });
const base58Sig = getBase58Decoder().decode(signature);
```

## Transaction Signer Hook

```tsx
const signer = useWalletAccountTransactionSendingSigner(account, 'solana:devnet');

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
);

const sig = await signAndSendTransactionMessageWithSigners(message);
```

## Chain Identifiers

```ts
'solana:mainnet'
'solana:devnet'
'solana:testnet'
'solana:localnet'
```

## Signer Types

| Hook | Returns |
|------|---------|
| `useWalletAccountMessageSigner` | `MessageModifyingSigner` |
| `useWalletAccountTransactionSigner` | `TransactionModifyingSigner` |
| `useWalletAccountTransactionSendingSigner` | `TransactionSendingSigner` |

All return modifying signers (wallets may modify before signing).

## Complete Example

```tsx
function App() {
  return (
    <SelectedWalletAccountContextProvider
      filterWallet={(w) => w.accounts.length > 0}
      stateSync={{
        getSelectedWallet: () => localStorage.getItem('wallet'),
        storeSelectedWallet: (k) => localStorage.setItem('wallet', k),
        deleteSelectedWallet: () => localStorage.removeItem('wallet'),
      }}
    >
      <WalletApp />
    </SelectedWalletAccountContextProvider>
  );
}

function WalletApp() {
  const [account, setAccount, wallets] = useSelectedWalletAccount();
  const signAndSend = useSignAndSendTransaction(account, 'solana:devnet');

  if (!account) {
    return wallets.map((w) =>
      w.accounts.map((a) => (
        <button key={a.address} onClick={() => setAccount(a)}>
          {w.name}: {a.address.slice(0, 8)}...
        </button>
      ))
    );
  }

  return (
    <div>
      <p>{account.address}</p>
      <button onClick={() => setAccount(undefined)}>Disconnect</button>
    </div>
  );
}
```