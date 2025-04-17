import assert from 'assert';

import { type DeployFunction } from 'hardhat-deploy/types';

const contractName = 'OUsdt';

const deploy: DeployFunction = async hre => {
  const { getNamedAccounts, deployments } = hre;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  assert(deployer, 'Missing named deployer account');

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer}`);

  // This is an external deployment pulled in from @layerzerolabs/lz-evm-sdk-v2
  const endpointV2Deployment = await hre.deployments.get('EndpointV2');

  const { address } = await deploy(contractName, {
    from: deployer,
    args: [
      'Omnichain USDT', // name
      'OUSDT', // symbol
      endpointV2Deployment.address, // LayerZero's EndpointV2 address
      deployer, // delegate/owner
    ],
    log: true,
    skipIfAlreadyDeployed: false,
  });

  console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`);
};

deploy.tags = [contractName];

export default deploy;
