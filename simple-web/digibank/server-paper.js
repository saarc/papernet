// ExpressJS Setup
const express = require('express');
const app = express();
var bodyParser = require('body-parser');

// Hyperledger Bridge
const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const ccpPath = path.resolve(__dirname,'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// Constants
const PORT = 3000;
const HOST = '0.0.0.0';

var ADMINNAME = '';
var USERNAME = '';

// use static file
app.use(express.static(path.join(__dirname, 'views')));

// configure app to use body-parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
    
        const userExists = await wallet.exists(USERNAME);
        if (!userExists) {
            console.log(`cc_call`);
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
            return;
        }
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: USERNAME, discovery: { enabled: true, asLocalhost: true } });
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

app.post('/u', async(req, res)=>{

    try {

        const fixtures = path.resolve(__dirname, '../../two-network');

        // A wallet stores a collection of identities
        const wallet = new FileSystemWallet('wallet');

        // Identity to credentials to be stored in the wallet
        const credPath = path.join(fixtures, '/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com');
        const cert = fs.readFileSync(path.join(credPath, '/msp/signcerts/Admin@org1.example.com-cert.pem')).toString();
        const key = fs.readFileSync(path.join(credPath, '/msp/keystore/d4539390721fa08556af4c9da73042ec12bd7e7a1c81c4204e7db6839e1261bf_sk')).toString();

        // Load credentials into wallet
        ADMINNAME = 'admin';
        const identityLabel = 'admin';
        const identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);

        await wallet.import(identityLabel, identity);

        const myobj = {result: "success"}
        res.status(200).json(myobj)

    } catch (error) {
        const myobj = {result: "fail"}
        res.status(401).json(myobj)
    }
});

app.post('/uc', async(req, res)=>{
    try {

        const id = req.query.param1;

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(id);
        if (userExists) {
            console.log('An identity for the user "user1" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists(ADMINNAME);
        if (!adminExists) {
            console.log(`An identity for the admin user ${ADMINNAME} does not exist in the wallet`);
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: ADMINNAME, discovery: { enabled: false } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: id, role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
        USERNAME=id;
        wallet.import(id, userIdentity);
        console.log('Successfully registered and enrolled admin user "user1" and imported it into the wallet');

        const myobj = {result: "success"}
        res.status(200).json(myobj)

    } catch (error) {
        console.error(`Failed to register user "${id}": ${error}`);
       
        const myobj = {result: "fail"}
        res.status(401).json(myobj)
    }
});  



async function cc_call(fn_name, args){


    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const userExists = await wallet.exists(USERNAME);
    if (!userExists) {
        console.log(`cc_call`);
        console.log('An identity for the user "user1" does not exist in the wallet');
        console.log('Run the registerUser.js application before retrying');
        return;
    }
    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: USERNAME, discovery: { enabled: true, asLocalhost: true } });
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