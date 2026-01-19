# Unity + Solana Game Development

Progressive skill for Unity game development with Solana integration using Solana.Unity-SDK and optional PlaySolana/PSG1 support.

## C# Coding Guidelines

### Principles

- **KISS**: Keep It Simple, Stupid
- **SOLID**: Single Responsibility, Interface Segregation, Dependency Inversion
- Read `.editorconfig` before writing code
- Never manually create `.meta` files (Unity generates them)

### Project Structure

```
Assets/_Game/
├── Scenes/
├── Scripts/
│   ├── Runtime/
│   │   ├── _Game.asmdef
│   │   ├── Core/
│   │   ├── Blockchain/
│   │   ├── UI/
│   │   └── Gameplay/
│   └── Editor/_Game.Editor.asmdef
└── Tests/
    ├── EditMode/_Game.Tests.asmdef
    └── PlayMode/_Game.PlayMode.Tests.asmdef
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Public fields | PascalCase | `MaxHealth`, `PlayerName` |
| Private fields | _camelCase | `_walletService`, `_isConnected` |
| Static fields | s_camelCase | `s_instance` |
| Booleans | Verb prefix | `IsConnected`, `HasPendingTx` |
| Methods | Verb + PascalCase | `GetBalance()`, `ConnectWallet()` |
| Events | Verb phrase | `OnConnected`, `DoorOpened` |

### Key Patterns

```csharp
// Serialized properties
[field: SerializeField]
public int Health { get; private set; } = 100;

// Early return
public async Task<bool> ProcessTransaction(Transaction tx)
{
    if (tx == null) return false;
    if (!IsConnected) return false;
    return (await SendTransaction(tx)).IsSuccess;
}

// Events
public event Action<Account> OnConnected;
private void RaiseConnected(Account a) => OnConnected?.Invoke(a);

// Comment "why not" when alternatives exist
private List<Player> _activePlayers = new();
// Using List over Dictionary<int,Player>: small count, infrequent lookups
```

### XML Documentation

```csharp
/// <summary>Connects to a Solana wallet.</summary>
/// <param name="type">The wallet adapter type.</param>
/// <returns>True if connection succeeded.</returns>
public async Task<bool> Connect(WalletType type) { }

/// <inheritdoc/>  // For interface implementations
```

## Installation

```json
// Packages/manifest.json
{
  "dependencies": {
    "com.solana.unity-sdk": "https://github.com/magicblock-labs/Solana.Unity-SDK.git#3.1.0"
  }
}
```

### Core Namespaces

```csharp
using Solana.Unity.SDK;           // Web3, wallet adapters
using Solana.Unity.Rpc;           // RPC client
using Solana.Unity.Rpc.Models;    // Account, transaction models
using Solana.Unity.Wallet;        // Account, PublicKey
using Solana.Unity.Programs;      // System, Token programs
using Solana.Unity.SDK.Nft;       // NFT/Metaplex
```

### Wallet Adapters

| Adapter | Platform | Use Case |
|---------|----------|----------|
| **Phantom** | Mobile/WebGL | Most popular |
| **Solflare** | Mobile/WebGL | Alternative |
| **WalletAdapter** | WebGL | Browser extensions |
| **InGameWallet** | All | Embedded (custodial) |
| **Web3Auth** | All | Social login |

## Wallet Connection

```csharp
public class WalletManager : MonoBehaviour
{
    public event Action<Account> OnLogin;
    public event Action OnLogout;
    public event Action<double> OnBalanceChanged;

    public bool IsConnected => Web3.Wallet != null;
    public PublicKey Address => Web3.Wallet?.Account.PublicKey;

    void Start()
    {
        Web3.OnLogin += a => OnLogin?.Invoke(a);
        Web3.OnLogout += () => OnLogout?.Invoke();
        Web3.OnBalanceChange += b => OnBalanceChanged?.Invoke(b);
    }

