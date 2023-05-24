import {DataTypes, Sequelize} from 'sequelize';

let Utxos;
let SyncInfo;

export async function InitDB() {
    const sequelize = new Sequelize(
        {
            dialect: 'sqlite',
            storage: './token.sqlite',
            logging: false,
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
    await Utxos.create(
        {
            id: utxo.id,
            lockScript: utxo.lockScript,
            bchValue: utxo.bchValue,
            category: utxo.category,
            tokenAmount: utxo.tokenAmount,
            nftCommitment: utxo.nftCommitment,
            nftCapability: utxo.nftCapability,
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
