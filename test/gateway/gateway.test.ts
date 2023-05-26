import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deploy } from "../../scripts/deploy_hardhat";
import { changeStaking } from "../../scripts/change_govstaking_hardhat";
import { IGov, IGovStaking, WithdrawalNFT } from "../../typechain-types";
import { BigNumber } from "ethers";
import * as fs from "fs";
import { getGov } from "../../scripts/get_govstaking_hardhat";

type Addr = {
    ncpStaking: string;
    rewarder: string[];
    govStaking: string;
    gov: string;
    ncp: string[];
    withdrawNFT: string;
    gateway: string;
    envStorage: string;
};

let address: Addr = { ncpStaking: "", rewarder: [], govStaking: "", gov: "", ncp: [], withdrawNFT: "", gateway: "", envStorage: "" };
const DAY7_BLOCK: Number = 604800;
const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const MainAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_mainnet.json").toString());
const devAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_dev.json").toString());
const signer = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", ethers.provider);

describe("deploy", async () => {
    it("change address", async () => {
        const { govStaking, envStorage, registry, gov, govMems } = await getGov();
        address.govStaking = govStaking.address;
        address.gov = gov.address;
        address.ncp[0] = govMems[0].address;
        address.ncp[1] = govMems[1].address;
        address.ncp[15] = govMems[15].address;
        address.ncp[17] = govMems[17].address;
        address.envStorage = envStorage.address;

        const NCPStaking = await ethers.getContractFactory("NCPStaking");
        const ncpStaking = await upgrades.deployProxy(NCPStaking, [address.gov, address.govStaking, DAY7_BLOCK, signer.address], { initializer: "initialize" });
        address.ncpStaking = ncpStaking.address;

        await govStaking.setNCPStaking(address.ncpStaking);
    });

    it("deploy rewarder", async () => {
        const Rewarder = await ethers.getContractFactory("Rewarder");
        const rewarder0 = await upgrades.deployProxy(Rewarder, [address.govStaking, address.ncpStaking, address.ncp[0]], { initializer: "initialize" });
        const rewarder1 = await upgrades.deployProxy(Rewarder, [address.govStaking, address.ncpStaking, address.ncp[1]], { initializer: "initialize" });
        address.rewarder[0] = rewarder0.address;
        address.rewarder[1] = rewarder1.address;
        const rewarder15 = await upgrades.deployProxy(Rewarder, [address.govStaking, address.ncpStaking, address.ncp[15]], { initializer: "initialize" });
        const rewarder17 = await upgrades.deployProxy(Rewarder, [address.govStaking, address.ncpStaking, address.ncp[17]], { initializer: "initialize" });
        address.rewarder[15] = rewarder15.address;
        address.rewarder[17] = rewarder17.address;
    });
    it("deploy withdrawNFT", async () => {
        const WithdrawalNFT = await ethers.getContractFactory("WithdrawalNFT");
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking);
        const withdrawalNFT = await upgrades.deployProxy(WithdrawalNFT, [address.ncpStaking], { initializer: "initialize" });
        address.withdrawNFT = withdrawalNFT.address;
        await NCPStaking.setWithdrawalNFT(address.withdrawNFT);
    });
    it("deploy gateway contract", async () => {
        const NCPstakingGateway = await ethers.getContractFactory("NCPStakingGateway");
        const gateway = await upgrades.deployProxy(
            NCPstakingGateway,
            [address.ncpStaking, address.gov, address.govStaking, address.withdrawNFT, address.envStorage, devAddr.gateWay_new],
            { initializer: "initialize" }
        );
        address.gateway = gateway.address;
    });
});

