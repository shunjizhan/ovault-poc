// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract OVault is OApp, OAppOptionsType3 {
    uint256 public pendingWithdrawals;
    uint32 private operatorEid;
    string private action;

    string private constant DEPOSIT_ACTION = "DEPOSIT";
    string private constant WITHDRAW_ACTION = "WITHDRAW";

    constructor(
        address _endpoint,
        address _delegate,
        uint32 _operatorEid
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        operatorEid = _operatorEid;
    }

    function deposit(uint256 amount, bytes calldata options) external payable {
        bytes memory payload = abi.encode(DEPOSIT_ACTION, amount);
        _lzSend(operatorEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }

    function requestWithdraw(uint256 amount, bytes calldata options) external payable {
        pendingWithdrawals += amount;

        bytes memory payload = abi.encode(WITHDRAW_ACTION, amount);
        _lzSend(operatorEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }

    function quote(
        string memory actionType,
        uint256 amount,
        bytes memory options
    ) public view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(actionType, amount);
        return _quote(operatorEid, payload, options, false);
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // dummy method, not used
    }
}