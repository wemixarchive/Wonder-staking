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

describe("Compound", async () => {
    async function prepareCompound() {
        const { govStaking, envStorage, registry, gov, govMems } = await changeStaking();
        const { ncpStaking, withdrawalNFT, rewarders, sender } = await deploy(gov, govStaking, govMems);

        // add NCP 1
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 0;
        let initValue = "15" + "0".repeat(23);

        await ncpStaking.add(govMems[0].address, govMems[0].address, rewarders[0].address, mp, lock, breaker, breakerSetter, feeRatio, initValue);

        feeRatio = 1000;
        //add NCP 2
        await ncpStaking.add(govMems[1].address, govMems[1].address, rewarders[1].address, mp, lock, breaker, breakerSetter, feeRatio, initValue);

        //deposit to ncp 1
        let pid = 1;
        let amount = ethers.utils.parseEther("8000000");
        let to = signer.address;
        await ncpStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        let userInfo = await ncpStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);

        //deposit to ncp 2
        pid = 2;
        amount = ethers.utils.parseEther("8000000");
        await ncpStaking.connect(signer).deposit(pid, amount, to, false, false, { from: signer.address, value: amount });
        userInfo = await ncpStaking.getUserInfo(pid, to);
        expect(userInfo.amount).to.equal(amount);

        //get reward
        let pid0 = 1;
        let pid1 = 2;
        amount = ethers.utils.parseEther("500000");

        let tx0 = { value: ethers.utils.parseEther("100"), from: signer.address, to: rewarders[0].address };
        let tx1 = { value: ethers.utils.parseEther("100"), from: signer.address, to: rewarders[1].address };

        await ncpStaking.connect(signer).deposit(pid0, amount, to, false, false, { from: signer.address, value: amount });
        await ncpStaking.connect(signer).deposit(pid1, amount, to, false, false, { from: signer.address, value: amount });

        await signer.sendTransaction(tx0);
        await signer.sendTransaction(tx1);

        let afterPendingReward0 = await ncpStaking.pendingReward(pid0, signer.address);
        let afterPendingReward1 = await ncpStaking.pendingReward(pid1, signer.address);

        let userInfo0 = await ncpStaking.getUserInfo(pid0, to);
        let userInfo1 = await ncpStaking.getUserInfo(pid1, to);

        expect(userInfo0.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo1.amount).to.equal("85" + "0".repeat(23));
        expect(userInfo0.pendingReward).to.equal(0);
        expect(userInfo1.pendingReward).to.equal(0);
        expect(afterPendingReward0).to.equal("85" + "0".repeat(18));
        expect(afterPendingReward1).to.equal("85" + "0".repeat(18));
        return { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender };
    }

    it("compound ncp0 ", async () => {
        const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(prepareCompound);
        let pid = 1;
        let user = signer.address;
        let beforePendingReward = await ncpStaking.pendingReward(pid, user);
        let beforeUserInfo = await ncpStaking.getUserInfo(pid, user);

        await ncpStaking.connect(signer).compound(pid, user);

        let afterPendingReward = await ncpStaking.pendingReward(pid, user);
        let afterUserInfo = await ncpStaking.getUserInfo(pid, user);

        let poolInfo = await ncpStaking.getPoolInfo(pid);

        expect(afterPendingReward).to.equal(0);
        expect(afterUserInfo.pendingReward).to.equal(0);
        expect(afterUserInfo.amount).to.equal(beforeUserInfo.amount.add(beforePendingReward).mul(10000 - poolInfo.feeRatio.toNumber()).div(10000));
    });

    it("compound ncp1 ", async () => {
        const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(prepareCompound);
        let pid = 2;
        let user = signer.address;
        let beforePendingReward = await ncpStaking.pendingReward(pid, user);
        let beforeUserInfo = await ncpStaking.getUserInfo(pid, user);

        await ncpStaking.connect(signer).compound(pid, user);

        let afterPendingReward = await ncpStaking.pendingReward(pid, user);
        let afterUserInfo = await ncpStaking.getUserInfo(pid, user);

        let poolInfo = await ncpStaking.getPoolInfo(pid);
        expect(afterPendingReward).to.equal(0);
        expect(afterUserInfo.pendingReward).to.equal(0);
        expect(afterUserInfo.amount).to.equal(beforeUserInfo.amount.add(beforePendingReward.mul(10000 - poolInfo.feeRatio.toNumber()).div(10000)));
    });
});
