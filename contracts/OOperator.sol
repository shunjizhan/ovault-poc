// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract OOperator is OApp, OAppOptionsType3 {
    uint256 public pendingDeposits;
    uint256 public pendingWithdrawals;

    string private constant DEPOSIT_ACTION = "DEPOSIT";
    string private constant WITHDRAW_ACTION = "WITHDRAW";

    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    function deposit() external onlyOwner {
        pendingDeposits = 0;
    }

    function withdraw() external onlyOwner {
        pendingWithdrawals = 0;
    }

    /**
     * @dev Internal function override to handle incoming messages from OVault
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Decode the payload to extract action type and amount
        (string memory actionType, uint256 amount) = abi.decode(payload, (string, uint256));

        // Process based on action type
        if (keccak256(bytes(actionType)) == keccak256(bytes(DEPOSIT_ACTION))) {
            pendingDeposits += amount;
        } else if (keccak256(bytes(actionType)) == keccak256(bytes(WITHDRAW_ACTION))) {
            pendingWithdrawals += amount;
        }
    }
}