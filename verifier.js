const { buildContractClass, PubKey, bsv,  Int,  buildTypeClasses, toHex, getPreimage, signTx } = require('scryptlib');
const assert = require('assert');
const { loadDesc,deployContract, createInputFromPrevTx, sendTx } = require('./helper');
const { privateKey } = require('./privateKey');
const { zokratesProof, mineFieldMimc, mineFieldArrToInt } = require('./src/util');

bsv.Transaction.FEE_PER_KB = 0.0001;

async function run() {

  console.log('zokrates generating proof ...')
  
  let mineFieldArr = [
    0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,
    0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,
    0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
    0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,
    0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,
    0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,
    0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,
    0,1,0,0,0,0,1,0,0,0,0,1,1,0,0,
    0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,
  ];
  
  let mineField = mineFieldArrToInt(mineFieldArr);
  let mineFieldCommit = mineFieldMimc(mineField);
  let x = 3;
  let y = 5;
  let isMine = false;
  let neighborMineCount = 3;

  const {proof, output} = await zokratesProof(mineField, mineFieldCommit, x, y, isMine, neighborMineCount);

  console.log('compiling contract ...')

  const Verifier = buildContractClass(loadDesc('verifier'));

  const { Proof, G1Point, G2Point, FQ2 } = buildTypeClasses(Verifier);
  const verifier = new Verifier();

  console.log("Simulate a verification call ...");

  const unlockCall = verifier.unlock(proof.inputs.map(input => new Int(input)),
    new Proof({
      a: new G1Point({
        x: new Int(proof.proof.a[0]),
        y: new Int(proof.proof.a[1]),
      }),
      b: new G2Point({
        x: new FQ2({
          x: new Int(proof.proof.b[0][0]),
          y: new Int(proof.proof.b[0][1]),
        }),
        y: new FQ2({
          x: new Int(proof.proof.b[1][0]),
          y: new Int(proof.proof.b[1][1]),
        })
      }),
      c: new G1Point({
        x: new Int(proof.proof.c[0]),
        y: new Int(proof.proof.c[1]),
      })
    })
  );

  const result = unlockCall.verify();

  assert.ok(result.success, result.error)
  console.log("Verification OK");

  console.log('start deploying zkSNARK verifier ... ')
  const tx = await deployContract(verifier, 1000);
  console.log('deployed txid:     ', tx.id)

  const unlockingTx = new bsv.Transaction();
  unlockingTx.addInput(createInputFromPrevTx(tx))
  .change(privateKey.toAddress())
  .setInputScript(0, (_) => {
      return unlockCall.toScript();
  })
  .seal()

  
  // unlock
  console.log('start calling zkSNARK verifier ... ')
  await sendTx(unlockingTx)

  console.log('unlocking txid:     ', unlockingTx.id)

  console.log('Succeeded on testnet')

}


