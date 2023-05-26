// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

// import "../interfaces/INCPStaking.sol";
import "../interfaces/INCPGateway.sol";
import "../interfaces/IGov.sol";
import "../interfaces/IGovStaking.sol";
import "../interfaces/IEnvStorage.sol";
import "../interfaces/IWeswapGateway.sol";
import "../interfaces/IWithdrawalNFT.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "hardhat/console.sol";

contract NCPStakingGateway is OwnableUpgradeable, INCPGateway {
    address public ncpStaking;
    address public governance;
    address public govStaking;
    address public envStorage;
    address public weswapGateway;
    address public withdrawNFT;
    uint256 constant oneEther = 1e18;
    IWithdrawalNFT public withdrawalNFT;
    INCPStaking public NCPStaking;

    function initialize(
        address _ncpStaking,
        address _governance,
        address _govStaking,
        address _withdrawNFT,
        address _envStorage,
        address _weswapGateway
    ) external initializer {
        __Ownable_init();
        ncpStaking = _ncpStaking;
        governance = _governance;
        govStaking = _govStaking;
        withdrawNFT = _withdrawNFT;
        envStorage = _envStorage;
        weswapGateway = _weswapGateway;
    }

    /* All Info */
    function getNCPInfo() public view returns (NCPInfo[] memory) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256 poolLength = INCPStaking(ncpStaking).poolLength();
        NCPInfo[] memory ncpInfo = new NCPInfo[](poolLength);
        uint256 index = 0;
        uint256 totalDepositAmount = getTotalDepositAmount();
        uint256 totalRewardAPR = getTotalRewardAPR();
        uint256 platformFeeRatio = INCPStaking(ncpStaking)
            .getPlatformFeeRatio();

        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            INCPStaking.PoolInfo memory pool = INCPStaking(ncpStaking)
                .getPoolInfo(i);
            INCPStaking.FeeRatioRequestInfo memory feeRequest = INCPStaking(ncpStaking).getFeeRequestInfo(i);
            if (pool.ncp == address(0)) continue;

            uint256 ratio = IGovStaking(govStaking)
                .calcVotingWeightWithScaleFactor(pool.ncp, 10000);
            uint256 poolTotalRewardAPR = (((totalRewardAPR * ratio) /
                10000) * 1 ether) / pool.totalDeposit;
            uint256 apr =
                (((poolTotalRewardAPR * (10000 - platformFeeRatio)) / 10000) *
                    (10000 - pool.feeRatio)) /
                10000;

            address rewarder = INCPStaking(ncpStaking).getRewarder(i);
            ncpInfo[index++] = NCPInfo({
                pid: i,
                ncpAddr: pool.ncp,
                accRewardPerShare: pool.accRewardPerShare,
                accMPPerShare: pool.accMPPerShare,
                lastRewardBlock: pool.lastRewardBlock,
                totalDeposit: pool.totalDeposit,
                totalMP: pool.totalMP,
                unbondTime: pool.unbondTime,
                totalRequestedWithdrawal: pool.totalRequestedWithdrawal,
                reward: rewarder.balance,
                APR: apr,
                ShareRatio: totalDepositAmount / pool.totalDeposit,
                feeRatio: pool.feeRatio,
                actevatedMP: pool.activatedMP,
                lock: pool.lock,
                breaker: pool.breaker,
                breakerSetter: pool.breakerSetter,
                feeCollector: pool.feeCollector,
                totalDepositors : pool.totalDepositors,
                feeRequestRatio : feeRequest.ratio,
                feeRequestBlockNumber : feeRequest.requestBlockNumber
            });
        }

        return ncpInfo;
    }

    function getUserInfo(address user) public view returns (UserInfo[] memory) {
        uint256 SECONDS_PER_YEAR = 31536000;
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256 poolLength = INCPStaking(ncpStaking).poolLength();
        UserInfo[] memory userInfos = new UserInfo[](poolLength);
        uint256 index = 0;
        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            INCPStaking.UserInfo memory userInfo = INCPStaking(ncpStaking)
                .getUserInfo(i, user);
            if (userInfo.amount == 0 ) continue; 
            uint256 blockElapsed = (block.number - userInfo.lastRewardClaimed);
            uint256 apy = blockElapsed == 0 ? 0 : (userInfo.pendingReward * SECONDS_PER_YEAR  * 10000) / userInfo.amount / blockElapsed;
            userInfos[index++] = UserInfo({
                pid : i,
                depositAmount : userInfo.amount,
                pendingReward : userInfo.pendingReward,
                APR : userInfo.pendingReward * 1 ether / userInfo.amount,
                APY : apy,
                lastRewardClaimed : userInfo.lastRewardClaimed
            });
        }
        UserInfo[] memory userInfoTrim = new UserInfo[](index);
        for (uint256 i = 0; i < index; i++) {
            userInfoTrim[i] = userInfos[i];
        }

        return userInfoTrim;
    }

    function getUserWithdrawRequestInfo(
        address user
    ) public view returns (UserWithdrawInfo[] memory) {
        uint256[] memory NFTlist;
        NFTlist = IWithdrawalNFT(withdrawNFT).getUserTokenList(user);
        UserWithdrawInfo[] memory nftInfo = new UserWithdrawInfo[](
            NFTlist.length
        );

        IWithdrawalNFT.WithdrawalRequestInfo memory withdrawInfo;

        for (uint256 i = 0; i < NFTlist.length; i++) {
            withdrawInfo = IWithdrawalNFT(withdrawNFT).getWithdrawalRequestInfo(
                    NFTlist[i]
                );
            nftInfo[i] = UserWithdrawInfo({
                tokenid: withdrawInfo.tokenid,
                pid: withdrawInfo.pid,
                toPid: withdrawInfo.toPid,
                amount: withdrawInfo.amount,
                claimableTime: withdrawInfo.claimableTime,
                requestTime: withdrawInfo.requestTime,
                drawer : withdrawInfo.drawer
            });
        }

        return nftInfo;
    }

    /* Pool info functions */

    function getDepositAmount(uint256 pid) public view returns (uint256) {
        return INCPStaking(ncpStaking).getPoolInfo(pid).totalDeposit;
    }

    function getDepositAmountValue(
        uint256 pid
    ) public view returns (uint256 despoitAmtValue) {
        uint256 depositAmt = getDepositAmount(pid);
        despoitAmtValue =
            (depositAmt * (IWeswapGateway(weswapGateway).getWemixPrice())) /
            oneEther;
    }

    function getTotalDepositAmount() public view returns (uint256) {
        uint256 totalDeposit = 0;
        for (uint256 i = 1; i < INCPStaking(ncpStaking).poolLength() + 1; i++) {
            totalDeposit += getDepositAmount(i);
        }
        return totalDeposit;
    }

    function getTotalDepositAmountValue()
        public
        view
        returns (uint256 totalDepositValue)
    {
        uint256 totalDepositAmt = getTotalDepositAmount();
        totalDepositValue =
            (totalDepositAmt *
                (IWeswapGateway(weswapGateway).getWemixPrice())) /
            oneEther;
    }

    function getTotalWithdrawalAmount()
        public
        view
        returns (uint256 totalWithdrawalAmount)
    {
        for (uint256 i = 1; i < INCPStaking(ncpStaking).poolLength() + 1; i++) {
            totalWithdrawalAmount += INCPStaking(ncpStaking)
                .getPoolInfo(i)
                .totalRequestedWithdrawal;
        }
    }

    function getShareRatio(
        uint256 pid
    ) public view returns (uint256 shareRatio) {
        uint256 totalStakedAmount = getTotalDepositAmount();
        uint256 depositAmount = getDepositAmount(pid);
        if (totalStakedAmount == 0) {
            return 0;
        }
        shareRatio = (depositAmount * oneEther) / totalStakedAmount;
        return shareRatio;
    }

    function getDistributionRatio(
        uint256 pid
    ) public view returns (uint256 distributionRatio) {
        uint256 feeRatio = INCPStaking(ncpStaking).getPoolInfo(pid).feeRatio;
        if (feeRatio > 10000) {
            return feeRatio;
        }
        distributionRatio = 10000 - feeRatio;
    }

    function computePoolAPY(uint256 pid) public view returns (uint256) {
        uint256 SECONDS_PER_YEAR = 31536000;
        uint256 BASE_ETHER = 10 ** 36;
        uint256 ONE_ETHER = 1 ether;

        uint256 n = SECONDS_PER_YEAR;

        if (n == 0) return ONE_ETHER;

        uint256 x = (computePoolAPR(pid) / SECONDS_PER_YEAR) * 10 ** 18;

        uint256 x2 = (x * x) / BASE_ETHER;
        uint256 x3 = (x2 * x) / BASE_ETHER;

        return
            (BASE_ETHER +
                n *
                x +
                (n * (n - 1) * x2) /
                2 +
                (n * (n - 1) * (n - 2) * x3) /
                6) / 10 ** 18;
    }

    function computePoolAPR(uint256 pid) public view returns (uint256 apr) {
            INCPStaking.PoolInfo memory pool = INCPStaking(ncpStaking)
                .getPoolInfo(pid);
        uint256 stakedLP = pool.totalDeposit;
        uint256 platformFeeRatio = INCPStaking(ncpStaking)
            .getPlatformFeeRatio();
        if (stakedLP == 0) {
            apr = 0;
        } else {
            uint256 poolTotalRewardAPR = (getTotalRewardAPR() * 1 ether) /
                stakedLP;
            apr =
                (((poolTotalRewardAPR * (10000 - platformFeeRatio)) / 10000) *
                    (10000 - pool.feeRatio)) /
                10000;
        }
    }

    function getTotalRewardAPR()
        public
        view
        returns (uint256 poolTotalRewardAPR)
    {
        (, uint256 getStakingBlockRewardDistribution, , ) = IEnvStorage(
            envStorage
        ).getBlockRewardDistributionMethod();
        uint256 totalReward = IEnvStorage(envStorage).getBlockRewardAmount();
        uint256 denominator = IEnvStorage(envStorage).DENOMINATOR();
        poolTotalRewardAPR = ((totalReward *
            getStakingBlockRewardDistribution) / denominator) * 31536000;
    }

    /*User Info functions */

    function getUserDepositOrNot(
        address user
    ) public view returns (bool[] memory) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        bool[] memory depositList = new bool[](govMemberLength + 1);
        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            if (INCPStaking(ncpStaking).getUserInfo(i, user).amount > 0) {
                depositList[i] = true;
            } else {
                depositList[i] = false;
            }
        }
        return depositList;
    }

    function getUserDepositAmount(
        address user
    ) public view returns (uint256[] memory amounts) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        bool[] memory depositList = new bool[](govMemberLength + 1);
        amounts = new uint256[](govMemberLength + 1);

        depositList = getUserDepositOrNot(user);

        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            if (depositList[i] == false) {
                amounts[i] = 0;
            } else {
                amounts[i] = INCPStaking(ncpStaking)
                    .getUserInfo(i, user)
                    .amount;
            }
        }
    }

    function getUserDepositAmountValue(
        address user
    ) public view returns (uint256[] memory values) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256[] memory amounts = new uint256[](govMemberLength + 1);
        values = new uint256[](govMemberLength + 1);

        amounts = getUserDepositAmount(user);

        uint256 price = IWeswapGateway(weswapGateway).getWemixPrice();

        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            values[i] = (amounts[i] * price) / oneEther;
        }
    }

    function getUserTotalDepositAmount(
        address user
    ) public view returns (uint256 totalAmount) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256[] memory amounts = new uint256[](govMemberLength + 1);

        amounts = getUserDepositAmount(user);
        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            totalAmount += amounts[i];
        }
    }

    function getUserTotalDepositValue(
        address user
    ) public view returns (uint256 totalValue) {
        uint256 totalAmount = getUserTotalDepositAmount(user);
        totalValue =
            (totalAmount * IWeswapGateway(weswapGateway).getWemixPrice()) /
            oneEther;
    }

    function getUserPendingReward(
        address user
    ) public view returns (uint256[] memory rewards) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        bool[] memory depositList = new bool[](govMemberLength + 1);
        rewards = new uint256[](govMemberLength + 1);

        depositList = getUserDepositOrNot(user);

        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            if (depositList[i] == false) {
                rewards[i] = 0;
            } else {
                rewards[i] = INCPStaking(ncpStaking).pendingReward(i, user);
            }
        }
    }

    function getUserPendingRewardValue(
        address user
    ) public view returns (uint256[] memory rewardValues) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256[] memory rewards = new uint256[](govMemberLength + 1);
        rewardValues = new uint256[](govMemberLength + 1);
        uint256 price = IWeswapGateway(weswapGateway).getWemixPrice();
        rewards = getUserPendingReward(user);
        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            rewardValues[i] = (rewards[i] * price) / oneEther;
        }
    }

    function getUserTotalPendingReward(
        address user
    ) public view returns (uint256 totalReward) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        uint256[] memory rewards = new uint256[](govMemberLength + 1);
        rewards = getUserPendingReward(user);
        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            totalReward += rewards[i];
        }
    }

    function getUserTotalPendingRewardValue(
        address user
    ) public view returns (uint256 totalRewardValue) {
        uint256 totalReward = getUserTotalPendingReward(user);
        uint256 price = IWeswapGateway(weswapGateway).getWemixPrice();
        totalRewardValue = (totalReward * price) / oneEther;
    }

    function getUserAPR(
        address user
    ) public view returns (uint256[] memory AprSet) {
        uint256 govMemberLength = IGov(governance).getMemberLength();
        AprSet = new uint256[](govMemberLength + 1);

        uint256[] memory rewards = new uint256[](govMemberLength + 1);
        uint256[] memory amounts = new uint256[](govMemberLength + 1);

        amounts = getUserDepositAmount(user);
        rewards = getUserPendingReward(user);

        for (uint256 i = 1; i < govMemberLength + 1; i++) {
            if (amounts[i] == 0) {
                AprSet[i] = 0;
            } else {
                AprSet[i] = (rewards[i] * oneEther) / amounts[i];
            }
        }
    }

    function getUserTotalAPR(
        address user
    ) public view returns (uint256 totalAPR) {
        uint256 totalAmount = getUserTotalDepositAmount(user);
        uint256 totalPendingReward = getUserTotalPendingReward(user);

        if (totalAmount == 0) {
            return 0;
        }
        totalAPR = (totalPendingReward * oneEther) / totalAmount;
    }

    function getUserWithdrawAmount(
        address user
    ) public view returns (uint256[] memory withdrawAmounts) {
        uint256[] memory NFTlist;
        NFTlist = IWithdrawalNFT(withdrawNFT).getUserTokenList(user);
        withdrawAmounts = new uint256[](NFTlist.length);

        for (uint256 i = 0; i < withdrawAmounts.length; i++) {
            withdrawAmounts[i] = IWithdrawalNFT(withdrawNFT)
                .getWithdrawalRequestInfo(NFTlist[i])
                .amount;
        }
    }

    function getUserTotalWithdrawAmount(
        address user
    ) public view returns (uint256 totalWithdrawAmount) {
        uint256[] memory withdrawAmounts = getUserWithdrawAmount(user);
        for (uint256 i = 0; i < withdrawAmounts.length; i++) {
            totalWithdrawAmount += withdrawAmounts[i];
        }
    }

    function getUserWithdrawValue(
        address user
    ) public view returns (uint256[] memory withdrawValues) {
        uint256[] memory withdrawAmounts = getUserWithdrawAmount(user);
        uint256 wemixPrice = IWeswapGateway(weswapGateway).getWemixPrice();
        withdrawValues = new uint256[](withdrawAmounts.length);
        for (uint256 i = 0; i < withdrawAmounts.length; i++) {
            withdrawValues[i] = (withdrawAmounts[i] * wemixPrice) / oneEther;
        }
    }

    function getUserTotalWithdrawValue(
        address user
    ) public view returns (uint256 totalWithdrawValue) {
        uint256[] memory withdrawValues = getUserWithdrawValue(user);
        for (uint256 i = 0; i < withdrawValues.length; i++) {
            totalWithdrawValue += withdrawValues[i];
        }
    }

    function getUserWithdrawTime(
        address user
    ) public view returns (uint256[] memory withdrawTime) {
        uint256[] memory NFTlist;
        NFTlist = IWithdrawalNFT(withdrawNFT).getUserTokenList(user);
        withdrawTime = new uint256[](NFTlist.length);

        for (uint256 i = 0; i < withdrawTime.length; i++) {
            withdrawTime[i] = IWithdrawalNFT(withdrawNFT)
                .getWithdrawalRequestInfo(NFTlist[i])
                .claimableTime;
        }
    }
}
