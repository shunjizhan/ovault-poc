import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const optimismContract: OmniPointHardhat = {
    eid: EndpointId.OPTSEP_V2_TESTNET,
    contractName: 'MyOApp',
}

// const avalancheContract: OmniPointHardhat = {
//     eid: EndpointId.AVALANCHE_V2_TESTNET,
//     contractName: 'MyOApp',
// }

// const arbitrumContract: OmniPointHardhat = {
//     eid: EndpointId.ARBSEP_V2_TESTNET,
//     contractName: 'MyOApp',
// }

// const baseContract: OmniPointHardhat = {
//     eid: EndpointId.BASE_V2_TESTNET,
//     contractName: 'MyOApp',
// }

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'MyOApp',
}

// For this example's simplicity, we will use the same enforced options values for sending to all chains
// For production, you should ensure `gas` is set to the correct value through profiling the gas usage of calling OApp._lzReceive(...) on the destination chain
// To learn more, read https://docs.layerzero.network/v2/concepts/applications/oapp-standard#execution-options-and-enforced-settings
const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 80000,
        value: 0,
    },
]

// To connect all the above chains to each other, we need the following pathways:
// Optimism <-> Avalanche
// Optimism <-> Arbitrum
// Avalanche <-> Arbitrum

// With the config generator, pathways declared are automatically bidirectional
// i.e. if you declare A,B there's no need to declare B,A

const pathways: TwoWayConfig[] = [
    [
        sepoliaContract,
        optimismContract,
        [['LayerZero Labs'], []], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
        [1, 1], // [A to B confirmations, B to A confirmations]
        [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
    ],
]

export default async function () {
    // Generate the connections config based on the pathways
    const connections = await generateConnectionsConfig(pathways)
    const replacer = (key: string, value: any) => {
        if (typeof value === 'bigint') {
            return value.toString()
        }
        return value
    }
    console.log(JSON.stringify(connections, replacer, 2))
    return {
        contracts: [{ contract: sepoliaContract }, { contract: optimismContract }],
        connections,
    }
}