    public async Task<bool> Connect(WalletType type)
    {
        try
        {
            object wallet = type switch
            {
                WalletType.Phantom => await Web3.Instance.LoginPhantom(),
                WalletType.WalletAdapter => await Web3.Instance.LoginWalletAdapter(),
                WalletType.InGame => await Web3.Instance.LoginInGameWallet("password"),
                WalletType.Web3Auth => await Web3.Instance.LoginWeb3Auth(Provider.GOOGLE),
                _ => null
            };
            return wallet != null;
        }
        catch (Exception ex)
        {
            Debug.LogError($"Connection failed: {ex.Message}");
            return false;
        }
    }

    public async Task Disconnect() => await Web3.Instance.Logout();
}

public enum WalletType { Phantom, WalletAdapter, InGame, Web3Auth }
```

## RPC Operations

```csharp
public class AccountReader
{
    public async Task<double> GetBalance(PublicKey address)
    {
        var result = await Web3.Rpc.GetBalanceAsync(address);
        if (!result.WasSuccessful) throw new Exception(result.Reason);
        return result.Result.Value / 1_000_000_000.0;
    }

    public async Task<AccountInfo> GetAccountInfo(PublicKey address)
    {
        var result = await Web3.Rpc.GetAccountInfoAsync(address);
        return result.WasSuccessful ? result.Result.Value : null;
    }

    public async Task<List<AccountInfo>> GetMultipleAccounts(PublicKey[] addresses)
    {
        var result = await Web3.Rpc.GetMultipleAccountsAsync(addresses);
        return result.WasSuccessful ? result.Result.Value : new();
    }

    public async Task<List<TokenAccount>> GetTokenAccounts(PublicKey owner)
    {
        var result = await Web3.Rpc.GetTokenAccountsByOwnerAsync(owner, tokenProgramId: TokenProgram.ProgramIdKey);
        return result.WasSuccessful ? result.Result.Value : new();
    }
}
```

### Account Deserialization

```csharp
[Serializable]
public struct GameAccount
{
    public PublicKey Authority, Player;
    public ulong Score;
    public uint Level;
    public byte State;
    public long LastPlayed;
}

public static GameAccount Deserialize(byte[] data)
{
    var span = data.AsSpan();
    int offset = 8; // Skip discriminator
    return new GameAccount
    {
        Authority = ReadPublicKey(span, ref offset),
        Player = ReadPublicKey(span, ref offset),
        Score = BinaryPrimitives.ReadUInt64LittleEndian(span.Slice(offset, 8)),
        Level = BinaryPrimitives.ReadUInt32LittleEndian(span.Slice(offset += 8, 4)),
        State = span[offset += 4],
        LastPlayed = BinaryPrimitives.ReadInt64LittleEndian(span.Slice(offset += 1, 8))
    };
}

static PublicKey ReadPublicKey(ReadOnlySpan<byte> data, ref int offset)
{
    var key = new PublicKey(data.Slice(offset, 32).ToArray());
    offset += 32;
    return key;
}
```

## Transaction Building

```csharp
public async Task<string> TransferSol(PublicKey to, ulong lamports)
{
    var blockHash = await Web3.Rpc.GetLatestBlockHashAsync();
    var tx = new TransactionBuilder()
        .SetRecentBlockHash(blockHash.Result.Value.Blockhash)
        .SetFeePayer(Web3.Account)
        .AddInstruction(SystemProgram.Transfer(Web3.Account.PublicKey, to, lamports))
        .Build(Web3.Account);
    return (await Web3.Wallet.SignAndSendTransaction(tx)).Result;
}

