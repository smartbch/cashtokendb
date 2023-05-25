import express from 'express';
import bodyParser from 'body-parser';
import {scan} from "./src/bch.js";
import {GetUtxosByCategory, GetUtxosByCommitment} from "./src/db.js";

const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('This is cash token db');
});

app.get('/utxos', async (req, res) => {
    let utxos;
    let category = req.query.category;
    if (category) {
        utxos = await GetUtxosByCategory(category);
    } else {
        let nftCommitment = req.query.commitment;
        if (nftCommitment == undefined) {
            res.send("invalid query param")
            return
        }
        utxos = await GetUtxosByCommitment(nftCommitment)
    }
    res.send(utxos);
});

const listenPort = 8001

app.listen(listenPort, async () => {
    console.log('listening port: ', listenPort);
    await scan()
});
