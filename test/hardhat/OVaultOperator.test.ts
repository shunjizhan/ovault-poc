import { Options } from '@layerzerolabs/lz-v2-utilities';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';

import {
  EndpointV2Mock,
  EndpointV2Mock__factory,
  OOperator,
  OOperator__factory,
  OVault,
  OVault__factory,
} from '../../typechain-types';

describe('OVault and OOperator Test', function () {
  // Constant representing a mock Endpoint ID for testing purposes
  const eidA = 1;
  const eidB = 2;
  // Declaration of variables to be used in the test suite
  let OVault: OVault__factory;
  let OOperator: OOperator__factory;
  let EndpointV2Mock: EndpointV2Mock__factory;
  let ownerA: SignerWithAddress;
  let ownerB: SignerWithAddress;
  let endpointOwner: SignerWithAddress;
  let user: SignerWithAddress;
  let oVault: OVault;
  let oOperator: OOperator;
  let mockEndpointV2A: EndpointV2Mock;
  let mockEndpointV2B: EndpointV2Mock;

  // Before hook for setup that runs once before all tests in the block
  before(async function () {
    // Contract factories for our tested contracts
    OVault = await ethers.getContractFactory('OVault') as unknown as OVault__factory;
    OOperator = await ethers.getContractFactory('OOperator') as unknown as OOperator__factory;
    EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock') as unknown as EndpointV2Mock__factory;

    const signers = await ethers.getSigners();
    [ownerA, ownerB, endpointOwner, user] = signers;
  });

  // beforeEach hook for setup that runs before each test in the block
  beforeEach(async function () {
    // Deploying a mock LZ EndpointV2 with the given Endpoint ID
    mockEndpointV2A = await EndpointV2Mock.deploy(eidA);
    mockEndpointV2B = await EndpointV2Mock.deploy(eidB);

    // Deploying OVault and OOperator contracts
    oVault = await OVault.deploy(mockEndpointV2A.address, ownerA.address, eidB);
    oOperator = await OOperator.deploy(mockEndpointV2B.address, ownerB.address);

    // Setting destination endpoints in the LZEndpoint mock
    await mockEndpointV2A.setDestLzEndpoint(oOperator.address, mockEndpointV2B.address);
    await mockEndpointV2B.setDestLzEndpoint(oVault.address, mockEndpointV2A.address);

    // Setting each contract as a peer of the other
    await oVault.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(oOperator.address, 32));
    await oOperator.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(oVault.address, 32));
  });

  it('should process a deposit request', async function () {
    // Initial checks
    const initialDeposits = await oOperator.pendingDeposits();
    console.log('Initial pendingDeposits:', initialDeposits.toString());

    // Create options for the message
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();

    // Get the quote for sending a message
    const [nativeFee] = await oVault.quote('DEPOSIT', 100, options);

    // Call deposit with the amount and pay the native fee
    await oVault.connect(user).deposit(100, options, { value: nativeFee.toString() });

    // Verify operator received the deposit message and updated state
    const finalDeposits = await oOperator.pendingDeposits();
    console.log('Final pendingDeposits:', finalDeposits.toString());

    expect(finalDeposits.toString()).to.equal('100');
  });

  it('should process a withdrawal request', async function () {
    // Initial checks
    const initialVaultWithdrawals = await oVault.pendingWithdrawals();
    const initialOperatorWithdrawals = await oOperator.pendingWithdrawals();
    console.log('Initial pendingWithdrawals (vault):', initialVaultWithdrawals.toString());
    console.log('Initial pendingWithdrawals (operator):', initialOperatorWithdrawals.toString());

    // Create options for the message
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();

    // Get the quote for sending a message
    const [nativeFee] = await oVault.quote('WITHDRAW', 50, options);

    // Call requestWithdraw with the amount and pay the native fee
    await oVault.connect(user).requestWithdraw(50, options, { value: nativeFee.toString() });

    // Verify both vault and operator updated their state
    const finalVaultWithdrawals = await oVault.pendingWithdrawals();
    const finalOperatorWithdrawals = await oOperator.pendingWithdrawals();
    console.log('Final pendingWithdrawals (vault):', finalVaultWithdrawals.toString());
    console.log('Final pendingWithdrawals (operator):', finalOperatorWithdrawals.toString());
    expect(finalVaultWithdrawals.toString()).to.equal('50');
    expect(finalOperatorWithdrawals.toString()).to.equal('50');
  });

  it('operator owner should be able to process deposits', async function () {
    // Setup: create a deposit first
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();
    const [nativeFee] = await oVault.quote('DEPOSIT', 100, options);
    await oVault.connect(user).deposit(100, options, { value: nativeFee.toString() });

    // Verify initial state
    const initialDepositState = await oOperator.pendingDeposits();
    console.log('Initial deposit state:', initialDepositState.toString());
    expect(initialDepositState.toString()).to.equal('100');

    // Process the deposits
    await oOperator.connect(ownerB).deposit();

    // Verify deposits were processed (pendingDeposits reset to 0)
    const finalDepositState = await oOperator.pendingDeposits();
    console.log('Final deposit state:', finalDepositState.toString());
    expect(finalDepositState.toString()).to.equal('0');
  });

  it('operator owner should be able to process withdrawals', async function () {
    // Setup: create a withdrawal request first
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();
    const [nativeFee] = await oVault.quote('WITHDRAW', 50, options);
    await oVault.connect(user).requestWithdraw(50, options, { value: nativeFee.toString() });

    // Verify initial state
    const initialWithdrawState = await oOperator.pendingWithdrawals();
    console.log('Initial withdraw state:', initialWithdrawState.toString());
    expect(initialWithdrawState.toString()).to.equal('50');

    // Process the withdrawals
    await oOperator.connect(ownerB).withdraw();

    // Verify withdrawals were processed (pendingWithdrawals reset to 0)
    const finalWithdrawState = await oOperator.pendingWithdrawals();
    console.log('Final withdraw state:', finalWithdrawState.toString());
    expect(finalWithdrawState.toString()).to.equal('0');
  });
});
