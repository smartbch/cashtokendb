import {DataTypes, Op, Sequelize} from 'sequelize';
import {decodeCashAddressFormat} from '@bitauth/libauth'
import ElectrumClient from "@tkone7/electrum-client-js";

const electrumHost = ''
const electrumPort = 50004
const electrumProto = "wss"

let electrum = await initElectrumClient()

let Utxos;
let SyncInfo;

export async function InitDB() {
    const sequelize = new Sequelize(
        {
            dialect: 'sqlite',
            storage: './token.sqlite',
            logging: false,
            query: {raw: true}
        }
    );
    //const sequelize = new Sequelize('sqlite::memory:');
    SyncInfo = sequelize.define(
        'meta', {
            latestSyncHeight: DataTypes.INTEGER,
            latestSyncTxPos: DataTypes.INTEGER,
        },
        {timestamps: false}
    );
    Utxos = sequelize.define(
        'utxo', {
            id: { // txid + vout
                type: DataTypes.STRING,
                primaryKey: true,
                allowNull: false
            },
            lockScript: DataTypes.STRING,
            bchValue: DataTypes.BIGINT,
            category: DataTypes.STRING,
            tokenAmount: DataTypes.BIGINT,
            nftCommitment: DataTypes.STRING,
            nftCapability: DataTypes.STRING, // none || mutable || minting
            covenantBytecode: DataTypes.STRING, // covenant's "bare" bytecode compiled by cashscript
            constructorArg0: DataTypes.STRING, // the constructor's #0 arguments
            constructorArg1: DataTypes.STRING, // the constructor's #1 arguments
            constructorArg2: DataTypes.STRING, // the constructor's #2 arguments
            constructorArg3: DataTypes.STRING, // the constructor's #3 arguments
            constructorArgs: DataTypes.STRING, // the constructor's other arguments for a covenant
            owner: DataTypes.STRING,
            spentByList: DataTypes.STRING, // txs separated by comma
            addTime: DataTypes.INTEGER,
            delTime: DataTypes.INTEGER,
        }, {timestamps: false});
    await sequelize.sync()
}

export async function InsertOrUpdateSyncInfo(height, txPos) {
    if (await SyncInfo.findOne({raw: true}) == undefined) {
        console.log("add")
        return await SyncInfo.create(
            {
                latestSyncHeight: height,
                latestSyncTxPos: txPos,
            }
        )
    }
    return await SyncInfo.update(
        {
            latestSyncHeight: height,
            latestSyncTxPos: txPos,
        }, {
            where: {id: 1}
        })
}

export async function GetSyncInfo() {
    return await SyncInfo.findOne({raw: true})
}

export async function InsertUtxoIntoDB(utxo) {
    let utxoInDb = await Utxos.findOne({where: {id: utxo.id}})
    if (utxoInDb != undefined) {
        console.log("utxo:%s already here", utxo.id)
        return
    }
    await Utxos.create(
        {
            id: utxo.id,
            lockScript: utxo.lockScript,
            bchValue: utxo.bchValue,
            category: utxo.category,
            tokenAmount: utxo.tokenAmount,
            nftCommitment: utxo.nftCommitment,
            nftCapability: utxo.nftCapability,
            covenantBytecode: utxo.covenantBytecode,
            constructorArg0: utxo.constructorArg0,
            constructorArg1: utxo.constructorArg1,
            constructorArg2: utxo.constructorArg2,
            constructorArg3: utxo.constructorArg3,
            constructorArgs: utxo.constructorArgs,
            owner: utxo.owner,
            spentByList: utxo.spentByList,
            addTime: utxo.addTime,
        });
}

export async function DeleteUtxo(id) {
    await Utxos.destroy({
        where: {id: id},
    });
}

