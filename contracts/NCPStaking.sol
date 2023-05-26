// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "./interfaces/INCPStaking.sol";
import "./interfaces/IGov.sol";
import "./interfaces/IGovStaking.sol";
import "./interfaces/IWithdrawalNFT.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "hardhat/console.sol";

/// @author @seunghwalee
contract NCPStaking is
    INCPStaking,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // using SafeERC20Upgradeable for IERC20; // TODO: safe
    using AddressUpgradeable for address payable;

    /* =========== STATE VARIABLES ===========*/

    uint256 private _version;

    /**
     * @notice Info of each WEMIX 3.0 Staking pool.
     */
    mapping(uint256 /* ncp idx */ => PoolInfo) private poolInfo;
    uint256 private poolInfoLength;

    /**
     * @notice Address of each `IRewarder` contract in WEMIX 3.0 Staking.
     */
    mapping(uint256 /* ncp idx */ => IRewarder) private rewarders;
    uint256 private rewarderLength;

    /**
     * @notice Info of each user that stakes LP tokens.
     */
    mapping(uint256 => mapping(address => UserInfo)) private userInfo;

    uint256 private constant ACC_REWARD_PRECISION = 1e18;

    /* =========== MP STATE VARIABLES ===========*/

    /**
     * @notice Info of each user that stakes LP tokens.
     */
    mapping(uint256 => mapping(address => UserMPInfo)) private userMPInfo;

    uint256 public multiplierPointBasis;
    uint256 public constant BASIS_POINTS_DIVISOR = 1000;
    uint256 public constant MP_DUARTION = 365 days;

    /* =========== COMPOUND STATE VARIABLES ===========*/

    /**
     * @notice Address of WEMIX governance contract
     */
    address public governance;

    /**
     * @notice Address of WEMIX governance staking contract. This contract is used to
     *        stake WEMIX tokens then blockchain core mint reward to rewarder address.
     */
    address public governanceStaking;
    /**
     * @notice Withdrawal request info NFT contract.
     *        If user request withdrawal, then this contract will mint NFT to user.
     */
    IWithdrawalNFT public withdrawalNFT;

    /**
     * @notice Maximum fee ratio.
     */
    uint256 public constant FEE_PRECISION = 10000;

    /**
     * @notice Index of NCP pool.
     */
    mapping(address => uint256) public ncpToIdx;

    /**
     * @notice Fee ratio change request info.
     */
    mapping(uint256 /* pid */ => FeeRatioRequestInfo /* info */)
        public feeRatioRequests;

    /**
     * @notice Fee ratio change duration.
     *        If reward contract owner request fee ratio change, then this contract will wait feeRationRequestDelay block number.
     */
    uint256 public feeRationRequestDelay;

    uint256 public platformFeeRatio;
    address public platformFeeCollector;

    function initialize(
        address _governance,
        address _governanceStaking,
        uint256 _feeRationRequestDelay,
        address _platformFeeCollector
    ) external initializer {
        multiplierPointBasis = 1000;

        _version = 1;
        governance = _governance;
        governanceStaking = _governanceStaking;
        feeRationRequestDelay = _feeRationRequestDelay;
        platformFeeCollector = _platformFeeCollector;

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    receive() external payable {}

    modifier onlyNCP() {
        require(
            msg.sender == poolInfo[ncpToIdx[msg.sender]].ncp,
            "Only NCP can call this function."
        );
        _;
    }

    modifier onlyGovStaking() {
        require(
            msg.sender == governanceStaking,
            "Only governance staking contract can call this function."
        );
        _;
    }

    modifier onlyRewarderOwner(uint256 pid) {
        require(
            IRewarder(getRewarder(pid)).checkOwner(msg.sender),
            "Only rewarder owner can call this function."
        );
        _;
    }

    /**
     * @notice The version number of this contract.
     * @return The version number.
     */
    function version() external view override returns (uint256) {
        return _version;
    }

    /**
     * @notice Set withdrawalNFT contract address.
     * @param _withdrawalNFT Address of withdrawalNFT contract.
     */
    function setWithdrawalNFT(address _withdrawalNFT) external onlyOwner {
        withdrawalNFT = IWithdrawalNFT(_withdrawalNFT);
    }

    function setMultiplierPointBasis(
        uint256 newMultiplierPointBasis
    ) external onlyOwner {
        uint256 prevMultiplierPointBasis = multiplierPointBasis;
        multiplierPointBasis = newMultiplierPointBasis;
        emit SetMultiplierPointBasis(
            prevMultiplierPointBasis,
            newMultiplierPointBasis
        );
    }

    /**
     * @notice Set duration of fee ratio change.
     * @param _feeRationRequestDelay Block number of fee ratio change duration.
     */
    function setRewardFeeRationRequestDelay(
        uint256 _feeRationRequestDelay
    ) external onlyOwner {
        feeRationRequestDelay = _feeRationRequestDelay;
    }

    /**
     * @notice Set platform fee ratio.
     * @param _platformFeeRatio new platform fee ratio.
     */
    function setPlatformFeeRatio(uint256 _platformFeeRatio) external onlyOwner {
        require(
            _platformFeeRatio < FEE_PRECISION,
            "Invalid platform fee ratio."
        );
        emit SetPlatformFeeRatio(platformFeeRatio, _platformFeeRatio);
        platformFeeRatio = _platformFeeRatio;
    }

    function getPlatformFeeRatio() external view returns (uint256) {
        return platformFeeRatio;
    }

    /**
     * @notice View function to see staking pool info.
     * @param pid The index of the pool. See _poolInfo.
     * @return info staking pool info
     */
    function getFeeRequestInfo(
        uint256 pid
    ) external view returns (FeeRatioRequestInfo memory info) {
        info = feeRatioRequests[pid];
    }

    /* =========== ADD FUNCTION =========== */

    /**
     * @notice Add a new LP to the pool. Can only be called by the owner.
     * DO NOT add the same LP token more than once. Rewards will be messed up if you do.
     * @param _ncp Address of ncp.
     * @param _feeCollector Address of the fee collector.
     * @param _rewarder Address of the rewarders delegate.
     * @param _activatedMP True if mp is used.
     * @param _lock True in case of emergency.
     * @param _breaker The address of breaker.
     * @param _breakerSetter The address of breakerSetter.
     * @param _feeRatio The fee ratio.
     * @param _initValue The ncp initial deposit amount.
     */
    function add(
        address _ncp,
        address _feeCollector,
        IRewarder _rewarder,
        bool _activatedMP,
        bool _lock,
        address _breaker,
        address _breakerSetter,
        uint256 _feeRatio,
        uint256 _initValue
    )
        external
        onlyOwner
        nonZeroAddress(_breaker)
        nonZeroAddress(_breakerSetter)
    {
        require(
            address(_ncp) != address(0) && address(_rewarder) != address(0),
            "Staking::add: INVALID_ADDRESS."
        );

        uint256 ncpIdx = IGov(governance).getNodeIdxFromMember(_ncp);
        require(ncpIdx != 0, "Staking::add: INVALID_NCP.");

        rewarders[ncpIdx] = _rewarder;
        rewarderLength++;
        (bytes memory _name, , , ) = IGov(governance).getNode(ncpIdx);
        // console.log(_activatedMP);
        poolInfo[ncpIdx] = PoolInfo({
            ncp: _ncp,
            name: _name,
            feeCollector: _feeCollector,
            lastRewardBlock: block.number,
            accRewardPerShare: 0,
            accMPPerShare: 0,
            totalDeposit: 0,
            totalMP: 0,
            unbondTime: 7 days,
            totalRequestedWithdrawal: 0,
            activatedMP: _activatedMP,
            lock: _lock,
            breaker: _breaker,
            breakerSetter: _breakerSetter,
            feeRatio: _feeRatio,
            totalDepositors: 0
        });
        poolInfoLength++;
        ncpToIdx[_ncp] = ncpIdx;
        _deposit(ncpIdx, _initValue, payable(_ncp), false);
        emit LogPoolAddition(
            ncpIdx,
            _rewarder,
            _lock,
            _breaker,
            _breakerSetter,
            _feeRatio
        );
    }

    /* =========== SET FUNCTIONS =========== */

    /**
     * @notice Update the given pool's reward point and `IRewarder` contract. Can only be called by the owner.
     * @param pid The index of the pool. See `poolInfo`.
     * @param _feeCollector Address of the fee collector.
     * @param _rewarder Address of the rewarder delegate.
     * @param _feeRatio The reward fee ratio.
     */
    function set(
        uint256 pid,
        address _feeCollector,
        IRewarder _rewarder,
        uint256 _feeRatio
    ) external onlyNCP checkPoolExists(pid) whenNotLock(pid) {
        require(
            address(_rewarder) != address(0),
            "Staking::add: INVALID_ADDRESS."
        );
        updatePool(pid);
        if (rewarders[pid] != _rewarder) {
            rewarders[pid] = _rewarder;
        }
        if (poolInfo[pid].feeCollector != _feeCollector) {
            poolInfo[pid].feeCollector = _feeCollector;
        }

        poolInfo[pid].feeRatio = _feeRatio;
        emit LogSetPool(pid, _rewarder, _feeCollector, _feeRatio);
    }

    function setRewardFeeRatioRequest(
        uint256 pid,
        uint256 _feeRatio
    ) external onlyRewarderOwner(pid) checkPoolExists(pid) whenNotLock(pid) {
        if(poolInfo[pid].feeRatio != 0){
            require(
                _feeRatio < FEE_PRECISION &&
                    (poolInfo[pid].feeRatio * 150) / 100 >= _feeRatio,
                "Staking::setRewardFeeRatioRequest: INVALID_FEE_RATIO."
            );
        }else{
            require(
                _feeRatio < FEE_PRECISION
                "Staking::setRewardFeeRatioRequest: INVALID_FEE_RATIO."
            );
        }
        emit SetRewardFeeRatioRequest(
            pid,
            poolInfo[pid].feeRatio,
            _feeRatio,
            block.number + feeRationRequestDelay
        );
        feeRatioRequests[pid] = FeeRatioRequestInfo({
            ratio: _feeRatio,
            requestBlockNumber: block.number
        });
    }

    function setRewardFeeRatio(
        uint256 pid
    ) external onlyRewarderOwner(pid) checkPoolExists(pid) whenNotLock(pid) {
        require(
            feeRatioRequests[pid].requestBlockNumber + feeRationRequestDelay <=
                block.number,
            "STAKING: FeeRatio request is not ready."
        );
        emit SetRewardFeeRatio(
            pid,
            poolInfo[pid].feeRatio,
            feeRatioRequests[pid].ratio
        );
        poolInfo[pid].feeRatio = feeRatioRequests[pid].ratio;
    }

    function setUnbondTime(uint256 pid, uint256 time) external onlyOwner {
        PoolInfo storage pool = poolInfo[pid];
        pool.unbondTime = time;

        emit SetUnbondTime(time);
    }

    function setPoolBreaker(
        uint256 pid,
        address _breaker
    ) external nonZeroAddress(_breaker) checkPoolExists(pid) whenNotLock(pid) {
        PoolInfo storage pool = poolInfo[pid];

        require(
            msg.sender == pool.breakerSetter,
            "STAKING: Caller is not BreakerSetter."
        );

        pool.breaker = _breaker;

        emit SetPoolBreaker(pid, _breaker);
    }

    function setPoolBreakerSetter(
        uint256 pid,
        address _breakerSetter
    )
        external
        nonZeroAddress(_breakerSetter)
        checkPoolExists(pid)
        whenNotLock(pid)
    {
        PoolInfo storage pool = poolInfo[pid];

        require(
            msg.sender == pool.breakerSetter,
            "STAKING: Caller is not BreakerSetter."
        );

        pool.breakerSetter = _breakerSetter;

        emit SetPoolBreakerSetter(pid, _breakerSetter);
    }

    /* =========== BREAK FUNCTIONS =========== */

    function lockContract(
        uint256 pid
    ) external checkPoolExists(pid) whenNotLock(pid) {
        PoolInfo storage pool = poolInfo[pid];

        require(msg.sender == pool.breaker, "STAKING: Caller is not Breaker.");

        pool.lock = true;

        emit LockContract(pid);
    }

    function unlockContract(uint256 pid) external checkPoolExists(pid) {
        PoolInfo storage pool = poolInfo[pid];

        require(msg.sender == pool.breaker, "STAKING: Caller is not Breaker.");
        require(pool.lock, "STAKING: NOT EMERGENCY!");

        pool.lock = false;

        emit UnlockContract(pid);
    }

    /* =========== VIEW FUNCTIONS =========== */

    /**
     * @notice View function to see pending reward token on frontend.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param _user Address of user.
     * @return pending reward for a given user.
     */
    function pendingReward(
        uint256 pid,
        address _user
    ) public view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[pid];
        UserInfo memory user = userInfo[pid][_user];
        UserMPInfo memory mpInfo = userMPInfo[pid][_user];

        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lastReward = rewarders[pid].getLastReward();
        uint256 currentTotalReward = address(rewarders[pid]).balance;

        if (block.number > pool.lastRewardBlock && pool.totalDeposit != 0) {
            uint256 allocReward = currentTotalReward - lastReward;
            // console.log(
            //     "accRewardPerShare : %s allocReward : %s",
            //     accRewardPerShare,
            //     allocReward
            // );
            // console.log(
            //     "totalDeposit : %s totalMP : %s",
            //     pool.totalDeposit,
            //     pool.totalMP
            // );
            accRewardPerShare =
                accRewardPerShare +
                (allocReward * ACC_REWARD_PRECISION) /
                (pool.totalDeposit + pool.totalMP);
        }

        uint256 addedReward = ((user.amount + mpInfo.staked) *
            accRewardPerShare) /
            ACC_REWARD_PRECISION -
            user.rewardDebt;
        // console.log(
        //     "pendingReward : %s addedReward : %s",
        //     user.pendingReward,
        //     addedReward
        // );
        pending = user.pendingReward + addedReward;
    }

    /**
     * @notice View function to see pending reward token on frontend.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param _user Address of user.
     * @return totalPendingReward total reward for a given user.
     * @return lpPendingReward reward from lp for a given user.
     * @return mpPendingReward reward from mp for a given user.
     */
    function pendingRewardInfo(
        uint256 pid,
        address _user
    )
        external
        view
        returns (
            uint256 totalPendingReward,
            uint256 lpPendingReward,
            uint256 mpPendingReward
        )
    {
        UserInfo memory user = userInfo[pid][_user];
        UserMPInfo memory mpInfo = userMPInfo[pid][_user];

        totalPendingReward = pendingReward(pid, _user);
        lpPendingReward =
            user.pendingAmountReward +
            computePendingAmountReward(
                totalPendingReward - user.pendingReward,
                user.amount,
                mpInfo.staked
            );
        mpPendingReward = totalPendingReward - lpPendingReward;
    }

    /**
     * @notice View function to see pending reward token on frontend.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param account Address of user.
     * @return mpAmount The amount of mp to receive when updateMP function is executed.
     */
    function pendingMP(
        uint256 pid,
        address account
    ) external view returns (uint256 mpAmount) {
        UserInfo memory user = userInfo[pid][account];
        UserMPInfo memory mpInfo = userMPInfo[pid][account];

        uint256 lastMPUpdate = mpInfo.lastMPUpdatedTime;
        if (block.number == lastMPUpdate) return 0;

        mpAmount =
            ((block.number - lastMPUpdate) *
                user.amount *
                multiplierPointBasis) /
            BASIS_POINTS_DIVISOR /
            MP_DUARTION;
    }

    /**
     * @notice The number of WEMIX 3.0 Staking pools.
     * @return pools Pool lengths.
     */
    function poolLength() external view returns (uint256 pools) {
        pools = poolInfoLength;
    }

    /**
     * @notice View function to see user staking info.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param account Address of user.
     * @return info user staking info
     */
    function getUserInfo(
        uint256 pid,
        address account
    ) external view returns (UserInfo memory info) {
        info = userInfo[pid][account];
    }

    /**
     * @notice View function to see user multiplier info.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param account Address of user.
     * @return info user multiplier point info
     */
    function getUserMPInfo(
        uint256 pid,
        address account
    ) external view returns (UserMPInfo memory info) {
        info = userMPInfo[pid][account];
    }

    /**
     * @notice View function to see staking pool info.
     * @param pid The index of the pool. See `_poolInfo`.
     * @return info staking pool info
     */
    function getPoolInfo(
        uint256 pid
    ) external view returns (PoolInfo memory info) {
        info = poolInfo[pid];
    }

    /**
     * @notice View function to see staking token address.
     * @param pid The index of the pool. See `_poolInfo`.
     * @return addr staking pool rewarders address
     */
    function getRewarder(uint256 pid) public view returns (address addr) {
        addr = address(rewarders[pid]);
    }

    /* =========== FUNCTIONS =========== */

    /**
     * @notice Update reward variables for all pools. Be careful of gas spending!
     * @param pids Pool IDs of all to be updated. Make sure to update all active pools.
     */
    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(pids[i]);
        }
    }

    /**
     * @notice Update reward variables of the given pool.
     * @param pid The index of the pool. See `_poolInfo`.
     * @return pool Returns the pool that was updated.
     */
    function updatePool(
        uint256 pid
    ) public payable returns (PoolInfo memory pool) {
        pool = poolInfo[pid];

        require(pool.lastRewardBlock != 0, "STAKING: Pool does not exist");

        if (block.number > pool.lastRewardBlock) {
            // console.log("blocknum > lastRewardBlock");
            // console.log("activatedMP:",pool.activatedMP);
            uint256 lpSupply = pool.totalDeposit;
            uint256 lastReward = rewarders[pid].getLastReward();
            // console.log("lastReward:",lastReward);
            uint256 currentTotalReward = rewarders[pid].update();
            // console.log("currentTotalReward:",currentTotalReward);

            if (lpSupply > 0) {
                uint256 allocReward = currentTotalReward - lastReward;
                pool.accRewardPerShare =
                    pool.accRewardPerShare +
                    (allocReward * ACC_REWARD_PRECISION) /
                    (lpSupply + pool.totalMP);
                // console.log("pool.accRewardPerShare:",pool.accRewardPerShare);
                // console.log("activatedMP after lpSupply:",pool.activatedMP);
            }

            pool.lastRewardBlock = block.number;
            poolInfo[pid] = pool;

            emit LogUpdatePool(
                pid,
                pool.lastRewardBlock,
                lpSupply,
                pool.accRewardPerShare
            );
        }
    }

    /**
     * @notice Update reward variables of the given pool.
     * @param pid The index of the pool. See `_poolInfo`.
     */
    function updateMP(uint256 pid) external {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        UserMPInfo memory mpInfo = userMPInfo[pid][msg.sender];

        if (user.amount > 0) {
            uint256 accumulatedReward = ((user.amount + mpInfo.staked) *
                pool.accRewardPerShare) / ACC_REWARD_PRECISION;
            uint256 pending = accumulatedReward - user.rewardDebt;

            user.pendingReward += pending;
            user.pendingAmountReward += computePendingAmountReward(
                pending,
                user.amount,
                mpInfo.staked
            );
        }

        (pool, mpInfo) = _updateMP(pid, msg.sender);

        // Effects
        user.rewardDebt =
            ((user.amount + mpInfo.staked) * pool.accRewardPerShare) /
            ACC_REWARD_PRECISION;
        userMPInfo[pid][msg.sender] = mpInfo;
    }

    /**
     * @notice Update reward variables of the given pool.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param account user account.
     * @return pool Returns the pool that was updated.
     * @return mpInfo Returns the mpInfo that was updated.
     */
    function _updateMP(
        uint256 pid,
        address account
    ) internal returns (PoolInfo memory pool, UserMPInfo memory mpInfo) {
        // console.log("pid: ",pid);
        pool = poolInfo[pid];
        UserInfo memory user = userInfo[pid][account];
        mpInfo = userMPInfo[pid][account];
        // console.log("updateMP",mpInfo.lastMPUpdatedTime);
        // console.log(_poolInfo[pid].activatedMP);
        // console.log(pool.activatedMP);
        if (!pool.activatedMP) return (pool, mpInfo);

        // console.log("updateMP",block.number);
        if (mpInfo.lastMPUpdatedTime == 0) {
            // console.log("enter");
            userMPInfo[pid][account].lastMPUpdatedTime = block.number;
            return (pool, userMPInfo[pid][account]);
        }

        if (block.number > mpInfo.lastMPUpdatedTime) {
            uint256 increasedMP = ((block.number - mpInfo.lastMPUpdatedTime) *
                user.amount *
                multiplierPointBasis) /
                BASIS_POINTS_DIVISOR /
                MP_DUARTION;
            mpInfo.staked += increasedMP;
            pool.totalMP += increasedMP;
            mpInfo.lastMPUpdatedTime = block.number;

            poolInfo[pid] = pool;
            userMPInfo[pid][account] = mpInfo;
        }
        return (pool, mpInfo);
    }

    /**
     * @notice Deposit LP tokens to WEMIX 3.0 Staking for reward.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param amount LP token amount to deposit.
     * @param to The receiver of `amount` deposit benefit.
     * @param claimReward Whether claim rewards or not.
     * @param comp Whether compound or not.
     */
    function deposit(
        uint256 pid,
        uint256 amount,
        address payable to,
        bool claimReward,
        bool comp
    ) external payable nonReentrant {
        require(
            msg.value == amount && amount >= 1 ether,
            "STAKING: Wrong amount"
        );
        require(
            msg.sender != poolInfo[ncpToIdx[msg.sender]].ncp,
            "STAKING: NCP cannot deposit"
        );

        _deposit(pid, amount, to, claimReward);

        IGovStaking(governanceStaking).delegateDepositAndLockMore{
            value: amount
        }(poolInfo[pid].ncp);

        if (comp) {
            require(!claimReward, "STAKING: Cannot compound when claim reward");
            _compound(msg.sender, pid, to);
        }
    }

    ///TODO if ncp requests claimReward, then reward address will get reward.
    function ncpDeposit(
        uint256 amount,
        address payable to
    ) external payable nonReentrant onlyGovStaking {
        _deposit(ncpToIdx[to], amount, payable(to), false);
    }

    function ncpWithdraw(
        uint256 amount,
        address payable to
    )
        external
        payable
        nonReentrant
        onlyGovStaking
    {
        console.log("ok %s", msg.sender);
        uint256 pid = ncpToIdx[to];
        uint256 toPid = pid;
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];
        UserMPInfo memory mpInfo = userMPInfo[pid][to];

        // bool claimReward_ = claimReward;
        // if (user.amount == amount && !comp) {
        //     claimReward_ = true;
        // }

        if (user.amount > 0) {
            _harvest(pid, payable(msg.sender), to, false, true);
        }
        (pool, mpInfo) = _updateMP(pid, msg.sender);
        uint256 reductionMP = (mpInfo.staked * amount) / user.amount;
        mpInfo.staked -= reductionMP;
        pool.totalMP -= reductionMP;

        user.amount -= amount;

        if (user.amount == 0) {
            pool.totalDepositors--;
        }

        if (IGov(governance).isStaker(msg.sender)) {
            require(
                user.amount >= IGov(governance).getMinStaking(),
                "STAKING: Insufficient amount to withdraw"
            );
        }

        // Effects
        user.rewardDebt =
            ((user.amount + mpInfo.staked) * pool.accRewardPerShare) /
            ACC_REWARD_PRECISION;

        // IGovStaking(governanceStaking).delegateUnlockAndWithdraw(
        //     pool.ncp,
        //     amount
        // );
        withdrawalNFT.mint(
            to,
            pid,
            toPid,
            amount,
            pool.unbondTime
        );

        pool.totalDeposit -= amount;
        pool.totalRequestedWithdrawal += amount;
        poolInfo[pid] = pool;
        userMPInfo[pid][msg.sender] = mpInfo;

        // if (comp) {
        //     require(!claimReward, "STAKING: Cannot compound when claim reward");
        //     _compound(msg.sender, toPid, to);
        // }

        emit WithdrawRequest(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            amount,
            to,
            user.pendingReward
        );
    }

    /**
     * @notice Deposit LP tokens to WEMIX 3.0 Staking for reward.
     * @param pid The index of the pool. See `_poolInfo`.
     * @param amount LP token amount to deposit.
     * @param to The receiver of `amount` deposit benefit.
     * @param claimReward Whether claim rewards or not.
     */
    function _deposit(
        uint256 pid,
        uint256 amount,
        address payable to,
        bool claimReward
    ) internal {
        // console.log("after update Pool",pool.activatedMP);
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];
        UserMPInfo memory mpInfo = userMPInfo[pid][to];

        if (user.lastRewardClaimed == 0) {
            user.lastRewardClaimed = block.number;
        }

        if (pool.lock) {
            require(!claimReward, "STAKING: EMERGENCY!");
        }

        if (user.amount > 0) {
            _harvest(pid, to, to, claimReward, true);
            // console.log("after harvest",pool.activatedMP);
        }
        (pool, mpInfo) = _updateMP(pid, to);

        if (user.amount == 0) {
            pool.totalDepositors++;
        }
        user.amount += amount;

        // Effects
        user.rewardDebt =
            ((user.amount + mpInfo.staked) * pool.accRewardPerShare) /
            ACC_REWARD_PRECISION;

        pool.totalDeposit += amount;
        poolInfo[pid] = pool;
        userMPInfo[pid][to] = mpInfo;
        // console.log("deposit",_userMPInfo[pid][to].lastMPUpdatedTime);
        // console.log("deposit",mpInfo.lastMPUpdatedTime);
        emit Deposit(msg.sender, pid, amount, to, user.pendingReward);
        emit NCPDeposit(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            amount,
            to,
            user.pendingReward
        );
    }

    /**
     *  @notice Request withdraw from pid pool.
     *  @param pid The pool index for withdrawal. See `_poolInfo`.
     *  @param toPid The pool index for changing pool. See `_poolInfo`.
     *  @param amount LP token amount to withdraw.
     *  @param to Receiver of the LP tokens.
     *  @param claimReward Whether claim rewards or not.
     *  @param comp Whether compound or not
     */
    function withdrawRequest(
        uint256 pid,
        uint256 toPid,
        uint256 amount,
        address payable to,
        bool claimReward,
        bool comp
    ) external nonReentrant whenNotLock(pid) returns (uint256 tokenId) {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        UserMPInfo memory mpInfo = userMPInfo[pid][msg.sender];

        require(
            user.amount >= amount && amount >= 1 ether,
            "STAKING: Wrong amount"
        );
        // require(amount >= 1 ether, "STAKING: Wrong amount");

        bool claimReward_ = claimReward;
        if (user.amount == amount && !comp) {
            claimReward_ = true;
        }

        if (user.amount > 0) {
            _harvest(pid, payable(msg.sender), to, claimReward_, true);
        }
        (pool, mpInfo) = _updateMP(pid, msg.sender);
        uint256 reductionMP = (mpInfo.staked * amount) / user.amount;
        mpInfo.staked -= reductionMP;
        pool.totalMP -= reductionMP;

        user.amount -= amount;

        if (user.amount == 0) {
            pool.totalDepositors--;
        }

        if (IGov(governance).isStaker(msg.sender)) {
            require(
                user.amount >= IGov(governance).getMinStaking(),
                "STAKING: Insufficient amount to withdraw"
            );
        }

        // Effects
        user.rewardDebt =
            ((user.amount + mpInfo.staked) * pool.accRewardPerShare) /
            ACC_REWARD_PRECISION;

        IGovStaking(governanceStaking).delegateUnlockAndWithdraw(
            pool.ncp,
            amount
        );
        tokenId = withdrawalNFT.mint(
            msg.sender,
            pid,
            toPid,
            amount,
            pool.unbondTime
        );

        pool.totalDeposit -= amount;
        pool.totalRequestedWithdrawal += amount;
        poolInfo[pid] = pool;
        userMPInfo[pid][msg.sender] = mpInfo;

        if (comp) {
            require(!claimReward, "STAKING: Cannot compound when claim reward");
            _compound(msg.sender, toPid, to);
        }

        emit WithdrawRequest(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            amount,
            to,
            user.pendingReward
        );
    }

    /**
     *  @notice Withdraw for tokenId request.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param tokenId Requested withdrawal id.
     *  @param to Receiver of the LP tokens.
     */
    function withdraw(
        uint256 pid,
        uint256 tokenId,
        address payable to
    ) external nonReentrant whenNotLock(pid) {
        PoolInfo memory pool = updatePool(pid);
        if (tokenId == 0) {
            tokenId = withdrawalNFT.getFirstWithdrawableToken(pid, msg.sender);
        }
        IWithdrawalNFT.WithdrawalRequestInfo
            memory withdrawalRequestInfo = withdrawalNFT
                .getWithdrawalRequestInfo(tokenId);

        require(
            withdrawalRequestInfo.pid == pid &&
                withdrawalRequestInfo.toPid == pid,
            "STAKING: Invalid token id"
        );
        withdrawalNFT.burn(msg.sender, tokenId);
        to.sendValue(withdrawalRequestInfo.amount);
        pool.totalRequestedWithdrawal -= withdrawalRequestInfo.amount;
        poolInfo[pid] = pool;

        emit Withdraw(msg.sender, pid, withdrawalRequestInfo.amount, to);
        emit NCPWithdraw(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            withdrawalRequestInfo.amount,
            to
        );
    }

    /**
     *  @notice Redeposit by changing NCP.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param tokenId Requested withdrawal id.
     *  @param to Receiver of the LP tokens.
     */
    function changeNCP(
        uint256 pid,
        uint256 toPid,
        uint256 tokenId,
        address payable to,
        bool claimReward,
        bool cancle
    ) external nonReentrant whenNotLock(pid) {
        PoolInfo memory pool = updatePool(pid);
        if (tokenId == 0) {
            tokenId = withdrawalNFT.getFirstWithdrawableToken(pid, msg.sender);
        }
        IWithdrawalNFT.WithdrawalRequestInfo
            memory withdrawalRequestInfo = withdrawalNFT
                .getWithdrawalRequestInfo(tokenId);

        require(
            withdrawalRequestInfo.pid == pid &&
                withdrawalRequestInfo.toPid == toPid,
            "STAKING: Invalid token id"
        );
        withdrawalNFT.burn(msg.sender, tokenId);
        pool.totalRequestedWithdrawal -= withdrawalRequestInfo.amount;
        poolInfo[pid] = pool;
        emit Withdraw(msg.sender, pid, withdrawalRequestInfo.amount, to);
        emit NCPWithdraw(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            withdrawalRequestInfo.amount,
            to
        );

        if (cancle) {
            to.sendValue(withdrawalRequestInfo.amount);
            return;
        }

        _deposit(toPid, withdrawalRequestInfo.amount, to, claimReward);

        IGovStaking(governanceStaking).delegateDepositAndLockMore{
            value: withdrawalRequestInfo.amount
        }(poolInfo[toPid].ncp);
    }

    /**
     *  @notice Withdraw all requests.
     *  @param to Receiver of the LP tokens.
     */
    function withdrawAll(address payable to) external nonReentrant {
        uint256[] memory withdrawableTokenList = withdrawalNFT
            .getWithdrawableTokenList(msg.sender);
        for (uint256 i = 0; i < withdrawableTokenList.length; i++) {
            IWithdrawalNFT.WithdrawalRequestInfo
                memory withdrawalRequestInfo = withdrawalNFT
                    .getWithdrawalRequestInfo(withdrawableTokenList[i]);
            require(
                !poolInfo[withdrawalRequestInfo.pid].lock,
                "STAKING: EMERGENCY!"
            );
            withdrawalNFT.burn(msg.sender, withdrawableTokenList[i]);
            to.sendValue(withdrawalRequestInfo.amount);
            uint256 pid = withdrawalRequestInfo.pid;
            PoolInfo memory pool = updatePool(pid);
            pool.totalRequestedWithdrawal -= withdrawalRequestInfo.amount;
            poolInfo[pid] = pool;
            emit Withdraw(msg.sender, pid, withdrawalRequestInfo.amount, to);
            emit NCPWithdraw(
                msg.sender,
                pid,
                pool.name,
                pool.ncp,
                withdrawalRequestInfo.amount,
                to
            );
        }
    }

    /**
     *  @notice Withdraw for all pid pool request.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param to Receiver of the LP tokens.
     */
    function withdrawAllWithPid(
        uint256 pid,
        address payable to
    ) external nonReentrant whenNotLock(pid) {
        PoolInfo memory pool = updatePool(pid);
        uint256[] memory withdrawableTokenList = withdrawalNFT
            .getWithdrawableTokenListWithPid(pid, msg.sender);
        uint256 totalWithdrawalAmount;
        for (uint256 i = 0; i < withdrawableTokenList.length; i++) {
            IWithdrawalNFT.WithdrawalRequestInfo
                memory withdrawalRequestInfo = withdrawalNFT
                    .getWithdrawalRequestInfo(withdrawableTokenList[i]);
            withdrawalNFT.burn(msg.sender, withdrawableTokenList[i]);
            to.sendValue(withdrawalRequestInfo.amount);
            totalWithdrawalAmount += withdrawalRequestInfo.amount;
        }
        pool.totalRequestedWithdrawal -= totalWithdrawalAmount;
        poolInfo[pid] = pool;
        emit Withdraw(msg.sender, pid, totalWithdrawalAmount, to);
        emit NCPWithdraw(
            msg.sender,
            pid,
            pool.name,
            pool.ncp,
            totalWithdrawalAmount,
            to
        );
    }

    /**
     *  @notice Harvest proceeds for transaction sender to `to`.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param to Receiver of rewards.
     */
    function claim(
        uint256 pid,
        address to
    ) external nonReentrant whenNotLock(pid) {
        address sender = msg.sender;
        PoolInfo memory pool = updatePool(pid);
        if (IRewarder(getRewarder(pid)).checkRewarder(msg.sender) != 0) {
            sender = pool.ncp;
            to = msg.sender;
        }
        UserInfo storage user = userInfo[pid][sender];
        UserMPInfo memory mpInfo = userMPInfo[pid][sender];

        if (user.amount > 0) {
            _harvest(pid, payable(sender), payable(to), true, false);
        }

        // Effects
        user.rewardDebt =
            ((user.amount + mpInfo.staked) * pool.accRewardPerShare) /
            ACC_REWARD_PRECISION;
    }

    /**
     *  @notice Compound proceeds for transaction sender to `to`.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param to Receiver of rewards.
     */
    function compound(
        uint256 pid,
        address to
    ) public nonReentrant whenNotLock(pid) {
        address sender = msg.sender;
        if (IRewarder(getRewarder(pid)).checkRewarder(msg.sender) != 0) {
            sender = poolInfo[pid].ncp;
            to = poolInfo[pid].ncp;
        }

        _compound(sender, pid, to);
    }

    /**
     *  @notice Compound proceeds for transaction sender to `to`.
     *  @param pid The index of the pool. See `_poolInfo`.
     *  @param to Receiver of rewards.
     */
    function _compound(address sender, uint256 pid, address to) internal {
        // UserMPInfo memory mpInfo = _userMPInfo[pid][msg.sender];

        if (userInfo[pid][sender].amount > 0) {
            uint256 rewardValue = _harvest(
                pid,
                payable(sender),
                payable(address(this)),
                true,
                false
            );
            UserInfo storage user = userInfo[pid][sender];
            // Effects
            user.rewardDebt =
                ((user.amount + userMPInfo[pid][sender].staked) *
                    poolInfo[pid].accRewardPerShare) /
                ACC_REWARD_PRECISION;
            if (rewardValue > 0) {
                _deposit(pid, rewardValue, payable(to), false);
                if (to != poolInfo[pid].ncp) {
                    IGovStaking(governanceStaking).delegateDepositAndLockMore{
                        value: rewardValue
                    }(poolInfo[pid].ncp);
                } else {}
            }
        }
    }

    function _harvest(
        uint256 pid,
        address from_,
        address payable to,
        bool claimReward,
        bool computeReward
    ) internal returns (uint256 rewardValue) {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][from_];
        UserMPInfo memory mpInfo = userMPInfo[pid][from_];

        // console.log("user.amount: %s", user.amount);

        uint256 accumlatedReward = ((user.amount + mpInfo.staked) *
            pool.accRewardPerShare) / ACC_REWARD_PRECISION;
        uint256 pending = accumlatedReward - user.rewardDebt;

        // console.log("accumlatedReward: %s", accumlatedReward);
        // console.log("pool.accRewardPerShare: %s", pool.accRewardPerShare);

        user.pendingReward += pending;
        // console.log(
        //     "user.pendingReward: %s pending : %s",
        //     user.pendingReward,
        //     pending
        // );

        if (computeReward) {
            user.pendingAmountReward += computePendingAmountReward(
                pending,
                user.amount,
                mpInfo.staked
            );
        }

        if (claimReward) {
            rewardValue = rewarders[pid].onReward(
                to,
                user.pendingReward,
                payable(pool.feeCollector),
                pool.feeRatio,
                payable(platformFeeCollector),
                platformFeeRatio
            );
            emit Harvest(from_, pid, user.pendingReward);
            emit NCPHarvest(
                from_,
                pid,
                pool.name,
                pool.ncp,
                user.pendingReward,
                to
            );
            user.pendingReward = 0;
            user.pendingAmountReward = 0;
            user.lastRewardClaimed = block.number;

            user.rewardDebt =
                ((user.amount + userMPInfo[pid][from_].staked) *
                    poolInfo[pid].accRewardPerShare) /
                ACC_REWARD_PRECISION;
        }
    }

    /* =========== MODIFIER FUNCTIONS =========== */

    modifier nonZeroAddress(address inputAddress) {
        require(inputAddress != address(0), "STAKING: Address cannot be 0.");
        _;
    }

    modifier checkPoolExists(uint256 pid) {
        require(
            ncpToIdx[poolInfo[pid].ncp] != 0 &&
                ncpToIdx[poolInfo[pid].ncp] == pid,
            "STAKING: pool does not exist"
        );
        _;
    }

    modifier whenNotLock(uint256 pid) {
        require(!poolInfo[pid].lock, "STAKING: EMERGENCY!");
        _;
    }

    function computePendingAmountReward(
        uint256 pendingRewardAmount,
        uint256 lpAmount,
        uint256 mpAmount
    ) public pure returns (uint256) {
        if ((lpAmount + mpAmount) == 0) return 0;
        return (pendingRewardAmount * lpAmount) / (lpAmount + mpAmount);
    }
}
