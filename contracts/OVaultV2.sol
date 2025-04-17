// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { SendParam, MessagingReceipt as OFTMessagingReceipt, OFTReceipt, IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract OVaultV2 is OApp, OAppOptionsType3 {
    OFT public ousdt;
    uint32 private operatorEid;

    string private constant DEPOSIT_ACTION = "DEPOSIT";
    string private constant WITHDRAW_ACTION = "WITHDRAW";

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(
        address _endpoint,
        address _delegate,
        uint32 _operatorEid,
        address _ousdt
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        operatorEid = _operatorEid;
        ousdt = OFT(_ousdt);
    }

    /**
     * @dev Deposits OUSDT to the operator on Sepolia via OFT bridge with composed message
     * @param amount Amount to deposit
     * @param oftOptions OFT options for token transfer with compose
     */
    function deposit(uint256 amount, bytes calldata oftOptions) external payable {
        require(amount > 0, "Amount must be greater than 0");

        // First, transfer tokens from user to this contract
        require(IERC20(address(ousdt)).transferFrom(msg.sender, address(this), amount), "Token transfer failed");

        // Prepare composed message that will trigger deposit processing on the operator
        bytes memory composeMsg = abi.encode(DEPOSIT_ACTION, amount);

        // Create send parameters for OFT
        SendParam memory sendParam = SendParam({
            dstEid: operatorEid,
            to: _getPeerOrRevert(operatorEid), // Send tokens to peer operator
            amountLD: amount,
            minAmountLD: amount, // No slippage
            extraOptions: oftOptions,
            composeMsg: composeMsg, // Include our composed message
            oftCmd: "" // Not used in default OFT
        });

        // Get the fee for sending with composed message
        MessagingFee memory messagingFee = IOFT(address(ousdt)).quoteSend(sendParam, false);
        uint256 nativeFee = messagingFee.nativeFee;
        require(msg.value >= nativeFee, "Insufficient fee");

        // Send OFT token with composed message
        (OFTMessagingReceipt memory receipt, OFTReceipt memory oftReceipt) = IOFT(address(ousdt)).send{value: msg.value}(
            sendParam,
            messagingFee, // Native fee only
            payable(msg.sender)  // Refund address
        );

        emit Deposited(msg.sender, amount);
    }

    /**
     * @dev Requests withdrawal of OUSDT from Superstate on Sepolia
     * @param amount Amount to withdraw
     * @param options LayerZero options
     */
    function withdraw(address to, uint256 amount, bytes calldata options) external payable {
        require(amount > 0, "Amount must be greater than 0");

        // Create payload with withdraw action, amount, and sender address
        bytes memory payload = abi.encode(WITHDRAW_ACTION, amount, to);

        // Send message to operator
        _lzSend(operatorEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));

        emit Withdrawn(to, amount);
    }

    /**
     * @dev Quote fee for cross-chain message
     * @param actionType Type of action (DEPOSIT or WITHDRAW)
     * @param amount Amount to transfer
     * @param options LayerZero options
     * @return fee Fee required for the cross-chain message
     */
    function quote(
        string memory actionType,
        uint256 amount,
        bytes memory options
    ) public view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(actionType, amount, address(0)); // Dummy address
        return _quote(operatorEid, payload, options, false);
    }

    /**
     * @dev Quote fee for deposit with OFT compose
     * @param amount Amount to transfer
     * @param oftOptions OFT options
     * @return fee Fee required for the deposit
     */
    function quoteDeposit(
        uint256 amount,
        bytes memory oftOptions
    ) public view returns (uint256 fee) {
        bytes memory composeMsg = abi.encode(DEPOSIT_ACTION, amount);

        // Create send parameters for OFT
        SendParam memory sendParam = SendParam({
            dstEid: operatorEid,
            to: bytes32(uint256(uint160(address(msg.sender)))),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: oftOptions,
            composeMsg: composeMsg,
            oftCmd: ""
        });

        // Get the fee estimate
        MessagingFee memory messagingFee = IOFT(address(ousdt)).quoteSend(sendParam, false);
        uint256 nativeFee = messagingFee.nativeFee;
        return nativeFee;
    }

    function quoteWithdraw(
        address to,
        uint256 amount,
        bytes memory options
    ) public view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(WITHDRAW_ACTION, amount, to);
        return _quote(operatorEid, payload, options, false);
    }

    /**
     * @dev Handle incoming messages from OOperator
     * This function is not actively used in the current flow since tokens
     * are sent directly to users via OFT
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata /*payload*/,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Empty implementation since tokens are sent directly to users via OFT
    }
}