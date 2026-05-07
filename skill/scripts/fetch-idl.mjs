#!/usr/bin/env node
// Fetches an Anchor IDL from on-chain given a program ID.
// Follows Castaway's fetch-idl.ts logic:
//   1. Derive Anchor IDL account address (PDA + "anchor:idl" seed)
//   2. Fetch account data via RPC
//   3. Decode: skip discriminator + authority, inflate zlib-compressed JSON
//
// Usage: node fetch-idl.mjs --program-id <BASE58> [--rpc <URL>]
// Output: IDL JSON to stdout

import {
  createSolanaRpc,
  address,
  getProgramDerivedAddress,
  createAddressWithSeed,
} from "@solana/kit";
import pako from "pako";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "program-id": { type: "string" },
    rpc: {
      type: "string",
      default: "https://api.mainnet-beta.solana.com",
    },
  },
});

if (!values["program-id"]) {
  console.error(
    "Usage: node fetch-idl.mjs --program-id <BASE58> [--rpc <URL>]"
  );
  process.exit(1);
}

const programId = address(values["program-id"]);
const rpc = createSolanaRpc(values.rpc);

// Derive Anchor IDL account address.
// Anchor stores IDLs at: createAddressWithSeed(PDA([], programId), "anchor:idl", programId)
const [base] = await getProgramDerivedAddress({
  programAddress: programId,
  seeds: [],
});
const idlAddress = await createAddressWithSeed({
  baseAddress: base,
  seed: "anchor:idl",
  programAddress: programId,
});

// Fetch account data
const accountInfo = await rpc
  .getAccountInfo(idlAddress, { encoding: "base64" })
  .send();

if (!accountInfo.value) {
  console.error(
    `No IDL account found for program ${values["program-id"]} at ${idlAddress}`
  );
  console.error(
    "The program may not have an on-chain Anchor IDL. Provide a local IDL file instead."
  );
  process.exit(1);
}

// Decode the IDL account data.
// Layout: [8 bytes discriminator][32 bytes authority][4 bytes data_len (u32 LE)][data_len bytes compressed IDL]
const data = Buffer.from(accountInfo.value.data[0], "base64");
const dataLen = data.readUInt32LE(40);
const compressed = data.subarray(44, 44 + dataLen);

let idl;
try {
  const inflated = pako.inflate(compressed);
  idl = JSON.parse(new TextDecoder().decode(inflated));
} catch (err) {
  console.error(`Failed to decompress/parse IDL data: ${err.message}`);
  process.exit(1);
}

console.log(JSON.stringify(idl, null, 2));
