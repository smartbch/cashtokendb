import {DataTypes, Op, Sequelize} from 'sequelize';

let Utxos;
let SyncInfo;

export async function InitDB() {
    const sequelize = new Sequelize(
        {
            dialect: 'sqlite',
            storage: './token.sqlite',
            logging: false,
            query:{raw:true}
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
    }
    //console.log("spentByList:", spentByList)
    await Utxos.update({spentByList: spentByList}, {where: {id: id}})
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