export async function UpdateSpentByList(id, txid) {
    let utxo = await Utxos.findOne({where: {id: id}})
    if (utxo == undefined) {
        return
    }
    let spentByList = txid
    //console.log(utxo)
    if (utxo.spentByList !== null) {
        let txidList = utxo.spentByList.split(',')
        if (txidList.indexOf(txid) >= 0) {
            return
        }
        spentByList = utxo.spentByList + "," + txid
        await Utxos.update({spentByList: spentByList}, {where: {id: id}})
    } else {
        await Utxos.update({spentByList: spentByList, delTime: Date.now()}, {where: {id: id}})
    }
}

export async function GetUtxosByCategory(category) {
    if (category == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                category: category
            },
            raw: true
        }
    )
}

export async function GetUtxosByCommitment(commitment) {
    if (commitment == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                nftCommitment: commitment
            },
            raw: true
        }
    )
}

export async function GetUtxosByCategoryAndCommitment(category, commitment) {
    if (category == undefined || commitment == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                category: category,
                nftCommitment: commitment
            },
            raw: true
        }
    )
}

// find item that args include in constructorArgs and bytecode exactly equal to covenantBytecode.
export async function GetUtxosByConstructorArgsAndBytecode(args, bytecode) {
    if (args == undefined || bytecode == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                covenantBytecode: bytecode,
                constructorArgs: {
                    [Op.like]: `%${args}%`
                }
            },
            raw: true
        }
    )
}

// find item that args include in constructorArgs
export async function GetUtxosByConstructorArgs(args) {
    if (args == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                constructorArgs: {
                    [Op.like]: `%${args}%`
                }
            },
            raw: true
        }
    )
}

export async function GetUtxosByBytecode(bytecode) {
    if (bytecode == undefined) {
        return
    }
    return await Utxos.findAll(
        {
            where: {
                covenantBytecode: bytecode
            },
            raw: true
        }
    )
}

const validQueryParams = [
    'lockScript',
    'category',
    'nftCommitment', // todo: all hex?
    'nftCapability',
    'covenantBytecode',
    'constructorArg0',
    'constructorArg1',
    'constructorArg2',
    'constructorArg3',
    'constructorArgs',
    'owner', // must valid bch cash address
]

const validNftCapability = [
    'none',
    'minting',
    'mutable'
]

export async function initElectrumClient() {
    const electrum_ = new ElectrumClient(electrumHost, electrumPort, electrumProto);
    await electrum_.connect(
        'cash_token_db',
        '1.4.2'
    )
    return electrum_
}

export async function GetUtxos(params, recheck = true) {
    if (!params instanceof Object) {
        return new Error("invalid query params")
    }
    let queryObj = {};
    let keys = Object.keys(params)
    for (let key of keys) {
        if (validQueryParams.indexOf(key) < 0) {
            return "invalid param:" + key
        }
        if (key === 'nftCapability') {
            if (validNftCapability.indexOf(params[key]) < 0) {
                return "invalid nftCapability:" + params[key]
            }
        } else if (key === 'owner') {
            let res = decodeCashAddressFormat(params[key])
            if (typeof res === 'string' || res instanceof String) {
                return "invalid cash address:" + res.toString()
            }
        } else if (!isHexString(params[key])) {
            return params[key] + " is not hex string"
        }
        queryObj[key] = params[key]
    }
    let utxos = await Utxos.findAll(
        {
            where: queryObj,
            raw: true
        }
    )
    if (recheck) {
        let res = []
        for (let utxo of utxos) {
            if (utxo.spentByList != null) {
                continue
            }
            const info = await getUtxoInfo(utxo.id.substring(0, 64), utxo.id.substring(65,))
            if (info == null) {
                continue
            }
            res.push(utxo)
        }
        return res
    }
    return utxos
}

async function getUtxoInfo(txid, outN) {
    return await electrum.request('blockchain.utxo.get_info', [txid, outN])
}

function isHexString(s) {
    const regex = '^[a-fA-F0-9]+$'
    return s.length % 2 === 0 && s.match(regex) != null
}
