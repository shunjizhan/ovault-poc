// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Superstate
 * @dev Contract for managing OUSDT deposits and withdrawals on Sepolia
 */
contract Superstate is Ownable {
    IERC20 public ousdt;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _ousdt, address _owner) Ownable(_owner) {
        ousdt = IERC20(_ousdt);
    }

    /**
     * @dev Deposits OUSDT from caller to this contract
     * @param amount The amount of OUSDT to deposit
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(ousdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Deposited(msg.sender, amount);
    }

    /**
     * @dev Withdraws OUSDT from this contract to the caller
     * @param amount The amount of OUSDT to withdraw
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(ousdt.balanceOf(address(this)) >= amount, "Insufficient balance");
        require(ousdt.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Returns the balance of OUSDT in this contract
     */
    function getBalance() external view returns (uint256) {
        return ousdt.balanceOf(address(this));
    }
}