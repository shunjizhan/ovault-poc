import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools';

// Define OUsdt contracts on both chains
const optimismOUsdt: OmniPointHardhat = {
  eid: EndpointId.OPTSEP_V2_TESTNET,
  contractName: 'OUsdt',
};

const sepoliaOUsdt: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: 'OUsdt',
};

// For OFT token transfers, we need appropriate gas limits for token transfers across chains
const OFT_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1, // Standard message type
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 200000, // Higher gas limit for token transfers
    value: 0,
  },
];

// Configure bidirectional connections between OP-testnet and Sepolia
const pathways: TwoWayConfig[] = [
  [
    sepoliaOUsdt,
    optimismOUsdt,
    [['LayerZero Labs'], []], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
    [1, 1], // [Sepolia to OP confirmations, OP to Sepolia confirmations]
    [OFT_ENFORCED_OPTIONS, OFT_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
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
    contracts: [{ contract: sepoliaOUsdt }, { contract: optimismOUsdt }],
    connections,
  };
}
