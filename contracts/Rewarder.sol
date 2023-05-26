// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "./interfaces/IRewarder.sol";
import "./interfaces/INCPStaking.sol";
import "./interfaces/IGovStaking.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "hardhat/console.sol";

/// @author @seunghwalee
contract Rewarder is IRewarder, OwnableUpgradeable {
    address public staking;
    address public govStaking;
    address public ncp;

    uint256 public accRewardPerShare;
    uint256 public lastRewardAmount;

    mapping(address => uint256) public isRewarder;
    uint256 public rewarderCount;
    /**
     * @notice Maximum fee ratio.
     */
    uint256 public constant FEE_PRECISION = 10000;

    modifier onlyRewarder() {
        require(isRewarder[msg.sender] != 0 || msg.sender == owner(), "Only Rewarder can call this function.");
        _;
    }

    modifier onlyStaking() {
        require(msg.sender == staking, "Only Staking can call this function.");
        _;
    }

    function initialize(address _govStaking, address _staking, address _ncp) public initializer {
        __Ownable_init();
        govStaking = _govStaking;
        staking = _staking;
        ncp = _ncp;
        rewarderCount++;
        isRewarder[ncp] = rewarderCount;
    }

    receive() external payable {}

    function onReward(
        address payable to,
        uint256 amount,
        address payable feeCollector,
        uint256 feeRatio,
        address payable platform,
        uint256 platformFeeRatio
    ) external override onlyStaking returns(uint256 rewardValue) {
        require(address(this).balance >= amount, "Not enough reward");
        uint256 platformFee = amount * platformFeeRatio / FEE_PRECISION;
        uint256 rewardFee = (amount - platformFee) * feeRatio / FEE_PRECISION;
        rewardValue = amount - platformFee - rewardFee;
        to.transfer(rewardValue);
        feeCollector.transfer(rewardFee);
        platform.transfer(platformFee);
        update();
        emit LogOnReward(to, amount, feeCollector, rewardFee, platform, platformFee);
    }

    function update() public onlyStaking returns (uint256) {
        // console.log("balance of this contract: %s", address(this).balance);
        // console.log("ratio of user balance: %s", IGovStaking(govStaking).getRatioOfUserBalance(ncp));
        lastRewardAmount = address(this).balance; //* IGovStaking(govStaking).getRatioOfUserBalance(ncp) / 1e24;
        return lastRewardAmount;
    }

    function getLastReward() external view returns (uint256) {
        return lastRewardAmount;
    }

    function emergencyExit(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    function setStaking(address _staking) external onlyOwner {
        staking = _staking;
    }

    function setGovStaking(address _govStaking) external onlyOwner {
        govStaking = _govStaking;
    }

    function setNCP(address _ncp) external onlyOwner {
        ncp = _ncp;
    }

    function addRewarder(address _rewarder) external onlyOwner {
        rewarderCount++;
        isRewarder[_rewarder] = rewarderCount;
    }

    function removeRewarder(address _rewarder) external onlyOwner {
        isRewarder[_rewarder] = 0;
        rewarderCount--;
    }

    function checkRewarder(address _rewarder) external view returns (uint256) {
        return isRewarder[_rewarder];
    }

    function checkOwner(address _owner) external view returns (bool) {
        return owner() == _owner;
    }
}
