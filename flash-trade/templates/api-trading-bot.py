"""
Flash Trade API Trading Bot Template (Python)

A simple trading bot that monitors price and opens positions via the REST API.
Adapt the strategy logic to your needs.

Requirements:
  pip install requests solders

Usage:
  export FLASH_API_URL="https://flashapi.trade"
  export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
  export KEYPAIR_PATH="~/.config/solana/id.json"
  python api-trading-bot.py
"""

import json
import os
import time
import base64
import requests
from pathlib import Path
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

# ─── Configuration ───────────────────────────────────────────────────────────

FLASH_API_URL = os.environ.get("FLASH_API_URL", "https://flashapi.trade")
SOLANA_RPC_URL = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
KEYPAIR_PATH = os.path.expanduser(os.environ.get("KEYPAIR_PATH", "~/.config/solana/id.json"))

# Strategy parameters
SYMBOL = "SOL"
COLLATERAL_USD = "12.0"  # Use $12+ to allow TP/SL (>$10 after fees)
LEVERAGE = 5.0
POLL_INTERVAL_SECONDS = 10
MAX_POSITIONS = 1


# ─── Helpers ─────────────────────────────────────────────────────────────────

def load_keypair() -> Keypair:
    """Load Solana keypair from JSON file."""
    key_data = json.loads(Path(KEYPAIR_PATH).read_text())
    return Keypair.from_bytes(bytes(key_data))


def get_price(symbol: str) -> float:
    """Get current oracle price for a symbol."""
    resp = requests.get(f"{FLASH_API_URL}/prices/{symbol}")
    resp.raise_for_status()
    return resp.json()["priceUi"]


def get_positions(wallet: str) -> list:
    """Get enriched positions for a wallet."""
    resp = requests.get(
        f"{FLASH_API_URL}/positions/owner/{wallet}",
        params={"includePnlInLeverageDisplay": "true"},
    )
    resp.raise_for_status()
    return resp.json()


def build_open_position(wallet: str, side: str) -> dict:
    """Build an open-position transaction via the API."""
    resp = requests.post(
        f"{FLASH_API_URL}/transaction-builder/open-position",
        json={
            "inputTokenSymbol": "USDC",
            "outputTokenSymbol": SYMBOL,
            "inputAmountUi": COLLATERAL_USD,
            "leverage": LEVERAGE,
            "tradeType": side,
            "owner": wallet,
            "slippagePercentage": "0.5",
        },
    )
    resp.raise_for_status()
    return resp.json()


def sign_and_send(tx_base64: str, keypair: Keypair) -> str:
    """Decode, sign, and submit a base64 transaction to Solana."""
    tx_bytes = base64.b64decode(tx_base64)
    unsigned_tx = VersionedTransaction.from_bytes(tx_bytes)

    # Sign the transaction (construct new VersionedTransaction with signature)
    signed_tx = VersionedTransaction(unsigned_tx.message, [keypair])

    # Submit to Solana RPC
    encoded = base64.b64encode(bytes(signed_tx)).decode("utf-8")
    rpc_response = requests.post(
        SOLANA_RPC_URL,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [encoded, {"encoding": "base64", "skipPreflight": False}],
        },
    )
    result = rpc_response.json()

    if "error" in result:
        raise Exception(f"RPC error: {result['error']}")

    return result["result"]


# ─── Strategy ────────────────────────────────────────────────────────────────

def evaluate_strategy(price: float, positions: list) -> str | None:
    """
    Replace this with your actual trading logic.
    Returns "LONG", "SHORT", or None.
    """
    # Example: simple price threshold
    if len(positions) >= MAX_POSITIONS:
        return None

    # YOUR STRATEGY HERE
    # if price < 140:
    #     return "LONG"
    # if price > 200:
    #     return "SHORT"

    return None


# ─── Main Loop ───────────────────────────────────────────────────────────────

def main():
    keypair = load_keypair()
    wallet = str(keypair.pubkey())
    print(f"Bot started | Wallet: {wallet} | Symbol: {SYMBOL}")
    print(f"API: {FLASH_API_URL} | RPC: {SOLANA_RPC_URL}")

    # Verify API connectivity
    health = requests.get(f"{FLASH_API_URL}/health").json()
    print(f"API health: {health.get('status', 'unknown')}")

    while True:
        try:
            # 1. Get current price
            price = get_price(SYMBOL)
            print(f"\n[{time.strftime('%H:%M:%S')}] {SYMBOL}: ${price:.2f}")

            # 2. Get current positions
            positions = get_positions(wallet)
            for pos in positions:
                if pos["marketSymbol"] == SYMBOL:
                    print(
                        f"  Position: {pos['sideUi']} {pos['sizeUsdUi']} USD | "
                        f"PnL: ${pos['pnlWithFeeUsdUi']} ({pos['pnlPercentageWithFee']}%) | "
                        f"Liq: ${pos['liquidationPriceUi']}"
                    )

            # 3. Evaluate strategy
            action = evaluate_strategy(price, positions)

            if action:
                print(f"  >>> Opening {action} position: ${COLLATERAL_USD} @ {LEVERAGE}x")

                # 4. Build transaction
                result = build_open_position(wallet, action)

                if result.get("err"):
                    print(f"  ERROR: {result['err']}")
                elif result.get("transactionBase64"):
                    print(f"  Entry: ${result['newEntryPrice']} | Fee: ${result['entryFee']}")
                    print(f"  Liq: ${result['newLiquidationPrice']} | Leverage: {result['newLeverage']}x")

                    # 5. Sign and submit
                    signature = sign_and_send(result["transactionBase64"], keypair)
                    print(f"  TX: https://solscan.io/tx/{signature}")
                else:
                    print("  No transaction returned")

        except KeyboardInterrupt:
            print("\nBot stopped.")
            break
        except Exception as e:
            print(f"  Error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
```
