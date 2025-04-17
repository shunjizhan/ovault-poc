import { Options } from '@layerzerolabs/lz-v2-utilities';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';

// Import contract types from typechain-types
import {
  EndpointV2Mock,
  EndpointV2Mock__factory,
  OOperatorV2,
  OOperatorV2__factory,
  OUsdt,
  OUsdt__factory,
  OVaultV2,
  OVaultV2__factory,
  Superstate,
  Superstate__factory,
} from '../../typechain-types';
import { formatEther, parseEther, zeroPad } from 'ethers/lib/utils';

describe('OVaultV2 and OOperatorV2 Test', function () {
  // Constants
  const eidA = 1; // OP-testnet
  const eidB = 2; // Sepolia
  const initialMint = parseEther('1000000000');

  // Contract factories
  let OVaultV2Factory: OVaultV2__factory;
  let OOperatorV2Factory: OOperatorV2__factory;
  let EndpointV2MockFactory: EndpointV2Mock__factory;
  let SuperstateFactory: Superstate__factory;
  let OUsdtFactory: OUsdt__factory;

  // Contract instances
  let oVaultV2: OVaultV2;
  let oOperatorV2: OOperatorV2;
  let mockEndpointV2A: EndpointV2Mock;
  let mockEndpointV2B: EndpointV2Mock;
  let superstate: Superstate;
  let ousdtA: OUsdt; // OUSDT on Chain A (OP-testnet)
  let ousdtB: OUsdt; // OUSDT on Chain B (Sepolia)

  // Signers
  let ownerA: SignerWithAddress;
  let ownerB: SignerWithAddress;
  let endpointOwner: SignerWithAddress;
  let user: SignerWithAddress;

  before(async function () {
    // Get contract factories
    OVaultV2Factory = await ethers.getContractFactory('OVaultV2') as OVaultV2__factory;
    OOperatorV2Factory = await ethers.getContractFactory('OOperatorV2') as OOperatorV2__factory;
    EndpointV2MockFactory = await ethers.getContractFactory('EndpointV2Mock') as EndpointV2Mock__factory;
    SuperstateFactory = await ethers.getContractFactory('Superstate') as Superstate__factory;
    OUsdtFactory = await ethers.getContractFactory('OUsdt') as OUsdt__factory;

    const signers = await ethers.getSigners();
    [ownerA, ownerB, endpointOwner, user] = signers;
  });

  beforeEach(async function () {
    /* -------------------- deploy mock endpoints -------------------- */
    mockEndpointV2A = await EndpointV2MockFactory.deploy(eidA);
    mockEndpointV2B = await EndpointV2MockFactory.deploy(eidB);

    /* -------------------- deploy and connect OUsdt tokens -------------------- */
    ousdtA = await OUsdtFactory.deploy('Omnichain USDT', 'OUSDT', mockEndpointV2A.address, ownerA.address);
    ousdtB = await OUsdtFactory.connect(ownerB).deploy('Omnichain USDT', 'OUSDT', mockEndpointV2B.address, ownerB.address);

    await mockEndpointV2A.setDestLzEndpoint(ousdtB.address, mockEndpointV2B.address);
    await mockEndpointV2B.setDestLzEndpoint(ousdtA.address, mockEndpointV2A.address);

    await ousdtA.connect(ownerA).setPeer(eidB, zeroPad(ousdtB.address, 32));
    await ousdtB.connect(ownerB).setPeer(eidA, zeroPad(ousdtA.address, 32));

    // mint tokens to ownerA
    await ousdtA.connect(ownerA).mint(ownerA.address, initialMint);
    await ousdtB.connect(ownerB).mint(ownerB.address, initialMint);

    /* -------------------- deploy Superstate on "Sepolia" (Chain B) -------------------- */
    superstate = await SuperstateFactory.deploy(ousdtB.address, ownerB.address);

    /* -------------------- deploy OVaultV2 and OOperatorV2 -------------------- */
    oVaultV2 = await OVaultV2Factory.deploy(
      mockEndpointV2A.address,
      ownerA.address,
      eidB,
      ousdtA.address,
    );
    oOperatorV2 = await OOperatorV2Factory.deploy(
      mockEndpointV2B.address,
      ownerB.address,
      ousdtB.address,
      superstate.address,
    );

    await mockEndpointV2A.setDestLzEndpoint(oOperatorV2.address, mockEndpointV2B.address);
    await mockEndpointV2B.setDestLzEndpoint(oVaultV2.address, mockEndpointV2A.address);

    await oVaultV2.connect(ownerA).setPeer(eidB, zeroPad(oOperatorV2.address, 32));
    await oOperatorV2.connect(ownerB).setPeer(eidA, zeroPad(oVaultV2.address, 32));

    console.log('set up finished!');
  });

  it('should be able to directly transfer OFT tokens from chain A to chain B', async function () {
    const recipient = user.address;
    const beforeBal = await ousdtB.balanceOf(recipient);
    console.log('Balance before transfer:', beforeBal.toString());
    const transferAmount = parseEther('10'); // 10 OUSDT

    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();

    const transferParam = {
      dstEid: eidB,
      amountLD: transferAmount,
      minAmountLD: transferAmount,
      to: zeroPad(recipient, 32),
      extraOptions: options,
      composeMsg: '0x',
      oftCmd: '0x',
    };
    const fee = await ousdtA.quoteSend(transferParam, false);
    console.log('Fee for sending ousdt from chain A to chain B:', formatEther(fee.nativeFee));

    await ousdtA.send(transferParam, fee, user.address, { value: fee.nativeFee });

    const afterBal = await ousdtB.balanceOf(recipient);
    console.log('Balance after transfer:', afterBal.toString());
    expect(afterBal.toString()).to.equal(beforeBal.add(transferAmount).toString());
  });

  it('should be able to directly transfer OFT tokens from chain B to chain A', async function () {
    const recipient = user.address;
    const beforeBal = await ousdtA.balanceOf(recipient);
    console.log('Balance before transfer:', beforeBal.toString());
    const transferAmount = parseEther('10'); // 10 OUSDT

    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();

    const transferParam = {
      dstEid: eidA,
      amountLD: transferAmount,
      minAmountLD: transferAmount,
      to: zeroPad(recipient, 32),
      extraOptions: options,
      composeMsg: '0x',
      oftCmd: '0x',
    };
    const fee = await ousdtB.quoteSend(transferParam, false);
    console.log('Fee for sending ousdt from chain B to chain A:', formatEther(fee.nativeFee));

    await ousdtB.send(transferParam, fee, user.address, { value: fee.nativeFee });

    const afterBal = await ousdtA.balanceOf(recipient);
    console.log('Balance after transfer:', afterBal.toString());
    expect(afterBal.toString()).to.equal(beforeBal.add(transferAmount).toString());
  });

  it('should successfully call OVault.deposit() to initiate a cross-chain deposit', async function () {
    const depositAmount = parseEther('10'); // 10 OUSDT

    const sender = user;
    const senderAddr = sender.address;

    await ousdtA.connect(sender).mint(senderAddr, parseEther('1000000000'));

    // Initial checks
    const beforeBalUser = await ousdtA.balanceOf(senderAddr);
    const beforeBalOoperator = await ousdtB.balanceOf(oOperatorV2.address);
    console.log('Initial user OUSDT balance on Chain A:', formatEther(beforeBalUser));
    console.log('Initial OOperator OUSDT balance on Chain B:', formatEther(beforeBalOoperator));

    await ousdtA.connect(sender).approve(oVaultV2.address, depositAmount);

    const options = Options.newOptions()
      .addExecutorLzReceiveOption(200000, parseEther('0.01').toBigInt())
      // .addExecutorComposeOption(0, 500000, parseEther('0.1').toBigInt())    // mockendpoint does not support compose
      .toHex();

    const fee = await oVaultV2.quoteDeposit(depositAmount, options);
    console.log('Required fee for deposit:', formatEther(fee.toString()));

    const depositTx = await oVaultV2.connect(sender).deposit(depositAmount, options, { value: fee });
    const receipt = await depositTx.wait();

    // Check for Deposited event
    const depositedEvent = receipt.events?.find(e => e.event === 'Deposited');
    expect(depositedEvent).to.not.be.undefined;

    const afterBalUser = await ousdtA.balanceOf(senderAddr);
    const afterBalOoperator = await ousdtB.balanceOf(oOperatorV2.address);
    console.log('after deposit, user balance:', formatEther(afterBalUser));
    console.log('after deposit, OOperator balance:', formatEther(afterBalOoperator));

    expect(afterBalUser.toString()).to.equal(beforeBalUser.sub(depositAmount).toString());
    expect(afterBalOoperator.toString()).to.equal(beforeBalOoperator.add(depositAmount).toString());
  });

  it('should successfully call OVault.withdraw() to initiate a cross-chain withdrawal', async function () {
    // Set up the conditions for calling lzReceive
    const withdrawAmount = parseEther('5'); // 5 OUSDT
    await ousdtB.connect(ownerB).mint(superstate.address, withdrawAmount.mul(10));
    await ownerB.sendTransaction({
      to: oOperatorV2.address,
      value: parseEther('10'),
    });
    // await ownerB.sendTransaction({
    //   to: mockEndpointV2B.address,
    //   value: parseEther('10'),
    // });

    const receiver = user;
    const receiverAddr = receiver.address;

    // Verify initial balances
    const beforeBalReceiver = await ousdtA.balanceOf(receiverAddr);
    const beforeBalSuperstate = await superstate.getBalance();
    const beforeBalOoperator = await ousdtB.balanceOf(oOperatorV2.address);

    console.log('Initial user OUSDT balance on Chain A:', formatEther(beforeBalReceiver));
    console.log('Initial Superstate OUSDT balance on Chain B:', formatEther(beforeBalSuperstate));
    console.log('Initial OOperator OUSDT balance on Chain B:', formatEther(beforeBalOoperator));

    const withdrawOptions = Options.newOptions().addExecutorLzReceiveOption(500000, parseEther('0.1').toBigInt()).toHex();

    const fee = await oVaultV2.quoteWithdraw(
      receiverAddr,
      withdrawAmount,
      withdrawOptions
    );
    console.log('Required fee for withdrawal:', formatEther(fee.nativeFee.toString()));

    const withdrawTx = await oVaultV2.connect(receiver).withdraw(
      receiverAddr,
      withdrawAmount,
      withdrawOptions,
      { value: fee.nativeFee },
    );

    const receipt = await withdrawTx.wait();
    const withdrawalEvent = receipt.events?.find(e => e.event === 'Withdrawn');
    expect(withdrawalEvent).to.not.be.undefined;

    const afterBalReceiver = await ousdtA.balanceOf(receiverAddr);
    const afterBalSuperstate = await superstate.getBalance();
    const afterBalOoperator = await ousdtB.balanceOf(oOperatorV2.address);

    console.log('Final user OUSDT balance on Chain A after simulation:', formatEther(afterBalReceiver));
    console.log('Final Superstate OUSDT balance on Chain B after simulation:', formatEther(afterBalSuperstate));
    console.log('Final OOperator OUSDT balance on Chain B after simulation:', formatEther(afterBalOoperator));

    expect(afterBalOoperator.toString()).to.equal(beforeBalOoperator.toString(), 'operator balance should not change');
    expect(afterBalSuperstate.toString()).to.equal(beforeBalSuperstate.sub(withdrawAmount).toString(), 'superstate balance should decrease');
    expect(afterBalReceiver.toString()).to.equal(beforeBalReceiver.add(withdrawAmount).toString(), 'receiver balance should increase');
  });
});

