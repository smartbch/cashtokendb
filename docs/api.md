**Get utxos by multi-parameters form the WHERE condition in the SELECT sql query statement according to the logical AND relationship:**

Post `/utxos`

query parameters in request body like below:
```
{
    'lockScript': "hex-string",
    'category': "hex-string, token category",
    'nftCommitment': "hex-string, nft token commitment",
    'nftCapability': "enum: 'none','minting','mutable'",
    'covenantBytecode': "hex-string, covenant contract bytecode without args",
    'constructorArg0': "hex-string, covenant contract constructor last argument",
    'constructorArg1': "hex-string, covenant contract constructor second-to-last argument"，
    'constructorArg2': "hex-string, covenant contract constructor the third last argument",
    'constructorArg3': "hex-string, covenant contract constructor the fourth last argument"
    'constructorArgs': "hex-string, covenant contract constructor left",
    'owner': "utxo owner in bch cash address formsat"
}
```

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
    "constructorArg0": null,
    "constructorArg1": null,
    "constructorArg2": null,
    "constructorArg3": null,
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
    "constructorArg0": null,
    "constructorArg1": null,
    "constructorArg2": null,
    "constructorArg3": null,
    "constructorArgs": null,
    "owner": "bitcoincash:qpkq787krfaxkjsmwzj8yzmqsyw9wca2ac23zyqrqa",
    "spentByList": null,
    "addTime": 1685112266208
  }
]
```

### Example

If we want query utxos using `constructorArg0` and `covenantBytecode`, we can do below:

```
curl -H "Content-Type: application/json" -X POST -d '{"constructorArg0":"41ed", "covenantBytecode":"1234abcdef1234"}'  http://127.0.0.1:8001/utxos
```

And server will execute below sql statement in table utxos of local db:

```
select * from utxos where constructorArg0 = "41ed" and covenantBytecode = "1234abcdef1234"
```