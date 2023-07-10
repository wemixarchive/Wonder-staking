// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;


interface IGovStaking {
    function deposit() external payable;
    function withdraw(uint256) external;
    function lock(address, uint256) external;
    function lockMore(uint256) external;
    function unlock(address, uint256) external;
    function transferLocked(address, uint256) external;
    function balanceOf(address) external view returns (uint256);
    function lockedBalanceOf(address) external view returns (uint256);
    function availableBalanceOf(address) external view returns (uint256);
    function calcVotingWeight(address) external view returns (uint256);
    function calcVotingWeightWithScaleFactor(address, uint32) external view returns (uint256);
    function userBalanceOf(address ncp, address user) external view returns (uint256);
    function userTotalBalanceOf(address ncp) external view returns (uint256);
    function getRatioOfUserBalance(address ncp) external view returns (uint256);
    function delegateDepositAndLockMore(address ncp) external payable;
    function delegateUnlockAndWithdraw(address ncp, uint256 amount) external;
    function implementation() external view returns(address);
    function setNCPStaking(address _ncpStaking) external;
    
    function upgradeStaking(address newImp) external;
}