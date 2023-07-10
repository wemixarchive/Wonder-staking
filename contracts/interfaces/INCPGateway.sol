// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.9;
import "./INCPStaking.sol";
import "./IWithdrawalNFT.sol";

interface INCPGateway {
    struct NCPInfo {
        // uint256 NCPTotalDeposit;
        // uint256 NCPTotalWithdrawal;
        // uint256 NCPTotalReward;
        uint256 pid;
        address ncpAddr;
        uint256 accRewardPerShare;
        uint256 accMPPerShare;
        uint256 lastRewardBlock;
        uint256 totalDeposit;
        uint256 totalMP;
        uint256 unbondTime;
        uint256 totalRequestedWithdrawal;
        uint256 reward;
        uint256 APR;
        uint256 ShareRatio;
        uint256 feeRatio;
        bool actevatedMP;
        bool lock;
        address breaker;
        address breakerSetter;
        address feeCollector;
        uint256 totalDepositors;
        uint256 feeRequestRatio;
        uint256 feeRequestBlockNumber;
    }

    struct UserInfo {
        uint256 pid;
        uint256 depositAmount;
        uint256 pendingReward;
        uint256 APR;
        uint256 APY;
        uint256 lastRewardClaimed;
    }

    struct UserWithdrawInfo {
        uint256 tokenid;
        uint256 pid;
        uint256 toPid;
        uint256 amount;
        uint256 requestTime;
        uint256 claimableTime;
        address drawer;
    }
}
