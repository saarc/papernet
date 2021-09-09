// ExpressJS Setup
const express = require('express');
const app = express();
var bodyParser = require('body-parser');

// Hyperledger Bridge
const { FileSystemWallet, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const ccpPath = path.resolve(__dirname,'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// Constants
const PORT = 3000;
const HOST = '0.0.0.0';

// use static file
app.use(express.static(path.join(__dirname, 'views')));

// configure app to use body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// main page routing
app.get('/', (req, res)=>{
    res.sendFile(__dirname + '/index-paper.html');
});


// paper issue // 생성
app.post('/paper', async(req, res)=>{
    const mode = req.body.mode;

    if(mode == 'issue')
    {
        const issuer = req.body.issuer;
        const pid = req.body.pid;
        const idate = req.body.idate;
        const mdate = req.body.mdate;
        const fvalue = req.body.fvalue;
        result = cc_call('issue', [issuer, pid, idate, mdate, fvalue])
    }else if(mode == 'buy'){
        const pid = req.body.pid;
        const from = req.body.from;
        const to = req.body.to;
        const price = req.body.price;
        result = cc_call('buy', [pid, from, to, price])
    }else if(mode == 'redeem'){
        const pid = req.body.pid;
        const from = req.body.from;
        const to = req.body.to;
        result = cc_call('redeem', [pid, from, to])
    }
    const myobj = {result: "success"}
    res.status(200).json(myobj)
});

// history
app.get('/paper', async(req, res)=>{

    try {
        const id = req.query.pid;
        console.log(`${id}`);

        //result = cc_call('history', [id])

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
    
        const userExists = await wallet.exists('user1');
        if (!userExists) {
            console.log(`cc_call`);
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
            return;
        }
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'user1', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('papercontract');
        
        result = await contract.evaluateTransaction('history', id);
        
        gateway.disconnect();
        
        console.log(`${result}`);
        const myobj = JSON.parse(result)

        
        res.status(200).json(myobj)

    }
    catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        //process.exit(1);
    }
});

async function cc_call(fn_name, args){


    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists('user1');
    if (!userExists) {
        console.log(`cc_call`);
        console.log('An identity for the user "user1" does not exist in the wallet');
        console.log('Run the registerUser.js application before retrying');
        return;
    }
    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: 'user1', discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('papercontract');

    var result;

    if(fn_name == 'issue'){
        result = await contract.submitTransaction('issue', args[0],args[1],args[2],args[3],args[4]);
    }else if(fn_name == 'buy'){
        result = await contract.submitTransaction('buy', args[0],args[1],args[2],args[3]);
    }else if(fn_name == 'redeem'){
        result = await contract.submitTransaction('redeem', args[0],args[1],args[2]);
    }else if(fn_name == 'history'){
        result = await contract.evaluateTransaction('history', args[0]);
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);
    }else{
        result = 'not supported function'
    }

    gateway.disconnect();

    return result;
}

// server start
app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);