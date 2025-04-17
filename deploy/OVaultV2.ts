import { type DeployFunction } from 'hardhat-deploy/types';
import { EndpointId } from '@layerzerolabs/lz-definitions';
import assert from 'assert';

const contractName = 'OVaultV2';

const deploy: DeployFunction = async hre => {
  const { getNamedAccounts, deployments } = hre;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  assert(deployer, 'Missing named deployer account');
  assert(hre.network.name === 'optimism-testnet', 'OVaultV2 should only be deployed to OP-testnet');

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer}`);

  // Get the LayerZero endpoint
  const endpointV2Deployment = await hre.deployments.get('EndpointV2');

  // Get the OUsdt token address
  const oUsdtDeployment = await deployments.get('OUsdt');
  console.log(`OUsdt address: ${oUsdtDeployment.address}`);

  // Operator is on Sepolia
  const operatorEid = EndpointId.SEPOLIA_V2_TESTNET;

  const { address } = await deploy(contractName, {
    from: deployer,
    args: [
      endpointV2Deployment.address, // LayerZero's EndpointV2 address
      deployer, // delegate/owner
      operatorEid, // Operator EID (Sepolia)
      oUsdtDeployment.address, // OUsdt address
    ],
    log: true,
    skipIfAlreadyDeployed: false,
  });

  console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`);
  console.log('args', [
    endpointV2Deployment.address,
    deployer,
    operatorEid,
    oUsdtDeployment.address,
  ]);
};

deploy.tags = [contractName];
deploy.dependencies = ['OUsdt']; // Ensure OUsdt is deployed first

export default deploy;