public async Task<string> TransferToken(PublicKey mint, PublicKey toOwner, ulong amount)
{
    var fromAta = AssociatedTokenAccountProgram.DeriveAssociatedTokenAccount(Web3.Account.PublicKey, mint);
    var toAta = AssociatedTokenAccountProgram.DeriveAssociatedTokenAccount(toOwner, mint);
    var blockHash = await Web3.Rpc.GetLatestBlockHashAsync();

    var txBuilder = new TransactionBuilder()
        .SetRecentBlockHash(blockHash.Result.Value.Blockhash)
        .SetFeePayer(Web3.Account);

    // Create ATA if needed
    if ((await Web3.Rpc.GetAccountInfoAsync(toAta)).Result?.Value == null)
        txBuilder.AddInstruction(AssociatedTokenAccountProgram.CreateAssociatedTokenAccount(
            Web3.Account.PublicKey, toOwner, mint));

    txBuilder.AddInstruction(TokenProgram.Transfer(fromAta, toAta, amount, Web3.Account.PublicKey));
    return (await Web3.Wallet.SignAndSendTransaction(txBuilder.Build(Web3.Account))).Result;
}
```

### Custom Program Instructions

```csharp
public TransactionInstruction CreateGameInstruction(
    PublicKey programId, PublicKey gameAccount, PublicKey player, uint move)
{
    // Discriminator (8 bytes) + move (4 bytes)
    var data = new byte[12];
    new byte[] { 213, 157, 193, 142, 228, 56, 248, 150 }.CopyTo(data, 0);
    BitConverter.GetBytes(move).CopyTo(data, 8);

    return new TransactionInstruction
    {
        ProgramId = programId,
        Keys = new List<AccountMeta>
        {
            AccountMeta.Writable(gameAccount, false),
            AccountMeta.ReadOnly(player, true),
        },
        Data = data
    };
}
```

### PDA Derivation

```csharp
public static PublicKey FindGamePDA(PublicKey programId, PublicKey player)
{
    PublicKey.TryFindProgramAddress(
        new[] { Encoding.UTF8.GetBytes("game"), player.KeyBytes },
        programId, out var pda, out _);
    return pda;
}
```

## NFT Integration

```csharp
public class NFTManager : MonoBehaviour
{
    private static readonly Dictionary<string, Texture2D> _textureCache = new();

    public async Task<List<Nft>> GetOwnedNFTs(PublicKey owner)
    {
        try { return await Nft.TryGetNftsByOwnerAsync(owner, Web3.Rpc) ?? new(); }
        catch { return new(); }
    }

    public async Task<Nft> GetNFT(PublicKey mint)
    {
        try { return await Nft.TryGetNftData(mint, Web3.Rpc); }
        catch { return null; }
    }

    public async Task<Texture2D> LoadNFTTexture(string uri)
    {
        if (_textureCache.TryGetValue(uri, out var cached)) return cached;
        using var request = UnityWebRequestTexture.GetTexture(uri);
        var op = request.SendWebRequest();
        while (!op.isDone) await Task.Yield();
        if (request.result == UnityWebRequest.Result.Success)
        {
            var texture = DownloadHandlerTexture.GetContent(request);
            _textureCache[uri] = texture;
            return texture;
        }
        return null;
    }
}
```

## WebSocket Subscriptions

```csharp
public class AccountSubscriber : MonoBehaviour
{
    private readonly List<SubscriptionState> _subscriptions = new();

    public async Task SubscribeToAccount(PublicKey account, Action<AccountInfo> onUpdate)
    {
        var sub = await Web3.Rpc.SubscribeAccountInfoAsync(account,
            (_, info) => MainThread.Run(() => onUpdate(info)), Commitment.Confirmed);
        _subscriptions.Add(sub);
    }

    public async Task SubscribeToLogs(PublicKey programId, Action<LogInfo> onLog)
    {
        var sub = await Web3.Rpc.SubscribeLogInfoAsync(programId,
            (_, log) => MainThread.Run(() => onLog(log)));
        _subscriptions.Add(sub);
    }

    void OnDestroy()
    {
        foreach (var sub in _subscriptions) sub?.Unsubscribe();
        _subscriptions.Clear();
    }
}

public static class MainThread
{
    private static SynchronizationContext _context;
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Init() => _context = SynchronizationContext.Current;
    public static void Run(Action action) => _context?.Post(_ => action(), null);
}
```

## Platform-Specific Code

```csharp
#if UNITY_WEBGL
public async Task<bool> ConnectBrowser() => await Web3.Instance.LoginWalletAdapter() != null;
#elif UNITY_IOS || UNITY_ANDROID
public async Task<bool> ConnectMobile() => await Web3.Instance.LoginPhantom() != null;
#elif UNITY_EDITOR
public async Task<bool> ConnectDev() => await Web3.Instance.LoginInGameWallet("devpass") != null;
#endif
```

## Common Patterns

```csharp
// Retry with exponential backoff
public async Task<T> WithRetry<T>(Func<Task<T>> op, int maxAttempts = 3)
{
    for (int i = 0; i < maxAttempts; i++)
    {
        try { return await op(); }
        catch when (i < maxAttempts - 1) { await Task.Delay(1000 * (i + 1)); }
    }
    throw new Exception("Max retry attempts exceeded");
}