describe("add NCP", async () => {
    it("add NCP 0", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking);
        let ncp = address.ncp[0];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[0];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 1000;
        let initValue = "15" + "0".repeat(23);

        await NCPStaking.add(ncp, feeCollector, rewarder, mp, lock, breaker, breakerSetter, feeRatio, initValue);
        let poolLength = await NCPStaking.poolLength();
        expect(poolLength).greaterThan(0);
    });

    it("add NCP 1", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking);
        let ncp = address.ncp[1];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[1];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 2000;
        let initValue = "15" + "0".repeat(23);

        await NCPStaking.add(ncp, feeCollector, rewarder, mp, lock, breaker, breakerSetter, feeRatio, initValue);
        let poolLength = await NCPStaking.poolLength();
        expect(poolLength).greaterThan(1);
    });

    it("add NCP 15", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking);
        let ncp = address.ncp[15];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[15];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 2000;
        let initValue = "15" + "0".repeat(23);

        await NCPStaking.add(ncp, feeCollector, rewarder, mp, lock, breaker, breakerSetter, feeRatio, initValue);
        let poolLength = await NCPStaking.poolLength();
        expect(poolLength).greaterThan(1);
    });

    it("add NCP 17", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking);
        let ncp = address.ncp[17];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[17];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 2000;
        let initValue = "15" + "0".repeat(23);

        await NCPStaking.add(ncp, feeCollector, rewarder, mp, lock, breaker, breakerSetter, feeRatio, initValue);
        let poolLength = await NCPStaking.poolLength();
        expect(poolLength).greaterThan(1);
    });
});

describe("deposit", async () => {
    it("deposit to ncp 0", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 1;
        let amount = "8" + "0".repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await NCPStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);
    });

    it("deposit to ncp 1", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 2;
        let amount = "8" + "0".repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await NCPStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);
    });
    it("deposit to ncp 15", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 16;
        let amount = "8" + "0".repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await NCPStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);
    });

    it("deposit to ncp 17", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 18;
        let amount = "8" + "0".repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await NCPStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);
    });

    it("get reward", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid0 = 1;
        let pid1 = 2;
        let pid15 = 16;
        let pid17 = 18;
        let amount = "5" + "0".repeat(23);
        let to = signer.address;

        let tx0 = { value: "1" + "0".repeat(20), from: signer.address, to: address.rewarder[0] };
        let tx1 = { value: "1" + "0".repeat(20), from: signer.address, to: address.rewarder[1] };
        let tx15 = { value: "1" + "0".repeat(20), from: signer.address, to: address.rewarder[15] };
        let tx17 = { value: "1" + "0".repeat(20), from: signer.address, to: address.rewarder[17] };

        await NCPStaking.connect(signer).deposit(pid0, amount, to, false, false, { from: signer.address, value: amount });
        await NCPStaking.connect(signer).deposit(pid1, amount, to, false, false, { from: signer.address, value: amount });
        await NCPStaking.connect(signer).deposit(pid15, amount, to, false, false, { from: signer.address, value: amount });
        await NCPStaking.connect(signer).deposit(pid17, amount, to, false, false, { from: signer.address, value: amount });

        await signer.sendTransaction(tx0);
        await signer.sendTransaction(tx1);
        await signer.sendTransaction(tx15);
        await signer.sendTransaction(tx17);

        let afterPendingReward0 = await NCPStaking.pendingReward(pid0, signer.address);
        let afterPendingReward1 = await NCPStaking.pendingReward(pid1, signer.address);
        let afterPendingReward15 = await NCPStaking.pendingReward(pid15, signer.address);
        let afterPendingReward17 = await NCPStaking.pendingReward(pid17, signer.address);

        let userInfo0 = await NCPStaking.getUserInfo(pid0, to);
        let userInfo1 = await NCPStaking.getUserInfo(pid1, to);
        let userInfo15 = await NCPStaking.getUserInfo(pid15, to);
        let userInfo17 = await NCPStaking.getUserInfo(pid17, to);

        expect(userInfo0.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo1.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo0.pendingReward).to.equal(0);
        expect(userInfo1.pendingReward).to.equal(0);
        expect(afterPendingReward0).to.equal("85" + "0".repeat(18));
        expect(afterPendingReward1).to.equal("85" + "0".repeat(18));
        expect(userInfo15.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo17.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo15.pendingReward).to.equal(0);
        expect(userInfo17.pendingReward).to.equal(0);
        expect(afterPendingReward15).to.equal("85" + "0".repeat(18));
        expect(afterPendingReward17).to.equal("85" + "0".repeat(18));
    });
});

