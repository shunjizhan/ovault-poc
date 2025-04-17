import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools';

// Define OVaultV2 on OP-testnet
const optimismVault: OmniPointHardhat = {
  eid: EndpointId.OPTSEP_V2_TESTNET,
  contractName: 'OVaultV2',
};

// Define OOperatorV2 on Sepolia
const sepoliaOperator: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: 'OOperatorV2',
};

// For OVaultV2 and OOperatorV2, we need higher gas limits due to token transfers and state changes
const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 200000, // Higher gas limit for token transfers and state changes
    value: 0,
  },
];

// Configure the bidirectional connection between OP-testnet and Sepolia
const pathways: TwoWayConfig[] = [
  [
    sepoliaOperator,
    optimismVault,
    [['LayerZero Labs'], []], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
    [1, 1], // [Sepolia to OP confirmations, OP to Sepolia confirmations]
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
  ],
];

export default async function () {
  // Generate the connections config based on the pathways
  const connections = await generateConnectionsConfig(pathways);
  const replacer = (key: string, value: any) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };
  console.log(JSON.stringify(connections, replacer, 2));
  return {
    contracts: [{ contract: sepoliaOperator }, { contract: optimismVault }],
    connections,
  };
}
