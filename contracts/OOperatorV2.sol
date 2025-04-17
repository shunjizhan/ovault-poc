// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { IOAppComposer } from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppComposer.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";
import { Superstate } from "./Superstate.sol";
import { SendParam, IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { ILayerZeroComposer } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";

contract OOperatorV2 is OApp, OAppOptionsType3, ILayerZeroComposer {
    using OptionsBuilder for bytes;

    OFT public ousdt;
    Superstate public superstate;

    string private constant DEPOSIT_ACTION = "DEPOSIT";
    string private constant WITHDRAW_ACTION = "WITHDRAW";

    event Deposited(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(
        address _endpoint,
        address _delegate,
        address _ousdt,
        address _superstate
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {
        ousdt = OFT(_ousdt);
        superstate = Superstate(_superstate);
    }

    /**
     * @dev Handles the OFT compose message to process a deposit
     * @param _from The origin information for the composed message
     * @param _guid The unique identifier for the message
     * @param _message The message payload from OFT
     * @param _executor The address of the executor
     * @param _extraData Any extra data
     */
    function lzCompose(
        address _from,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable override {
        require(msg.sender == address(endpoint), "OOperatorV2: caller must be LayerZero endpoint");
        (string memory actionType, uint256 amount) = abi.decode(OFTComposeMsgCodec.composeMsg(_message), (string, uint256));

        // Only handle deposit actions for now
        if (keccak256(bytes(actionType)) == keccak256(bytes(DEPOSIT_ACTION))) {
            // Approve Superstate to spend the OUSDT
            require(ousdt.approve(address(superstate), amount), "Approval failed");

            // Deposit to Superstate
            superstate.deposit(amount);

            emit Deposited(amount);
        }
    }

    /**
     * @dev Processes withdrawals by withdrawing from Superstate and sending OUSDT back to user on OP-testnet
     * @param dst Destination address on OP-testnet
     * @param amount Amount to withdraw
     * @param dstEid Destination endpoint ID
     */
    function _withdrawAndSendOUSDT(address dst, uint256 amount, uint32 dstEid) internal {
        require(amount > 0, "Amount must be greater than 0");

        superstate.withdraw(amount);

        // Send OUSDT back to the user on OP-testnet via OFT
        _sendOUSDT(dst, amount, dstEid);

        emit Withdrawn(dst, amount);
    }

    /**
     * @dev Send OUSDT back to user on destination chain via OFT
     * @param dst Destination address
     * @param amount Amount to send
     * @param dstEid Destination endpoint ID
     */
    function _sendOUSDT(address dst, uint256 amount, uint32 dstEid) internal {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);

        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: bytes32(uint256(uint160(dst))),
            amountLD: amount,
            minAmountLD: 0,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        (MessagingFee memory messagingFee) = IOFT(address(ousdt)).quoteSend(sendParam, false);
        uint256 nativeFee = messagingFee.nativeFee;
        require(msg.value >= nativeFee, "Insufficient fee");

        // Use OFT's send method to bridge tokens back to destination
        IOFT(address(ousdt)).send{value: nativeFee}(
            sendParam,
            messagingFee,
            payable(dst) // refund to dst address
        );
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
        // Decode the payload to extract action type, amount, and destination
        (string memory actionType, uint256 amount, address dst) = abi.decode(payload, (string, uint256, address));

        // Process based on action type
        if (keccak256(bytes(actionType)) == keccak256(bytes(WITHDRAW_ACTION))) {
            _withdrawAndSendOUSDT(dst, amount, _origin.srcEid);
        }

    }

    /**
     * @dev Function to receive native tokens
     */
    receive() external payable {}
}