describe("PoolInfo", async () => {
    it("getNCPInfo", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getNCPInfo());
    });
});

describe.skip("deposit Info", async () => {
    it("get deposit amount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        expect(await NCPStakingGateway.getDepositAmount(1)).to.equal("1" + "0".repeat(25));
    });

    it("get deposit amount value", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getDepositAmountValue(1));
    });

    it("get total deposit amount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        expect(await NCPStakingGateway.getTotalDepositAmount()).to.equal("2" + "0".repeat(25));
    });
    it("get total deposit amount value", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getTotalDepositAmountValue());
    });

    it("getPoolAPR", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        let pid0 = 1;
        console.log(await NCPStakingGateway.computePoolAPR(pid0));
        let pid1 = 2;
        console.log(await NCPStakingGateway.computePoolAPR(pid1));
        let pid15 = 15;
        console.log(await NCPStakingGateway.computePoolAPR(pid15));
        let pid17 = 17;
        console.log(await NCPStakingGateway.computePoolAPR(pid17));
    });

    it("get user deposit or not", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        let depositList = await NCPStakingGateway.getUserDepositOrNot(signer.address);
        expect(depositList[0]).to.equal(true);
        expect(depositList[1]).to.equal(true);
    });

    it("getShareRatio", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getShareRatio(1));
    });

    it("getUserDepositAmount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserDepositAmount(signer.address));
    });

    it("getUserDepositAmount value", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserDepositAmountValue(signer.address));
    });

    it("getUserTotalDepositAmount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalDepositAmount(signer.address));
    });

    it("getUserTotalDepositValue", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalDepositValue(signer.address));
    });

    it("getUserPendingReward", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserPendingReward(signer.address));
    });

    it("getUserPendingRewardValue", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserPendingRewardValue(signer.address));
    });

    it("getUserTotalPendingReward", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalPendingReward(signer.address));
    });
    it("getUserTotalPendingRewardValue", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalPendingRewardValue(signer.address));
    });
    it("getUserAPR", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserAPR(signer.address));
    });
    it("getUserTotalAPR", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalAPR(signer.address));
    });
});

describe.skip("withdraw Info", async () => {
    before("generate withdraw NFT", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 1;
        let toPid = 1;
        let amount0 = "1" + "0".repeat(24);
        let amount1 = "1" + "0".repeat(23);
        let to = signer.address;
        let claimReward = false;
        let comp = false;

        await NCPStaking.connect(signer).withdrawRequest(pid, toPid, amount0, to, claimReward, comp);
        await NCPStaking.connect(signer).withdrawRequest(pid, toPid, amount1, to, claimReward, comp);
    });

    it("getUserWithdrawAmount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserWithdrawAmount(signer.address));
    });

    it("getUserTotalWithdrawAmount", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalWithdrawAmount(signer.address));
    });

    it("getUserWithdrawValue", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserWithdrawValue(signer.address));
    });

    it("getUserTotalWithdrawValue", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserTotalWithdrawValue(signer.address));
    });

    it("getUserWithdrawTime", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserWithdrawTime(signer.address));
    });
});

describe("userinfo", async () => {
    before("generate withdraw NFT", async () => {
        const NCPStaking = await ethers.getContractAt("NCPStaking", address.ncpStaking, signer);
        let pid = 1;
        let toPid = 1;
        let amount0 = "1" + "0".repeat(24);
        let amount1 = "1" + "0".repeat(23);
        let to = signer.address;
        let claimReward = false;
        let comp = false;

        await NCPStaking.connect(signer).withdrawRequest(pid, toPid, amount0, to, claimReward, comp);
        await NCPStaking.connect(signer).withdrawRequest(pid, toPid, amount1, to, claimReward, comp);
    });

    it("getUserInfo", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserInfo(signer.address));
        mine(86400);
        console.log(await NCPStakingGateway.getUserInfo(signer.address));
    });

    it("getUserWithdrawRequestInfo", async () => {
        const NCPStakingGateway = await ethers.getContractAt("NCPStakingGateway", address.gateway);
        console.log(await NCPStakingGateway.getUserWithdrawRequestInfo(signer.address));
    });
});
