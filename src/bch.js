import {BCH, HttpProvider} from 'bchjs';
import {DeleteUtxo, GetSyncInfo, InitDB, InsertOrUpdateSyncInfo, InsertUtxoIntoDB} from './db.js'
import {sleep} from "./util.js";

let url = ''
let username = ''
let password = ''

const httpBlockchainProvider = new HttpProvider(url, username, password);
const bch = new BCH(httpBlockchainProvider, httpBlockchainProvider);

async function getBlockTxs(height) {
    let blkHash = await bch.rpc.getblockhash(height);
    //console.log(blkHash)
    if (blkHash == undefined) {
        return undefined
    }
    let block = await bch.rpc.getblock(blkHash, 2) //verbose
    if (block == undefined) {
        return undefined
    }
    //console.log(block)
    return block.tx
}

export async function scan() {
    await InitDB()
    let latestSyncHeight = 792765;
    let latestSyncTxPos = -1;
    let syncInfo = await GetSyncInfo()
    if (syncInfo != undefined) {
        latestSyncHeight = syncInfo.latestSyncHeight
        latestSyncTxPos = syncInfo.latestSyncTxPos
    }
    let txs = await getBlockTxs(latestSyncHeight)
    if (txs == undefined) {
        throw new Error("latestSyncHeight should exist!")
    }
    if (txs.length == latestSyncTxPos + 1) {
        latestSyncHeight++
        latestSyncTxPos = -1
    }
    for (let h = latestSyncHeight; ;) {
        console.log("handle block:%d", h)
        let txs = await getBlockTxs(h)
        //console.log(txs)
        if (txs === undefined) {
            // we suppose 'getBlockTxs' not return undefined as of network error,
            // so we think we have caught the chain tip here,
            // todo: and we scan mempool in loop mode here
            await sleep(6 * 1000) // 6s
            continue
        }
        for (let i in txs) {
            if (latestSyncHeight == h && i <= latestSyncTxPos) {
                continue
            }
            console.log("handle tx: %s in block:%d", txs[i].txid, h)
            await collectUtxoInfos(txs[i])
            await InsertOrUpdateSyncInfo(h, i)
        }
        h++
    }
}

async function collectUtxoInfos(tx) {
    for (let i in tx.vin) {
        let vin = tx.vin[i]
        if (vin.txid == undefined) {
            // it is a coinbase, skip
            continue
        }
        let id = vin.txid + "-" + vin.vout
        //todo: support spentByList later, cannot delete utxo in recent nine blocks and mempool, it may reorg
        await DeleteUtxo(id)
    }
    for (let i in tx.vout) {
        let vout = tx.vout[i]
        let tokenData = vout.tokenData
        if (tokenData !== undefined) {
            let utxo = {
                id: tx.txid + "-" + i,
                lockScript: vout.scriptPubKey?.hex,
                bchValue: vout.value,
                category: tokenData.category,
                tokenAmount: tokenData.amount,
                nftCommitment: tokenData.nft?.commitment,
                nftCapability: tokenData.nft?.capability
            }
            if (vout.scriptPubKey.addresses != undefined) {
                utxo.owner = vout.scriptPubKey.addresses[0]
            }
            utxo.addTime = Date.now()
            await InsertUtxoIntoDB(utxo)
            console.log("insert new token utxo:")
            console.log(utxo)
        }
    }
}

// async function test() {
//     await scan()
// }
//
// await test()
