import { type DeployFunction } from 'hardhat-deploy/types';
import assert from 'assert';

const contractName = 'Superstate';

const deploy: DeployFunction = async hre => {
  const { getNamedAccounts, deployments } = hre;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  assert(deployer, 'Missing named deployer account');
  assert(hre.network.name === 'sepolia', 'Superstate should only be deployed to Sepolia');

  console.log(`Network: ${hre.network.name}`);
  console.log(`Deployer: ${deployer}`);

  // Get the deployed OUsdt address on Sepolia
  const oUsdtDeployment = await deployments.get('OUsdt');
  console.log(`OUsdt address: ${oUsdtDeployment.address}`);

  const { address } = await deploy(contractName, {
    from: deployer,
    args: [
      oUsdtDeployment.address, // OUsdt token address
      deployer, // Owner address
    ],
    log: true,
    skipIfAlreadyDeployed: false,
  });

  console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`);
  console.log('args', [
    oUsdtDeployment.address, // OUsdt token address
    deployer, // Owner address
  ]);
};

deploy.tags = [contractName];
deploy.dependencies = ['OUsdt']; // Ensure OUsdt is deployed first

export default deploy;
