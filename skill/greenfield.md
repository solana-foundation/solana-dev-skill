# BNB Greenfield Development

## Overview
BNB Greenfield is a decentralized storage network in the BNB ecosystem. It provides object storage with on-chain access control, integrated with BSC for payments and permissions.

### Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  BNB Greenfield  │    │   BNB Smart Chain │    │  Storage        │
│  (Cosmos SDK)    │◄──►│   (EVM)           │    │  Providers (SP) │
│  Chain ID: 1017  │    │   Chain ID: 56    │    │                 │
│                  │    │                   │    │  Store & serve  │
│  Metadata +      │    │  Smart contracts  │    │  actual data    │
│  permissions     │    │  + mirrored       │    │                 │
│                  │    │  objects/groups    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

- **Greenfield Chain**: Cosmos SDK chain storing metadata, permissions, and billing
- **Storage Providers (SPs)**: Nodes that store and serve actual data objects
- **BSC Cross-chain**: Objects/buckets/groups can be mirrored to BSC as ERC-721/ERC-1155 tokens
- **BNB token**: Used for storage fees and gas on both chains

### Key Properties
| Property | Value |
|----------|-------|
| Consensus | Tendermint PoS |
| Chain ID (mainnet) | 1017 |
| Chain ID (testnet) | 5600 |
| Native token | BNB |
| Storage unit | Object (file) in Bucket |
| Max object size | 64 GB |
| Redundancy | Erasure coding (EC) |
| Permission model | On-chain ACL + groups |

## SDK and Tools

### Greenfield JavaScript SDK
```bash
npm install @bnb-chain/greenfield-js-sdk
```

### Greenfield Go SDK
```bash
go get github.com/bnb-chain/greenfield-go-sdk
```

### Greenfield CLI (gnfd-cmd)
```bash
# Install
go install github.com/bnb-chain/greenfield-cmd/cmd/gnfd-cmd@latest
```

## Core Operations with JavaScript SDK

### Setup
```typescript
import { Client } from "@bnb-chain/greenfield-js-sdk";

const client = Client.create(
  "https://greenfield-chain.bnbchain.org",   // Greenfield RPC
  "56"                                         // BSC chain ID for cross-chain
);

// For testnet:
// const client = Client.create(
//   "https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org",
//   "97"
// );
```

### Create a bucket
```typescript
import { VisibilityType } from "@bnb-chain/greenfield-js-sdk";

async function createBucket(bucketName: string, address: string) {
  // 1. Get storage providers
  const spList = await client.sp.getStorageProviders();
  const primarySp = spList[0]; // Select a primary SP

  // 2. Create bucket transaction
  const createBucketTx = await client.bucket.createBucket({
    bucketName,
    creator: address,
    visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
    chargedReadQuota: BigInt(0),
    primarySpAddress: primarySp.operatorAddress,
    paymentAddress: address,
  });

  // 3. Simulate and broadcast
  const simulateInfo = await createBucketTx.simulate({ denom: "BNB" });
  const broadcastRes = await createBucketTx.broadcast({
    denom: "BNB",
    gasLimit: Number(simulateInfo.gasLimit),
    gasPrice: simulateInfo.gasPrice,
    payer: address,
    granter: "",
    // Sign with wallet adapter
  });

  return broadcastRes;
}
```

### Upload an object
```typescript
async function uploadObject(
  bucketName: string,
  objectName: string,
  file: File,
  address: string
) {
  // 1. Create object on-chain
  const createObjectTx = await client.object.createObject({
    bucketName,
    objectName,
    creator: address,
    visibility: VisibilityType.VISIBILITY_TYPE_PRIVATE,
    contentType: file.type,
    redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
    payloadSize: BigInt(file.size),
  });

  const createRes = await createObjectTx.broadcast({
    denom: "BNB",
    gasLimit: 210000,
    gasPrice: "5000000000",
    payer: address,
    granter: "",
  });

  // 2. Upload data to Storage Provider
  const uploadRes = await client.object.uploadObject(
    {
      bucketName,
      objectName,
      body: file,
      txnHash: createRes.transactionHash,
    },
    { type: "EDDSA", domain: window.location.origin, seed: "", address }
  );

  return uploadRes;
}
```

### Download an object
```typescript
async function downloadObject(bucketName: string, objectName: string) {
  const res = await client.object.getObject({
    bucketName,
    objectName,
  });

  // res.body is a ReadableStream
  const blob = await res.body?.getReader().read();
  return blob;
}

// For public objects, construct direct SP URL:
// https://<sp-endpoint>/<bucket-name>/<object-name>
```

### List objects in a bucket
```typescript
async function listObjects(bucketName: string) {
  const res = await client.object.listObjects({
    bucketName,
    endpoint: spEndpoint,
  });

  return res.body?.GfSpListObjectsByBucketNameResponse?.Objects || [];
}
```

