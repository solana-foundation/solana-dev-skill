# Solana Kit Codecs Reference

## Direction

- **`encode()`**: values → `Uint8Array`
- **`decode()`**: `Uint8Array` → values

## Codec Types

```ts
// Full codec
const codec: Codec<number> = getU32Codec();
codec.encode(42);     // Uint8Array
codec.decode(bytes);  // number

// Encoder only (tree-shaking)
const encoder: Encoder<number> = getU32Encoder();

// Decoder only
const decoder: Decoder<number> = getU32Decoder();
```

## Number Codecs

```ts
// Unsigned
getU8Codec();   // 1 byte
getU16Codec();  // 2 bytes (little-endian default)
getU32Codec();  // 4 bytes
getU64Codec();  // 8 bytes (bigint)
getU128Codec(); // 16 bytes (bigint)

// Signed
getI8Codec();  getI16Codec();  getI32Codec();  getI64Codec();

// Float
getF32Codec();  getF64Codec();

// Big-endian
getU16Codec({ endian: Endian.Big });
```

## String Codecs

```ts
// UTF-8 (variable)
const utf8 = getUtf8Codec();

// With size prefix (common)
const prefixed = addCodecSizePrefix(getUtf8Codec(), getU32Codec());

// Fixed size
const fixed = fixCodecSize(getUtf8Codec(), 32);

// Base58 (addresses)
const base58 = getBase58Codec();
```

## Struct Codec

```ts
type MyStruct = { id: number; name: string; balance: bigint };

const codec = getStructCodec([
  ['id', getU32Codec()],
  ['name', addCodecSizePrefix(getUtf8Codec(), getU32Codec())],
  ['balance', getU64Codec()],
]);

const bytes = codec.encode({ id: 1, name: 'Alice', balance: 1000n });
const data = codec.decode(bytes);
```

## Array & Tuple

```ts
// Array with size prefix
const arr = addCodecSizePrefix(getArrayCodec(getU32Codec()), getU32Codec());

// Fixed array
const fixed = fixCodecSize(getArrayCodec(getU32Codec()), 10);

// Tuple
const point = getTupleCodec([getI32Codec(), getI32Codec()]);
```

## Enum

```ts
enum Direction { Up, Down, Left, Right }
const codec = getEnumCodec(Direction);
codec.encode(Direction.Up);  // [0]
```

## Discriminated Union

```ts
type Shape =
  | { __kind: 'circle'; radius: number }
  | { __kind: 'rectangle'; width: number; height: number };

const codec = getDiscriminatedUnionCodec([
  ['circle', getStructCodec([['radius', getU32Codec()]])],
  ['rectangle', getStructCodec([
    ['width', getU32Codec()],
    ['height', getU32Codec()],
  ])],
]);
```

## Boolean & Nullable

```ts
const bool = getBooleanCodec();        // 1 byte
const u32Bool = getBooleanCodec({ size: 4 });

const nullable = getNullableCodec(getU32Codec());
nullable.encode(null);  // [0]
nullable.encode(42);    // [1, 42, 0, 0, 0]
```

## Options (Rust Option)

```ts
import { some, none, isSome, getOptionCodec } from '@solana/options';

const opt = getOptionCodec(getU32Codec());
opt.encode(some(42));  // [1, 42, 0, 0, 0]
opt.encode(none());    // [0]
```

## Bytes

```ts
const bytes = getBytesCodec();
const fixed32 = fixCodecSize(getBytesCodec(), 32);  // pubkeys
```

## Composition Helpers

```ts
// Size prefix
const prefixed = addCodecSizePrefix(getUtf8Codec(), getU32Codec());

// Fixed size
const fixed = fixCodecSize(getUtf8Codec(), 32);

// Transform
const upper = transformCodec(
  getUtf8Codec(),
  (v) => v.toUpperCase(),  // before encode
  (v) => v.toLowerCase(),  // after decode
);

// Offset
const offset = offsetCodec(getU32Codec(), { preOffset: 4 });
```

## Common Patterns

### Account Decoder

```ts
const tokenDecoder: Decoder<TokenAccount> = getStructDecoder([
  ['mint', fixDecoderSize(getBytesDecoder(), 32)],
  ['owner', fixDecoderSize(getBytesDecoder(), 32)],
  ['amount', getU64Decoder()],
  ['delegate', getOptionDecoder(fixDecoderSize(getBytesDecoder(), 32))],
  ['state', getU8Decoder()],
]);
```

### Instruction Encoder

```ts
const transferEncoder: Encoder<{ discriminator: number; amount: bigint }> =
  getStructEncoder([
    ['discriminator', getU8Encoder()],
    ['amount', getU64Encoder()],
  ]);

const data = transferEncoder.encode({ discriminator: 3, amount: 1000000n });
```