async function deploy() {

  const privateKeyPlayer = new bsv.PrivateKey.fromRandom('testnet');

  const publicKeyPlayer = bsv.PublicKey.fromPrivateKey(privateKeyPlayer);
  const pkhPlayer = bsv.crypto.Hash.sha256ripemd160(publicKeyPlayer.toBuffer());
  const addressPlayer = privateKeyPlayer.toAddress();

  const privateKeyServer = new bsv.PrivateKey.fromRandom('testnet');

  const publicKeyServer = bsv.PublicKey.fromPrivateKey(privateKeyServer);
  const pkhServer = bsv.crypto.Hash.sha256ripemd160(publicKeyServer.toBuffer());
  const addressServer = privateKeyServer.toAddress();


  console.log('generating proof ...')

  let mineFieldArr = [
    0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,
    0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,
    0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
    0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,
    0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,
    0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,
    0,0,1,1,1,1,0,0,0,0,0,0,0,1,0,
    0,1,0,0,0,0,1,0,0,0,0,1,1,0,0,
    0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,
  ];
  
  let mineField = mineFieldArrToInt(mineFieldArr);
  let mineFieldCommit = mineFieldMimc(mineField);

  const Minesweeper = buildContractClass(loadDesc('minesweeper'));

  const { Proof, G1Point, G2Point, FQ2 } = buildTypeClasses(Minesweeper);

  const minesweeper = new Minesweeper(
    new PubKey(toHex(publicKeyPlayer)),
    new PubKey(toHex(publicKeyComputer)),
    new Int(mineFieldCommit), 
    0,
    new Bool(true),
    0, 0
  );

  console.log("deploying  ...");
  const initAmount = 1000;
  const deployTx = await deployContract(minesweeper, initAmount);

  console.log("deployed:", deployTx.id);

  let newLockingScript = minesweeper.getNewStateScript({
      successfulReveals: 0,
      playersTurn: false,
      lastRevealX: 3,
      lastRevealX: 5
  });

  let unlockingTx = new bsv.Transaction();

  unlockingTx.addInput(createInputFromPrevTx(deployTx))
  unlockingTx.setOutput(0, (tx) => {
    const amount = initAmount- tx.getEstimateFee();

    if(amount < 1) {
      throw new Error('Not enough funds.')
    }

    return new bsv.Transaction.Output({
      script: newLockingScript,
      satoshis: amount,
    })
  })
  .setInputScript(0, (tx, output) => {
    const preimage = getPreimage(tx, output.script, output.satoshis);
    const privateKey = privateKeyPlayer;
    const sig = signTx(tx, privateKey, output.script, output.satoshis);
    let amount = initAmount - tx.getEstimateFee();
    
    return minesweeper.reveal(sig, 3, 5, amount, preimage).toScript();
  })
  .change(privateKey.toAddress())
  .seal();

  console.log("unlocking ...")
  await sendTx(unlockingTx)

  console.log("unlockingTx OK", unlockingTx.id);
  
  console.log("Servers turn to update contract:");
  
  let neighborMineCount = 3;
  let isMine = false;
  const {proof, output} = await zokratesProof(mineField, mineFieldCommit, 3, 5, isMine, neighborMineCount);

  newLockingScript = minesweeper.getNewStateScript({
      successfulReveals: 1,
      playersTurn: true,
      lastRevealX: 3,
      lastRevealX: 5
  });

  unlockingTx = new bsv.Transaction();

  unlockingTx.addInput(createInputFromPrevTx(deployTx))
  unlockingTx.setOutput(0, (tx) => {
    const amount = initAmount- tx.getEstimateFee();

    if(amount < 1) {
      throw new Error('Not enough funds.')
    }

    return new bsv.Transaction.Output({
      script: newLockingScript,
      satoshis: amount,
    })
  })
  .setInputScript(0, (tx, output) => {
    const preimage = getPreimage(tx, output.script, output.satoshis);
    const privateKey = privateKeyServer;
    const sig = signTx(tx, privateKey, output.script, output.satoshis);
    let amount = initAmount - tx.getEstimateFee();
    
    return minesweeper.update(sig, isMine, neighborMineCount, new Proof({
      a: new G1Point({
        x: new Int(proof.proof.a[0]),
        y: new Int(proof.proof.a[1]),
      }),
      b: new G2Point({
        x: new FQ2({
          x: new Int(proof.proof.b[0][0]),
          y: new Int(proof.proof.b[0][1]),
        }),
        y: new FQ2({
          x: new Int(proof.proof.b[1][0]),
          y: new Int(proof.proof.b[1][1]),
        })
      }),
      c: new G1Point({
        x: new Int(proof.proof.c[0]),
        y: new Int(proof.proof.c[1]),
      })
    }), amount, preimage).toScript();
  })
  .change(privateKey.toAddress())
  .seal();

}

function reverseHex(r) {
  return Buffer.from(r, 'hex').reverse().toString('hex')
}

if(process.argv.includes('--run')) {
  run().then(() => {
    process.exit(0);
  })
  .catch(e => {
    if(e.response) {
      console.error('error: ', e.response.data)
    } else {
      console.error('error: ', e)
    }
  })
}

if(process.argv.includes('--deploy')) {
  deploy().then(() => {
    process.exit(0);
  })
  .catch(e => {
    if(e.response) {
      console.error('error: ', e.response.data)
    } else {
      console.error('error: ', e)
    }
  })
}

module.exports = {
  mineFieldMimc,
  hashShips,
  reverseHex,
  zokratesProof
}