### Delete an object
```typescript
async function deleteObject(bucketName: string, objectName: string, address: string) {
  const tx = await client.object.deleteObject({
    bucketName,
    objectName,
    operator: address,
  });

  return tx.broadcast({
    denom: "BNB",
    gasLimit: 120000,
    gasPrice: "5000000000",
    payer: address,
    granter: "",
  });
}
```

## Access Control

### Group-based permissions
Greenfield uses groups for access control. Groups can be mirrored to BSC as ERC-1155 tokens.

```typescript
// Create a group
async function createGroup(groupName: string, address: string) {
  const tx = await client.group.createGroup({
    creator: address,
    groupName,
    members: [],
  });

  return tx.broadcast({ ... });
}

// Add members to group
async function addGroupMembers(
  groupName: string,
  members: string[],
  owner: string
) {
  const tx = await client.group.updateGroupMember({
    operator: owner,
    groupOwner: owner,
    groupName,
    membersToAdd: members.map(m => ({ member: m, expirationTime: null })),
    membersToDelete: [],
  });

  return tx.broadcast({ ... });
}

// Set bucket policy for group
async function setBucketPolicy(
  bucketName: string,
  groupId: string,
  address: string
) {
  const tx = await client.bucket.putBucketPolicy(bucketName, {
    operator: address,
    statements: [
      {
        effect: "EFFECT_ALLOW",
        actions: ["ACTION_GET_OBJECT"],
        resources: [`grn:o::${bucketName}/*`],
      },
    ],
    principal: {
      type: "PRINCIPAL_TYPE_GNFD_GROUP",
      value: groupId,
    },
  });

  return tx.broadcast({ ... });
}
```

## Cross-Chain with BSC

### Mirror objects to BSC
Greenfield objects, buckets, and groups can be "mirrored" to BSC as NFT tokens. This enables:
- Trading storage objects on BSC NFT marketplaces
- Using BSC smart contracts to manage Greenfield permissions
- DeFi composability with storage assets

```typescript
// Mirror a bucket to BSC (creates ERC-721 on BSC)
async function mirrorBucket(bucketName: string, address: string) {
  const tx = await client.crosschain.mirrorBucket({
    operator: address,
    bucketName,
    destChainId: 56, // BSC mainnet
  });

  return tx.broadcast({ ... });
}

// Mirror a group to BSC (creates ERC-1155 on BSC)
async function mirrorGroup(groupName: string, groupId: string, address: string) {
  const tx = await client.crosschain.mirrorGroup({
    operator: address,
    groupName,
    id: groupId,
    destChainId: 56,
  });

  return tx.broadcast({ ... });
}
```

### BSC Smart Contract Interaction with Mirrored Objects
```solidity
// On BSC: Interact with mirrored Greenfield resources
interface IGreenfieldExecutor {
    function execute(bytes[] calldata _messages) external payable returns (bool);
}

interface IBucketHub {
    function createBucket(
        BucketStorage.CreateBucketSynPackage memory createPackage
    ) external payable returns (bool);
}

interface IObjectHub {
    function deleteObject(uint256 id) external payable returns (bool);
}

interface IGroupHub {
    function createGroup(
        address creator,
        string memory name
    ) external payable returns (bool);

    function updateGroup(
        address operator,
        uint256 groupId,
        address[] memory membersToAdd,
        uint64[] memory expirationTime,
        address[] memory membersToDelete
    ) external payable returns (bool);
}
```

## Use Cases

### Decentralized content hosting
- Store website assets on Greenfield
- Serve via SP endpoints (CDN-like)
- Manage access via on-chain groups

### Data marketplace
- Mirror data objects to BSC as NFTs
- Sell access via BSC smart contracts
- Buyers added to permission groups automatically

### dApp data storage
- Store user data (profiles, preferences, files)
- On-chain access control replaces traditional auth
- Cross-chain composability with BSC dApps

### AI/ML data pipelines
- Store training datasets on Greenfield
- Manage access via groups (team collaboration)
- Pay for storage with BNB

## Greenfield CLI Quick Reference

```bash
# Configure CLI
gnfd-cmd config --rpcAddr "https://greenfield-chain.bnbchain.org:443" \
  --chainId "greenfield_1017-1"

# Create bucket
gnfd-cmd bucket create gnfd://my-bucket

# Upload file
gnfd-cmd object put ./file.txt gnfd://my-bucket/file.txt

# Download file
gnfd-cmd object get gnfd://my-bucket/file.txt ./downloaded.txt

# List buckets
gnfd-cmd bucket ls

# List objects
gnfd-cmd object ls gnfd://my-bucket

# Delete object
gnfd-cmd object delete gnfd://my-bucket/file.txt

# Create group
gnfd-cmd group create gnfd://my-group

# Add member to group
gnfd-cmd group update --addMembers 0x1234...

# Mirror to BSC
gnfd-cmd crosschain mirror --resource bucket --id <bucket-id>
```

## Storage Costs
- Storage fee: Charged per GB per month, paid in BNB
- Read quota: Free tier available, additional reads cost BNB
- Cross-chain operations: BSC gas fee + relayer fee
- Check current pricing: https://docs.bnbchain.org/greenfield/
