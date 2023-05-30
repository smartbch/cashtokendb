import {BCH, HttpProvider} from 'bchjs';
import {DeleteUtxo, GetSyncInfo, InitDB, InsertOrUpdateSyncInfo, InsertUtxoIntoDB, UpdateSpentByList} from './db.js'
import {sleep} from "./util.js";
import {BITBOX} from 'bitbox-sdk';
import {binToHex, hash160, hexToBin} from "@bitauth/libauth";

const bitbox = new BITBOX();

const url = ''
const username = ''
const password = ''

const genesisScanHeight = 792766;
const defaultTxPos = -1
const finalizeNumber = 9

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
    return await bch.rpc.getblockcount()
}

export async function scan() {
    await InitDB()
    let latestSyncHeight = genesisScanHeight;
    let latestSyncTxPos = defaultTxPos;
    let syncInfo = await GetSyncInfo()
    if (syncInfo != undefined) {
        latestSyncHeight = syncInfo.latestSyncHeight
        latestSyncTxPos = syncInfo.latestSyncTxPos
    }
    let [txs,] = await getBlockTxsAndPrevBlkHash(latestSyncHeight)
    if (txs == undefined) {
        throw new Error("latestSyncHeight should exist!")
    }
    if (txs.length == latestSyncTxPos + 1) {
        latestSyncHeight++
    }
    let latestHeight = await getLatestBlockHeight()
    let latestFinalizedHeight
    for (; latestHeight >= latestSyncHeight + finalizeNumber;) {
        // catchup the chain tip, block behind (include) latestSyncHeight all finalized
        latestFinalizedHeight = latestHeight - finalizeNumber
        await catchup(latestSyncHeight, latestFinalizedHeight)
        // we catch the latestFinalizedHeight prev found, but the latestHeight may out of date,
        // refresh the latestFinalizedHeight and recheck the latestHeight vs latestSyncHeight + finalizeNumber
        latestSyncHeight = latestFinalizedHeight + 1
        latestHeight = await getLatestBlockHeight()
    }
    // latestSyncHeight is not finalized
    await handleBlocks(latestSyncHeight, latestHeight, AddTxidToSpentByList)
    // handle the latest block and new finalized block and mempool
    let prevBlkHash = await bch.rpc.getblockhash(latestHeight); //todo: move to SyncInfo
    for (let h = latestHeight + 1; ;) {
        let [txs, newPrevBlkHash] = await getBlockTxsAndPrevBlkHash(h)
        if (txs == undefined) {
            // handle mempool here
            await handleMempool()
            await sleep(6 * 1000) // handle mempool txs every 6s
        } else {
            // 1. handle the newest finalized block first, this block maybe never see before, so both handle input and output,
            // note that, the output handle support reentrant.
            await handleFinalizeBlock(h - finalizeNumber)
            // 2. check if reorg, if yes, handle the blocks we not have seen before
            if (newPrevBlkHash != prevBlkHash) {
                // be rough, we get all blocks not finalized when reorg happen
                await handleBlocks(h - finalizeNumber + 1, h - 1, AddTxidToSpentByList)
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
    console.log("handle mempool")
    let txs = await bch.rpc.getrawmempool();
    //console.log("txs number in mempool:", txs.length)
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
    console.log("new txs number in mempool:", newTxs.length)
    for (let i = 0; i < newTxs.length; i++) {
        let tx = await bch.rpc.getrawtransaction(newTxs[i], true)
        //console.log(tx)
        if (tx == undefined) {
            continue
        }
        await collectUtxoInfos(newTxs[i], AddTxidToSpentByList)
    }
}

async function handleFinalizeBlock(h) {
    console.log("handle new finalized block:%d", h)
    await handleBlocks(h, h, deleteUtxoById)
}

async function AddTxidToSpentByList(spentUtxoId, txid) {
    await UpdateSpentByList(spentUtxoId, txid)
}

async function deleteUtxoById(spentUtxoId, txid) {
    await DeleteUtxo(spentUtxoId)
}

async function catchup(latestSyncHeight, latestFinalizedHeight) {
    console.log("In catchup, latestSyncHeight:%d,latestFinalizedHeight:%d", latestSyncHeight, latestFinalizedHeight)
    await handleBlocks(latestSyncHeight, latestFinalizedHeight, deleteUtxoById)
}

let idsToBeDeletedInBlock = [];

async function handleBlocks(startHeight, endHeight, handleSpentUtxoFunc) {
    for (let h = startHeight; h <= endHeight; h++) {
        console.log("handle block:%d", h)
        idsToBeDeletedInBlock = []
        let txs;
        [txs,] = await getBlockTxsAndPrevBlkHash(h)
        //console.log(txs)
        for (; txs === undefined;) {
            // try until we got
            await sleep(6 * 1000); // 6s
            [txs,] = await getBlockTxsAndPrevBlkHash(h)
        }
        for (let i in txs) {
            //console.log("handle tx: %s in block:%d", txs[i].txid, h)
            await collectUtxoInfos(txs[i], handleSpentUtxoFunc)
            await InsertOrUpdateSyncInfo(h, i)
        }
    }
}

function parseRevealedInfo(vout, voutNext) {
    if (vout.scriptPubKey.type != 'scripthash') {
        return
    }
    if (voutNext.scriptPubKey.type != 'nulldata') {
        return
    }
    let items = voutNext.scriptPubKey.asm.split(' ');
    if (items.length != 3) {
        return
    }
    // find the P2SH identifier
    if (!voutNext.scriptPubKey.hex.startsWith('6a0450325348')) { // OP_RETURN P2SH
        return
    }
    // get the redeem script from op return
    let redeemScript = items[2];
    let scriptHash = binToHex(hash160(hexToBin(redeemScript)))
    // get the real script hash in vout
    items = vout.scriptPubKey.asm.split(' ');
    if (items.length != 3) {
        return
    }
    // check if two script hash same
    if (items[1] != scriptHash) {
        return
    }
    // now, it is a revealer, parse it.
    return extractArgsAndByteCode(redeemScript)
}

async function collectUtxoInfos(tx, handleSpentUtxoFunc) {
    for (let i in tx.vin) {
        let vin = tx.vin[i]
        if (vin.txid == undefined) {
            // it is a coinbase, skip
            continue
        }
        let id = vin.txid + "-" + vin.vout
        idsToBeDeletedInBlock.push(id)
        await handleSpentUtxoFunc(id, tx.txid)
    }
    for (let i in tx.vout) {
        let vout = tx.vout[i];
        let revealedInfo = undefined;
        if (i < tx.vout.length - 1) {
            revealedInfo = parseRevealedInfo(vout, tx.vout[1 + Number(i)]);
        }
        let tokenData = vout.tokenData;
        if (tokenData !== undefined || revealedInfo !== undefined) {
            let utxo = {
                id: tx.txid + "-" + i,
                lockScript: vout.scriptPubKey?.hex,
                bchValue: vout.value,
                category: tokenData?.category,
                tokenAmount: tokenData?.amount,
                covenantBytecode: revealedInfo?.covenantBytecode,
                constructorArg0: revealedInfo?.constructorArgs.arg0,
                constructorArg1: revealedInfo?.constructorArgs.arg1,
                constructorArg2: revealedInfo?.constructorArgs.arg2,
                constructorArg3: revealedInfo?.constructorArgs.arg3,
                constructorArgs: revealedInfo?.constructorArgs.args,
                nftCommitment: tokenData?.nft?.commitment,
                nftCapability: tokenData?.nft?.capability
            }
            if (idsToBeDeletedInBlock.indexOf(utxo.id) >= 0) {
                console.log("id:%s already be spent somewhere before in the same block", utxo.id)
                continue
            }
            if (vout.scriptPubKey?.addresses != undefined) {
                utxo.owner = vout.scriptPubKey.addresses[0]
            }
            utxo.addTime = Date.now()
            await InsertUtxoIntoDB(utxo)
            console.log("insert new token utxo:", utxo.id)
        }
    }
}

const pushOps = [
    'OP_0', 'OP_FALSE',
    'OP_PUSHDATA1', 'OP_PUSHDATA2', 'OP_PUSHDATA4',
    'OP_1NEGATE',
    'OP_1', 'OP_TRUE',
    'OP_2', 'OP_3', 'OP_4', 'OP_5',
    'OP_6', 'OP_7', 'OP_8', 'OP_9',
    'OP_10', 'OP_11', 'OP_12', 'OP_13',
    'OP_14', 'OP_15', 'OP_16'
]

function extractArgsAndByteCode(redeemScript) {
    let scriptSigBuffer = Buffer.from(redeemScript, 'hex');
    let asm = bitbox.Script.toASM(scriptSigBuffer)
    let items = asm.split(' ')
    let constructorArgs = {
        arg0: "",
        arg1: "",
        arg2: "",
        arg3: "",
        args: "",
    }
    let i;
    for (i = 0; i < items.length; i++) {
        let item = items[i];
        if (item.startsWith("OP_") && pushOps.indexOf(item) < 0) {
            break
        }
        if (constructorArgs.arg0.length == 0) {
            constructorArgs.arg0 = item;
        } else if (constructorArgs.arg1.length == 0) {
            constructorArgs.arg1 = item;
        } else if (constructorArgs.arg2.length == 0) {
            constructorArgs.arg2 = item;
        } else if (constructorArgs.arg3.length == 0) {
            constructorArgs.arg3 = item;
        } else {
            constructorArgs.args = constructorArgs.args + " " + item;
        }
    }
    if (constructorArgs.arg0.length == 0) {
        return {
            covenantBytecode: redeemScript,
            constructorArgs: constructorArgs,
        }
    }
    let args = bitbox.Script.fromASM(items.slice(0, i).join(' ')).toString('hex')
    let byteCode = redeemScript.substring(args.length)
    return {
        covenantBytecode: byteCode,
        constructorArgs: constructorArgs,
    }
}
