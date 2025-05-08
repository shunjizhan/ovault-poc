# OVault Poc

Deposit/withdraw from superstate on sepolia directly from op testnet, powered by LayerZero compose

Deposit Flow:
- msg1: send OFT from `OVaultV2` from op testnet to `OOperatorV2` on sepolia
- msg2: LayerZero will auto trigger the `compose` method on `OOperatorV2`,l which will deposit OFT to superstate

Withdraw FLow:
- msg1: send a withdraw msg from  `OVaultV2` from op testnet to `OOperatorV2` on sepolia, which triggers `_lzReceive` method
- msg2: `OOperatorV2` will withdraw OFT from superstate, then send a bridge OFT tx back to the destination address on op testnet

## Run
- `yarn ovaultv2`

