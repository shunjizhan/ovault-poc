// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config';

// import './src/types/hardhat.d'

import '@layerzerolabs/toolbox-hardhat';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import { EndpointId } from '@layerzerolabs/lz-definitions';
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types';


import './tasks/ovault';
import './tasks/send-msg';

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC;

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
  ? { mnemonic: MNEMONIC }
  : PRIVATE_KEY
    ? [PRIVATE_KEY]
    : undefined;

if (accounts == null) {
  console.warn(
    'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
  );
}

const config: HardhatUserConfig = {
  paths: {
    cache: 'cache/hardhat',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.22',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    'optimism-testnet': {
      eid: EndpointId.OPTSEP_V2_TESTNET,
      url: process.env.RPC_URL_OP_SEPOLIA || 'https://optimism-sepolia.gateway.tenderly.co',
      accounts,
    },
    'avalanche-testnet': {
      eid: EndpointId.AVALANCHE_V2_TESTNET,
      url: process.env.RPC_URL_FUJI || 'https://avalanche-fuji.drpc.org',
      accounts,
    },
    'arbitrum-testnet': {
      eid: EndpointId.ARBSEP_V2_TESTNET,
      url: process.env.RPC_URL_ARB_SEPOLIA || 'https://arbitrum-sepolia.gateway.tenderly.co',
      accounts,
    },
    'base-testnet': {
      eid: EndpointId.BASESEP_V2_TESTNET,
      url: process.env.RPC_URL_BASE_SEPOLIA || 'https://sepolia.base.org',
      accounts,
    },
    sepolia: {
      eid: EndpointId.SEPOLIA_V2_TESTNET,
      url: process.env.RPC_URL_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com',
      accounts,
    },
    hardhat: {
      // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
      allowUnlimitedContractSize: true,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // wallet address of index[0], of the mnemonic in .env
    },
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      'optimism-testnet': process.env.ETHERSCAN_API_KEY_OP!,
      sepolia: process.env.ETHERSCAN_API_KEY!,
    },
    customChains: [
      {
        network: 'optimism-testnet',
        chainId: 11155420,
        urls: {
          apiURL: 'https://api-sepolia-optimistic.etherscan.io/api',
          browserURL: 'https://sepolia-optimism.etherscan.io/',
        },
      },
    ],
  },
  typechain: {
    target: 'ethers-v5',
    // alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    // externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    // dontOverrideCompile: false // defaults to false
  },
};

export default config;
