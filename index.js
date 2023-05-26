import express from 'express';
import bodyParser from 'body-parser';
import {scan} from "./src/bch.js";
import {
    GetUtxosByBytecode,
    GetUtxosByCategory,
    GetUtxosByCategoryAndCommitment,
    GetUtxosByCommitment,
    GetUtxosByConstructorArgs,
    GetUtxosByConstructorArgsAndBytecode
} from "./src/db.js";

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('This is cash token db');
});

app.get('/utxos', async (req, res) => {
    let utxos;
    let category = req.query.category;
    let nftCommitment = req.query.commitment;
    let args = req.query.args;
    let bytecode = req.query.args;

    if (category != undefined && nftCommitment != undefined) {
        utxos = await GetUtxosByCategoryAndCommitment(category, nftCommitment);
    } else if (category != undefined) {
        utxos = await GetUtxosByCategory(category);
    } else if (nftCommitment != undefined) {
        utxos = await GetUtxosByCommitment(nftCommitment);
    } else if (args != undefined && bytecode != undefined) {
        utxos = await GetUtxosByConstructorArgsAndBytecode(args, bytecode)
    } else if (args != undefined) {
        utxos = await GetUtxosByConstructorArgs(args)
    } else if (bytecode != undefined) {
        utxos = await GetUtxosByBytecode(bytecode)
    } else {
        res.send("invalid query param")
        return
    }
    res.send(utxos);
});

const listenPort = 8001

app.listen(listenPort, async () => {
    console.log('listening port: ', listenPort);
    await scan()
});
