import express from 'express';
import bodyParser from 'body-parser';
import {scan} from "./src/bch.js";
import {
    GetUtxos
} from "./src/db.js";
import cors from 'cors';

const app = express();
// app.use(cors())
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('This is cash token db');
});

app.post('/utxos', async (req, res) => {
    let utxos;
    let recheck = req.url.recheck
    utxos = await GetUtxos(req.body, recheck)
    res.send(utxos);
});

const listenPort = 8001

app.listen(listenPort, async () => {
    console.log('listening port: ', listenPort);
    await scan()
});
