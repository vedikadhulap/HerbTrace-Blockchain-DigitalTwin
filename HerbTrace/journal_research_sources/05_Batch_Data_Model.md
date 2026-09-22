# 05. Batch Data Model

Based on `herbtrace-backend/models/Batch.js`.

| Field Name | Data Type | Required | Stored In | On/Off-Chain | Relevant Stage |
|---|---|---|---|---|---|
| `batchId` | String | Yes | MongoDB & SC | Both | All |
| `chainId` | String | No (Indexed) | MongoDB | Off-chain | All (Lineage mechanism) |
| `herbType` | String | Yes | MongoDB | Off-chain | Create |
| `herbVariety` | String | No | MongoDB | Off-chain | Create |
| `farmingMethod`| String (Enum) | No | MongoDB | Off-chain | Create |
| `estimatedMoisture`| Number | No | MongoDB | Off-chain | Create |
| `lotNumber` | String | No | MongoDB | Off-chain | Create |
| `expectedDryWeight`| Number | No | MongoDB | Off-chain | Create |
| `farmerWallet`| String | Yes | MongoDB | Off-chain | Create |
| `farmLocation`| String | No | MongoDB | Off-chain | Create |
| `location` | Object (lat, lon) | No | MongoDB | Off-chain | Create |
| `harvestDate` | Date | No | MongoDB | Off-chain | Create |
| `quantityKg` | Number | No | MongoDB | Off-chain | Create |
| `images` | Array (Strings)| No | MongoDB | Off-chain | Create |
| `status` | String (Enum) | Yes | MongoDB & SC | Both | All |
| `dataHash` | String | Yes | MongoDB & SC | Both | All |
| `txHash` | String | No | MongoDB | Off-chain | All |
| `createdBy` | ObjectId (Ref) | No | MongoDB | Off-chain | Create |
| `testedBy` | ObjectId (Ref) | No | MongoDB | Off-chain | Test |
| `processedBy` | ObjectId (Ref) | No | MongoDB | Off-chain | Process |
| `transferredBy`| ObjectId (Ref) | No | MongoDB | Off-chain | Transfer |
| `parentBatchIds`| Array (Strings)| No | MongoDB & SC | Both | Process |
| `labData` | Mixed Object | No | MongoDB | Off-chain | Test |
| `labLocation` | Object (lat, lon) | No | MongoDB | Off-chain | Test |
| `processorData`| Mixed Object | No | MongoDB | Off-chain | Process |
| `processLocation`| Object (lat, lon) | No | MongoDB | Off-chain | Process |
| `transferData`| Mixed Object | No | MongoDB | Off-chain | Transfer |
| `transferLocation`| Object (lat, lon) | No | MongoDB | Off-chain | Transfer |

> [!IMPORTANT]
> - `chainId` is strictly an off-chain concept in MongoDB used to link the 4 stages together into a single Merkle Tree. 
> - Raw data is kept off-chain, while the `dataHash` is recorded on-chain at every stage.