// Transaction confirmation
public async Task<bool> WaitForConfirmation(string sig, int timeoutSec = 30)
{
    var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
    while (DateTime.UtcNow < deadline)
    {
        var status = await Web3.Rpc.GetSignatureStatusesAsync(new[] { sig });
        var conf = status.Result?.Value?[0]?.ConfirmationStatus;
        if (conf is "confirmed" or "finalized") return true;
        await Task.Delay(1000);
    }
    return false;
}
```

## Testing Guidelines

### Structure & Variable Naming

| Location / Role | Use For / Name |
|-----------------|----------------|
| `Tests/EditMode/` | Pure C# logic, deserialization |
| `Tests/PlayMode/` | MonoBehaviours, coroutines |
| System Under Test | `sut` |
| Actual result | `actual` |
| Expected value | `expected` |
| Test doubles | `stub*`, `spy*`, `fake*`, `mock*` |

### Rules

- **Naming**: `MethodName_Condition_ExpectedResult`
- **AAA Pattern**: Arrange, Act, Assert (blank line separation)
- **Single Assert**: One assertion per test
- **Constraint Model**: `Assert.That(actual, Is.EqualTo(expected))`
- **No Control Flow**: No `if`, `for`, ternary in tests
- **Parameterized**: Use `[TestCase]` for variations
- **Two-strike rule**: If a test fails twice consecutively, stop and ask for guidance

### Play Mode Pattern

```csharp
[TestFixture]
public class WalletUITest
{
    private GameObject _testObject;
    private WalletConnectUI _sut;

    [SetUp]
    public void SetUp()
    {
        _testObject = new GameObject("TestUI");
        _sut = _testObject.AddComponent<WalletConnectUI>();
    }

    [TearDown]
    public void TearDown() => Object.Destroy(_testObject);

    [UnityTest]
    public IEnumerator Initialize_OnStart_SetsDisconnectedState()
    {
        yield return null;
        Assert.That(_sut.IsConnected, Is.False);
    }
}
```

### Edit Mode Pattern

```csharp
[TestFixture]
public class RewardCalculatorTest
{
    [TestCase(0UL, 1.0f, 0UL)]
    [TestCase(100UL, 2.0f, 200UL)]
    public void Calculate_VariousInputs_ReturnsExpected(ulong baseReward, float mult, ulong expected)
    {
        var sut = new RewardCalculator();
        var actual = sut.Calculate(baseReward, mult);
        Assert.That(actual, Is.EqualTo(expected));
    }
}
```

## PlaySolana / PSG1 Integration

> **Note**: Only include when explicitly targeting PSG1 console. Default to standard desktop/WebGL.

### When to Use

- PSG1 console target
- PlayDex quests/achievements
- PlayID cross-game identity
- SvalGuard hardware wallet

### Installation

```json
{
  "dependencies": {
    "com.solana.unity-sdk": "https://github.com/magicblock-labs/Solana.Unity-SDK.git#3.1.0",
    "com.playsolana.sdk": "https://github.com/playsolana/unity-sdk.git#1.0.0"
  }
}
```

### PSG1 Hardware

| Component | Specification |
|-----------|---------------|
| **SoC** | RK3588S2 (octa-core + Mali-G610 GPU) |
| **Display** | 3.92" OLED, 1240×1080 (portrait) |
| **Security** | TEE + Secure Element |
| **OS** | EchOS (Android-based) |

### Input Mapping

```csharp
#if PLAYSOLANA_PSG1
void Update()
{
    if (PSG1Input.ButtonA.wasPressedThisFrame) OnConfirm();
    if (PSG1Input.ButtonB.wasPressedThisFrame) OnCancel();
    if (PSG1Input.DPad.up.wasPressedThisFrame) OnUp();
    if (PSG1Input.Start.wasPressedThisFrame) OnPause();
}
#endif
```

### SvalGuard Wallet

```csharp
#if PLAYSOLANA_PSG1
public class SvalGuardWallet : MonoBehaviour
{
    private SvalGuard _wallet;
    public bool IsConnected => _wallet?.IsConnected ?? false;

