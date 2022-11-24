const { expect } = require('chai');


const { buildContractClass, bsv, PubKeyHash, toHex, Int, getPreimage, PubKey, Bool, signTx } = require('scryptlib');

const { loadDesc, newTx, inputSatoshis } = require('../helper');
const { mineFieldMimc, zokratesProof, mineFieldArrToInt } = require('../src/util');

const privateKeyPlayer = new bsv.PrivateKey.fromRandom('testnet')
const publicKeyPlayer = bsv.PublicKey.fromPrivateKey(privateKeyPlayer)

const privateKeyServer = new bsv.PrivateKey.fromRandom('testnet')
const publicKeyServer = bsv.PublicKey.fromPrivateKey(privateKeyServer)

const mineFieldArr = [
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

describe('Test sCrypt contract Minesweeper In Javascript', () => {
  let mineField, mineFieldCommit, minesweeper, result

  before(async () => {
    const Minesweeper = buildContractClass(loadDesc('minesweeper'));

    mineField = await mineFieldArrToInt(mineFieldArr);
    mineFieldCommit = await mineFieldMimc(mineField);

    minesweeper = new Minesweeper(
      new PubKey(toHex(publicKeyPlayer)),
      new PubKey(toHex(publicKeyServer)),
      new Int(mineFieldCommit), 
      0,
      new Bool(true),
      0, 0
    );
  });

  it('play interaction', async () => {
    // Player marks field field (3, 5) to be revealed, he also flips players turn flag, as the
    // smart contract requires him to.
    let x = 3;
    let y = 5;
    newStates = {
      successfulReveals: 0,
      playersTurn: false,
      lastRevealX: x,
      lastRevealY: y
    };

    let tx = newTx();

    tx.addOutput(new bsv.Transaction.Output({
      script: minesweeper.getNewStateScript(newStates),
      satoshis: inputSatoshis
    }))

    let sig = signTx(tx, privateKeyPlayer, minesweeper.lockingScript, inputSatoshis)
    let preimage = getPreimage(tx, minesweeper.lockingScript, inputSatoshis);
    let context = { tx, inputIndex: 0, inputSatoshis: inputSatoshis };

    const Proof = minesweeper.getTypeClassByType("Proof");
    const G1Point = minesweeper.getTypeClassByType("G1Point");
    const G2Point = minesweeper.getTypeClassByType("G2Point");
    const FQ2 = minesweeper.getTypeClassByType("FQ2");

    result = minesweeper.reveal(sig, x, y, inputSatoshis, preimage).verify(context);
    expect(result.success, result.error).to.be.true;
    
    // Save the new state.
    minesweeper.successfulReveals = newStates.successfulReveals;
    minesweeper.playersTurn = newStates.playersTurn;
    minesweeper.lastRevealX = newStates.lastRevealX;
    minesweeper.lastRevealY = newStates.lastRevealY;
    
    
    //////////////////////////////////

    // Now it's the servers turn to make an assesment whether the player hit a mine or not.
    // It does this by providing a valid proof for our ZK circuit along with the correct parameters.
    // He also determines the number of neighboring mines. The proof also ensures this number is correct.
    
    let isMine = false;        // In a real application this is determined dynamically. Here for testing purposes we know that
                               // the field doesn't hide a mine and that it has 3 neighboring mines.
    let neighborMineCount = 3;
    let {proof, output} = await zokratesProof(mineField, mineFieldCommit, x, y, isMine, neighborMineCount);
    
    newStates = {
      successfulReveals: 1, // Increment score since (3, 5) is not a mine.
      playersTurn: true,    // Flip flag back for players turn
      lastRevealX: newStates.lastRevealX,
      lastRevealY: newStates.lastRevealY
    };

    tx = newTx();
    tx.addOutput(new bsv.Transaction.Output({
      script: minesweeper.getNewStateScript(newStates),
      satoshis: inputSatoshis
    }))

    sig = signTx(tx, privateKeyServer, minesweeper.lockingScript, inputSatoshis)
    preimage = getPreimage(tx, minesweeper.lockingScript, inputSatoshis);
    context = { tx, inputIndex: 0, inputSatoshis: inputSatoshis };

    result = minesweeper.update(sig, isMine, neighborMineCount, new Proof({
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
    }), inputSatoshis, preimage).verify(context);
    expect(result.success, result.error).to.be.true;

  }).timeout(2000000);;

});

