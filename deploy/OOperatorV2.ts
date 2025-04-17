import { type DeployFunction } from 'hardhat-deploy/types';
import assert from 'assert';

const contractName = 'OOperatorV2';

const deploy: DeployFunction = async hre => {
  const { getNamedAccounts, deployments } = hre;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  assert(deployer, 'Missing named deployer account');
  assert(hre.network.name === 'sepolia', 'OOperatorV2 should only be deployed to Sepolia');

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer}`);

  // Get the LayerZero endpoint
  const endpointV2Deployment = await hre.deployments.get('EndpointV2');

  // Get the OUsdt token address
  const oUsdtDeployment = await deployments.get('OUsdt');
  console.log(`OUsdt address: ${oUsdtDeployment.address}`);

  // Get the Superstate address
  const superstateDeployment = await deployments.get('Superstate');
  console.log(`Superstate address: ${superstateDeployment.address}`);

  const { address } = await deploy(contractName, {
    from: deployer,
    args: [
      endpointV2Deployment.address, // LayerZero's EndpointV2 address
      deployer, // delegate/owner
      oUsdtDeployment.address, // OUsdt address
      superstateDeployment.address, // Superstate address
    ],
    log: true,
    skipIfAlreadyDeployed: false,
  });

  console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`);
  console.log('args', [
    endpointV2Deployment.address,
    deployer,
    oUsdtDeployment.address,
    superstateDeployment.address,
  ]);
};

deploy.tags = [contractName];
deploy.dependencies = ['OUsdt', 'Superstate']; // Ensure dependencies are deployed first

export default deploy;