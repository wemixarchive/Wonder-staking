import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deploy } from "../../scripts/deploy_hardhat_without_add";
import { changeStaking } from "../../scripts/change_govstaking_hardhat";
import { IGov, IGovStaking, WithdrawalNFT } from "../../typechain-types";
import { BigNumber } from "ethers";
import * as fs from "fs";

type Addr = { ncpStaking: string; rewarder: string[]; govStaking: string; gov: string; ncp: string[] };

let address: Addr = { ncpStaking: "", rewarder: [], govStaking: "", gov: "", ncp: [] };
const DAY7_BLOCK: Number = 604800;
const PLATFORM_FEE_COLLECTOR: string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e";
const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const MainAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_mainnet.json").toString());
const devAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_dev.json").toString());
const signer = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", ethers.provider);

describe("Claim", async () => {
    async function prepareClaim() {
        const { govStaking, envStorage, registry, gov, govMems } = await changeStaking();
        const { ncpStaking, withdrawalNFT, rewarders, sender } = await deploy(gov, govStaking, govMems);

        // add NCP 1
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 1000;
        let initValue = "15" + "0".repeat(23);

        await ncpStaking.add(govMems[0].address, govMems[0].address, rewarders[0].address, mp, lock, breaker, breakerSetter, feeRatio, initValue);

        //add NCP 2
        await ncpStaking.add(govMems[1].address, govMems[1].address, rewarders[1].address, mp, lock, breaker, breakerSetter, feeRatio, initValue);

        //add NCP 3
        await ncpStaking.add(govMems[2].address, govMems[2].address, rewarders[2].address, mp, lock, breaker, breakerSetter, feeRatio, initValue);

        //deposit to ncp 1
        let pid0 = 1;
        let pid1 = 2;
        let amount = ethers.utils.parseEther("8500000");
        let to = signer.address;
        await ncpStaking.connect(signer).deposit(pid0, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await ncpStaking.getUserInfo(pid0, to);
        expect(userInfo.amount).to.equal(amount);

        //deposit to ncp 2
        amount = ethers.utils.parseEther("8500000");
        await ncpStaking.connect(signer).deposit(pid1, amount, to, false, false, { from: signer.address, value: amount });
        userInfo = await ncpStaking.getUserInfo(pid1, to);
        expect(userInfo.amount).to.equal(amount);

        //get reward

        let tx0 = { value: ethers.utils.parseEther("100"), from: signer.address, to: rewarders[pid0 - 1].address };
        let tx1 = { value: ethers.utils.parseEther("100"), from: signer.address, to: rewarders[pid1 - 1].address };

        await signer.sendTransaction(tx0);
        await signer.sendTransaction(tx1);
        return { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender };
    }

    it("claim ncp 0", async () => {
        const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(prepareClaim);
        let pid0 = 1;
        let to = signer.address;
        let beforeBalance = await ethers.provider.getBalance(signer.address);
        let beforePendingReward = await ncpStaking.pendingReward(pid0, to);
        let poolInfo = await ncpStaking.getPoolInfo(pid0);
        let totalDeposit = poolInfo.totalDeposit;
        let userInfo = await ncpStaking.getUserInfo(pid0, to);
        let userAmount = userInfo.amount;
        let totalReward = await ethers.provider.getBalance(rewarders[pid0 - 1].address);
        expect(beforePendingReward).to.equal(totalReward.mul(userAmount).div(totalDeposit));
        await ncpStaking.connect(signer).claim(pid0, to);
        let afterPendingReward = await ncpStaking.pendingReward(pid0, to);
        let afterBalance = await ethers.provider.getBalance(signer.address);
        expect(afterPendingReward).to.equal(0);
        expect(beforeBalance).to.closeTo(afterBalance, beforePendingReward);
    });

    it("claim ncp 1", async () => {
        const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(prepareClaim);
        let pid1 = 2;
        let to = signer.address;
        let beforeBalance = await ethers.provider.getBalance(signer.address);
        let beforePendingReward = await ncpStaking.pendingReward(pid1, to);
        let poolInfo = await ncpStaking.getPoolInfo(pid1);
        let totalDeposit = poolInfo.totalDeposit;
        let userInfo = await ncpStaking.getUserInfo(pid1, to);
        let userAmount = userInfo.amount;
        let totalReward = await ethers.provider.getBalance(rewarders[pid1 - 1].address);
        expect(beforePendingReward).to.equal(totalReward.mul(userAmount).div(totalDeposit));
        await ncpStaking.connect(signer).claim(pid1, to);
        let afterPendingReward = await ncpStaking.pendingReward(pid1, to);
        let afterBalance = await ethers.provider.getBalance(signer.address);
        expect(afterPendingReward).to.equal(0);
        expect(beforeBalance).to.closeTo(afterBalance, beforePendingReward);
    });
});
