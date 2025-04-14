import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools';

const optimismContract: OmniPointHardhat = {
  eid: EndpointId.OPTSEP_V2_TESTNET,
  contractName: 'OVault',
};

const sepoliaContract: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: 'OOperator',
};

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 300000,
    value: 0,
  },
];

const pathways: TwoWayConfig[] = [
  [
    sepoliaContract,
    optimismContract,
    [['LayerZero Labs'], []],                     // [ requiredDVN[], [ optionalDVN[], threshold ] ]
    [1, 1],                                       // [A to B confirmations, B to A confirmations]
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
    contracts: [{ contract: sepoliaContract }, { contract: optimismContract }],
    connections,
  };
}
