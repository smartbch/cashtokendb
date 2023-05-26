**Get utxos has specific token category:**

`/utxos?category={specific_token_category}`

**Get utxos has specific nft commitment:**

`/utxos?commitment={specific_token_nft_commitment}`

**Get the utxos whose constructorArgs include specific {args}:**

`/utxos?args={covenant_contract_constructor_arguments_for_revealer_p2sh_tx}  `

**Get the utxos has specific covenant bytecode:**

`/utxos?bytecode={covenant_contract_bytecode_for_revealer_p2sh_tx}`

**Get the utxos has specific category and nft commitment:**

`/utxos?category={specific_token_category}&commitment={specific_token_nft_commitment}`

**Get the utxos has specific covenant bytecode and include specific args in constructorArgs:**

`/utxos?args={ovenant_contract_constructor_argument_for_revealer_p2sh_tx}&bytecode={covenant_contract_bytecode_for_revealer_p2sh_tx}`

### Response

```
[
	{
    "id": "302151fd6b5c09f55f8f8e6f8140ea55583ce9789ae9cce993d7fc76b0a765b9-1",
    "lockScript": "76a9146c0f1fd61a7a6b4a1b70a4720b60811c5763aaee88ac",
    "bchValue": 1e-05,
    "category": "94bb97ae3c04916f92dd413f2b1b8052d8ab3d43ecffc3d6159a08a32aab15bb",
    "tokenAmount": 0,
    "nftCommitment": "02",
    "nftCapability": "none",
    "covenantBytecode": null,
    "constructorArgs": null,
    "owner": "bitcoincash:qpkq787krfaxkjsmwzj8yzmqsyw9wca2ac23zyqrqa",
    "spentByList": null,
    "addTime": 1685112266026
  },
  {
    "id": "b217c4149ef14b4a4263c1cc313a08ced33e08bdf291be4a77cf8ea520415117-1",
    "lockScript": "76a9146c0f1fd61a7a6b4a1b70a4720b60811c5763aaee88ac",
    "bchValue": 1e-05,
    "category": "94bb97ae3c04916f92dd413f2b1b8052d8ab3d43ecffc3d6159a08a32aab15bb",
    "tokenAmount": 0,
    "nftCommitment": "00",
    "nftCapability": "none",
    "covenantBytecode": null,
    "constructorArgs": null,
    "owner": "bitcoincash:qpkq787krfaxkjsmwzj8yzmqsyw9wca2ac23zyqrqa",
    "spentByList": null,
    "addTime": 1685112266208
  }
]
```
