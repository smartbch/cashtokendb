import {BCH, HttpProvider} from 'bchjs';
import {DeleteUtxo, GetSyncInfo, InitDB, InsertOrUpdateSyncInfo, InsertUtxoIntoDB, UpdateSpentByList} from './db.js'
import {sleep} from "./util.js";

let url = ''
let username = ''
let password = ''

const httpBlockchainProvider = new HttpProvider(url, username, password);
const bch = new BCH(httpBlockchainProvider, httpBlockchainProvider);

async function getBlockTxsAndPrevBlkHash(height) {
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
    return [block.tx, block.previousblockhash]
}

async function getLatestBlockHeight() {
    return await bch.rpc.getBlockCount()
}

const genesisScanHeight = 792766;
const defaultTxPos = -1
const finalizeNumber = 9

export async function scan() {
    await InitDB()
    let latestSyncHeight = genesisScanHeight;
    let latestSyncTxPos = defaultTxPos;
    let syncInfo = await GetSyncInfo()
    if (syncInfo != undefined) {
        latestSyncHeight = syncInfo.latestSyncHeight
        latestSyncTxPos = syncInfo.latestSyncTxPos
    }
    let txs = await getBlockTxsAndPrevBlkHash(latestSyncHeight)
    if (txs == undefined) {
        throw new Error("latestSyncHeight should exist!")
    }
    if (txs.length == latestSyncTxPos + 1) {
        latestSyncHeight++
        latestSyncTxPos = defaultTxPos
    }
    let latestHeight = await getLatestBlockHeight()
    let latestFinalizedHeight
    for (; latestHeight >= latestSyncHeight + finalizeNumber;) {
        // catchup the chain tip, block behind (include) latestSyncHeight all finalized
        latestFinalizedHeight = latestHeight - finalizeNumber
        await catchup(latestSyncHeight, latestSyncTxPos, latestFinalizedHeight)
        // we catch the latestFinalizedHeight prev found, but the latestHeight may out of date,
        // refresh the latestFinalizedHeight and recheck the latestHeight vs latestSyncHeight + finalizeNumber
        latestSyncHeight = latestFinalizedHeight + 1
        latestSyncTxPos = defaultTxPos
        latestHeight = await getLatestBlockHeight()
    }
    // latestSyncHeight is not finalized
    await handleBlocks(latestSyncHeight, latestSyncTxPos, latestHeight, AddTxidToSpentByList)
    // handle the latest block and new finalized block and mempool
    let prevBlkHash = await bch.rpc.getblockhash(latestHeight); //todo: move to SyncInfo
    for (let h = latestHeight + 1; ;) {
        let [txs, newPrevBlkHash] = await getBlockTxsAndPrevBlkHash(h)
        if (txs == undefined) {
            // handle mempool here
            await handleMempool()
            await sleep(6 * 1000) // handle mempool txs every 6s
        } else {
            // 1. handle the newest finalized block first
            await handleFinalizeBlock(h - finalizeNumber)
            // 2. check if reorg, if yes, handle the blocks we not have seen before
            if (newPrevBlkHash != prevBlkHash) {
                // be rough, we get all blocks not finalized when reorg happen
                await handleBlocks(h - finalizeNumber + 1, -1, h - 1, AddTxidToSpentByList)
            }
            prevBlkHash = newPrevBlkHash
            // 3. if not, handle the newest tip block txs
            for (let i in txs) {
                console.log("handle tx: %s in block:%d", txs[i].txid, h)
                await collectUtxoInfos(txs[i], AddTxidToSpentByList)
                await InsertOrUpdateSyncInfo(h, i)
            }
            // handle next block
            h++
        }
    }
}

let oldTxsInMempool;

async function handleMempool() {
    let txs = await bch.rpc.getrawmempool();
    if (txs == undefined) {
        return
    }
    let newTxs;
    if (oldTxsInMempool == undefined) {
        oldTxsInMempool = txs
        newTxs = txs
    } else {
        newTxs = txs.filter(x => oldTxsInMempool.indexOf(x) === -1)
    }
    for (let i = 0; i < newTxs.length; i++) {
        let tx = await bch.rpc.getrawtransaction(newTxs[i], true)
        if (tx == undefined) {
            continue
        }
        await collectUtxoInfos(txs[i], AddTxidToSpentByList)
    }
}

async function handleFinalizeBlock(h) {
    await handleBlocks(h, -1, h, deleteUtxoById)
}

async function AddTxidToSpentByList(spentUtxoId, txid) {
    await UpdateSpentByList(spentUtxoId, txid)
}

async function deleteUtxoById(spentUtxoId, txid) {
    await DeleteUtxo(spentUtxoId)
}

async function catchup(latestSyncHeight, latestSyncTxPos, latestFinalizedHeight) {
    await handleBlocks(latestSyncHeight, latestSyncTxPos, latestFinalizedHeight, deleteUtxoById)
}

async function handleBlocks(startHeight, startTxPos, endHeight, handleSpentUtxoFunc) {
    for (let h = startHeight; h <= endHeight; h++) {
        console.log("handle block:%d", h)
        let txs = await getBlockTxsAndPrevBlkHash(h)
        //console.log(txs)
        for (; txs === undefined;) {
            // try until we got
            await sleep(6 * 1000) // 6s
            txs = await getBlockTxsAndPrevBlkHash(h)
        }
        for (let i in txs) {
            if (startHeight == h && i <= startTxPos) {
                continue
            }
            console.log("handle tx: %s in block:%d", txs[i].txid, h)
            await collectUtxoInfos(txs[i], handleSpentUtxoFunc)
            await InsertOrUpdateSyncInfo(h, i)
        }
    }
}

async function collectUtxoInfos(tx, handleSpentUtxoFunc) {
    for (let i in tx.vin) {
        let vin = tx.vin[i]
        if (vin.txid == undefined) {
            // it is a coinbase, skip
            continue
        }
        let id = vin.txid + "-" + vin.vout
        //todo: support spentByList later, cannot delete utxo in recent nine blocks and mempool, it may reorg
        await handleSpentUtxoFunc(id)
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