    public async Task<bool> Connect()
    {
        _wallet = await SvalGuard.Connect();
        return _wallet != null;
    }

    public async Task<string> SignAndSend(Transaction tx)
    {
        if (!IsConnected) throw new InvalidOperationException("Not connected");
        return await _wallet.SignAndSendTransaction(tx); // Biometric auth
    }

    public async Task<bool> AuthenticateForTransaction()
    {
        var result = await SvalGuard.RequestBiometric(
            title: "Confirm Transaction", description: "Use fingerprint to sign");
        return result == BiometricResult.Success;
    }
}
#endif
```

### PlayDex Quests & Achievements

```csharp
#if PLAYSOLANA_PSG1
public class PlayDexManager : MonoBehaviour
{
    private PlayDexClient _client;
    async void Start() => _client = await PlayDexClient.Initialize();

    public async Task CompleteQuest(string questId, uint score)
    {
        var result = await _client.CompleteQuest(new QuestCompletion
        {
            QuestId = questId, Score = score,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        });
        if (result.Success) Debug.Log($"XP earned: {result.XpEarned}");
    }

    public async Task UnlockAchievement(string id)
    {
        var result = await _client.UnlockAchievement(id);
        if (result.Success) Debug.Log($"+{result.XpEarned} XP");
    }

    public Task<List<Quest>> GetQuests() => _client.GetActiveQuests();
    public Task SubmitScore(string id, ulong score) =>
        _client.SubmitLeaderboardScore(new LeaderboardEntry { LeaderboardId = id, Score = score });
}
#endif
```

### PlayID Profile

```csharp
#if PLAYSOLANA_PSG1
public class PlayIDProfile
{
    public PublicKey Address;
    public string Username;
    public uint Level;
    public ulong TotalXp;
}

public async Task<PlayIDProfile> LoadProfile()
{
    var client = await PlayIDClient.Initialize();
    return await client.GetProfile();
}
#endif
```

### PSG1 Screen & Safe Areas

```csharp
#if PLAYSOLANA_PSG1
void Start() => Screen.orientation = ScreenOrientation.Portrait; // Native: 1080×1240

void ApplySafeArea(RectTransform panel)
{
    var safe = Screen.safeArea;
    panel.anchorMin = new Vector2(safe.x / Screen.width, safe.y / Screen.height);
    panel.anchorMax = new Vector2((safe.x + safe.width) / Screen.width, (safe.y + safe.height) / Screen.height);
}
#endif
```

### Conditional Compilation

Add `PLAYSOLANA_PSG1` to Player Settings → Scripting Define Symbols:

```csharp
void Start()
{
    #if PLAYSOLANA_PSG1
    InitializePSG1(); // SvalGuard, PlayDex, PSG1 input
    #else
    InitializeStandard(); // Phantom, keyboard/mouse
    #endif
}
```

### PSG1 Simulator (Editor)

```csharp
#if UNITY_EDITOR
using PlaySolana.Simulator;

void Awake()
{
    PSG1Simulator.Enable();
    PSG1Simulator.SetResolution(1080, 1240);
    PSG1Simulator.MapKeyboard(new KeyboardMapping
    {
        DPadUp = KeyCode.UpArrow, DPadDown = KeyCode.DownArrow,
        DPadLeft = KeyCode.LeftArrow, DPadRight = KeyCode.RightArrow,
        ButtonA = KeyCode.Z, ButtonB = KeyCode.X,
        ButtonX = KeyCode.A, ButtonY = KeyCode.S,
        ShoulderL = KeyCode.Q, ShoulderR = KeyCode.E,
        Start = KeyCode.Return, Select = KeyCode.Backspace
    });
}
#endif
```