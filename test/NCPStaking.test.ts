import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deploy } from "../scripts/deploy_hardhat";
import { changeStaking } from "../scripts/change_govstaking_hardhat";
import { WithdrawalNFT } from "../typechain-types";
import { BigNumber } from "ethers";
import { getGov } from "../scripts/get_govstaking_hardhat";

describe("NCP staking", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployNCPStaking() {
        const { govStaking, envStorage, registry, gov, govMems } = await getGov();
        const { ncpStaking, withdrawalNFT, rewarders, sender } = await deploy(gov, govStaking, govMems);
        await govStaking.setNCPStaking(ncpStaking.address);

        return { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender };
    }

    describe("Deployment", function () {
        describe("Deposit", async function () {
            it("Can deposit", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("100"), sender.address, false, false, { value: ethers.utils.parseEther("100") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("100")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("100")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("100")));
            });
            it("Can deposit2", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("8500000"), sender.address, false, false, { value: ethers.utils.parseEther("8500000") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-8500000"), ethers.utils.parseEther("8500000")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("8500000")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("8500000")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("8500000")));
                await govMems[0].sendTransaction({ value: ethers.utils.parseEther("100"), to: rewarders[0].address });

                await ncpStaking
                    .connect(sender)
                    .deposit(1, ethers.utils.parseEther("1"), sender.address, false, false, { value: ethers.utils.parseEther("1") });
                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                // console.log(await ncpStaking.pendingReward(1, sender.address));
                const userInfo = await ncpStaking.getUserInfo(1, sender.address);
                expect(userInfo.amount).to.equal(ethers.utils.parseEther("8500001"));
                expect(userInfo.rewardDebt).to.equal(ethers.utils.parseEther("85.00001"));
                expect(userInfo.pendingReward).to.equal(ethers.utils.parseEther("85"));
                expect(userInfo.pendingAmountReward).to.equal(ethers.utils.parseEther("85"));
            });
            it("Can govMem deposit", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                await expect(govStaking.connect(govMems[0]).deposit({ value: ethers.utils.parseEther("8500000") })).to.changeEtherBalances(
                    [govMems[0], govStaking],
                    [ethers.utils.parseEther("-8500000"), ethers.utils.parseEther("8500000")]
                );
                await govStaking.connect(govMems[0]).lockMore(ethers.utils.parseEther("8500000"));
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("8500000")));
                // expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("8500000")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("8500000")));
                await govMems[0].sendTransaction({ value: ethers.utils.parseEther("100"), to: rewarders[0].address });

                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                // console.log(await ncpStaking.pendingReward(1, sender.address));
                const userInfo = await ncpStaking.getUserInfo(1, govMems[0].address);
                expect(userInfo.amount).to.equal(ethers.utils.parseEther("10000000"));
            });
        });
        describe("Withdrawals", function () {
            it("Can withdraw", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("100"), sender.address, false, false, { value: ethers.utils.parseEther("100") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("100")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("100")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("100")));

                await expect(
                    ncpStaking.connect(sender).withdrawRequest(1, 1, ethers.utils.parseEther("100"), sender.address, false, false)
                ).to.changeEtherBalance(ncpStaking.address, ethers.utils.parseEther("100"));
                expect(await withdrawalNFT.balanceOf(sender.address)).to.be.equal(ethers.BigNumber.from(1));
                await mine(86400 * 7 + 100);
                let beforeUserBalance = await sender.getBalance();
                await expect(ncpStaking.connect(sender).withdraw(1, 0, sender.address)).to.changeEtherBalances([ncpStaking], [ethers.utils.parseEther("-100")]);
                let afterUserBalance = await sender.getBalance();
                expect(afterUserBalance).to.closeTo(beforeUserBalance, ethers.utils.parseEther("100"));
            });
            it("NCP cannot withdraw", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("100"), sender.address, false, false, { value: ethers.utils.parseEther("100") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("100")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("100")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("100")));
                beforeStakingAmount = afterStakingAmount;

                beforeUserAmount = afterUserAmount;
                beforeStakingUnlockAmount = afterStakingUnlockAmount;
                beforeStakingTotalAmount = afterStakingTotalAmount;

                await expect(ncpStaking.withdrawRequest(1, 1, ethers.utils.parseEther("100"), sender.address, false, false)).to.changeEtherBalance(
                    ncpStaking.address,
                    ethers.utils.parseEther("100")
                );
                expect(await withdrawalNFT.balanceOf(sender.address)).to.be.equal(ethers.BigNumber.from(1));
                await mine(86400 * 7 + 100);
                let beforeUserBalance = await sender.getBalance();
                await expect(ncpStaking.withdraw(1, 0, sender.address)).to.changeEtherBalances([ncpStaking], [ethers.utils.parseEther("-100")]);
                let afterUserBalance = await sender.getBalance();
                expect(afterUserBalance).to.closeTo(beforeUserBalance, ethers.utils.parseEther("100"));
            });
            it("cannot withdraw when unlock time is not reached", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("100"), sender.address, false, false, { value: ethers.utils.parseEther("100") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("100")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("100")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("100")));
                beforeStakingAmount = afterStakingAmount;

                beforeUserAmount = afterUserAmount;
                beforeStakingUnlockAmount = afterStakingUnlockAmount;
                beforeStakingTotalAmount = afterStakingTotalAmount;

                await expect(ncpStaking.withdrawRequest(1, 1, ethers.utils.parseEther("100"), sender.address, false, false)).to.changeEtherBalance(
                    ncpStaking.address,
                    ethers.utils.parseEther("100")
                );
                expect(await withdrawalNFT.balanceOf(sender.address)).to.be.equal(ethers.BigNumber.from(1));
                await expect(ncpStaking.withdraw(1, 0, sender.address)).to.be.revertedWith("WithdrawalNFT: no withdrawable token found");
            });
            it("Can withdraw all", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                await expect(
                    ncpStaking
                        .connect(sender)
                        .deposit(1, ethers.utils.parseEther("100"), sender.address, false, false, { value: ethers.utils.parseEther("100") })
                ).to.changeEtherBalances([sender, govStaking], [ethers.utils.parseEther("-100"), ethers.utils.parseEther("100")]);
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("100")));
                expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("100")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("100")));
                beforeStakingAmount = afterStakingAmount;

                beforeUserAmount = afterUserAmount;
                beforeStakingUnlockAmount = afterStakingUnlockAmount;
                beforeStakingTotalAmount = afterStakingTotalAmount;

                let userTokenList: BigNumber[] = [];
                for (let j = 0; j < 5; j++) {
                    await expect(ncpStaking.withdrawRequest(1, 1, ethers.utils.parseEther("10"), sender.address, false, false)).to.changeEtherBalance(
                        ncpStaking.address,
                        ethers.utils.parseEther("10")
                    );
                    userTokenList.push(ethers.BigNumber.from(j + 1));
                    expect(await withdrawalNFT.balanceOf(sender.address)).to.be.equal(ethers.BigNumber.from(j + 1));
                    await mine(3600);
                }
                await mine(86400 * 8 + 100);
                await expect(ncpStaking.withdrawRequest(1, 1, ethers.utils.parseEther("10"), sender.address, false, false)).to.changeEtherBalance(
                    ncpStaking.address,
                    ethers.utils.parseEther("10")
                );
                let withdrawableList = await withdrawalNFT.getWithdrawableTokenList(sender.address);
                for (let i = 0; i < withdrawableList.length; i++) {
                    expect(withdrawableList[i]).to.be.equal(userTokenList[i]);
                }
                userTokenList.push(ethers.BigNumber.from(6));
                withdrawableList = await withdrawalNFT.getUserTokenList(sender.address);
                for (let i = 0; i < withdrawableList.length; i++) {
                    expect(withdrawableList[i]).to.be.equal(userTokenList[i]);
                }
                let beforeUserBalance = await sender.getBalance();
                await expect(ncpStaking.withdrawAll(sender.address)).to.changeEtherBalances([ncpStaking], [ethers.utils.parseEther("-50")]);
                let afterUserBalance = await sender.getBalance();
                expect(afterUserBalance).to.closeTo(beforeUserBalance, ethers.utils.parseEther("50"));
                expect((await withdrawalNFT.getWithdrawableTokenList(sender.address)).length).to.be.equal(0);
                expect((await withdrawalNFT.getUserTokenList(sender.address))[0]).to.be.equal(ethers.BigNumber.from(6));
            });
            it.skip("NCP can withdraw", async function () {
                const { ncpStaking, withdrawalNFT, rewarders, govStaking, envStorage, registry, gov, govMems, sender } = await loadFixture(deployNCPStaking);
                let beforeStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let beforeUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                let beforeStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let beforeStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                await expect(govStaking.connect(govMems[0]).deposit({ value: ethers.utils.parseEther("8500000") })).to.changeEtherBalances(
                    [govMems[0], govStaking],
                    [ethers.utils.parseEther("-8500000"), ethers.utils.parseEther("8500000")]
                );
                await govStaking.connect(govMems[0]).lockMore(ethers.utils.parseEther("8500000"));
                let afterStakingAmount = await govStaking.lockedBalanceOf(govMems[0].address);
                let afterStakingUnlockAmount = await govStaking.availableBalanceOf(govMems[0].address);
                let afterStakingTotalAmount = await govStaking.balanceOf(govMems[0].address);
                let afterUserAmount = await govStaking.userBalanceOf(govMems[0].address, ncpStaking.address);
                expect(afterStakingAmount).to.equal(beforeStakingAmount.add(ethers.utils.parseEther("8500000")));
                // expect(afterUserAmount).to.equal(beforeUserAmount.add(ethers.utils.parseEther("8500000")));
                expect(afterStakingUnlockAmount).to.equal(beforeStakingUnlockAmount);
                expect(afterStakingTotalAmount).to.equal(beforeStakingTotalAmount.add(ethers.utils.parseEther("8500000")));
                await govMems[0].sendTransaction({ value: ethers.utils.parseEther("100"), to: rewarders[0].address });

                // console.log(await ncpStaking.getUserInfo(1, sender.address));
                // console.log(await ncpStaking.pendingReward(1, sender.address));
                const userInfo = await ncpStaking.getUserInfo(1, govMems[0].address);
                expect(userInfo.amount).to.equal(ethers.utils.parseEther("10000000"));

                console.log(ncpStaking.address);
                await expect(govStaking.connect(govMems[0]).withdraw(ethers.utils.parseEther('100'))).to.changeEtherBalances(
                    [ncpStaking, govStaking],
                    [ethers.utils.parseEther("100"), ethers.utils.parseEther("-100")]
                );

                expect(await withdrawalNFT.balanceOf(govMems[0].address)).to.be.equal(ethers.BigNumber.from(1));
                await mine(86400 * 7 + 100);
                let beforeUserBalance = await govMems[0].getBalance();
                await expect(ncpStaking.withdraw(1, 0, sender.address)).to.changeEtherBalances([ncpStaking], [ethers.utils.parseEther("-100")]);
                let afterUserBalance = await sender.getBalance();
                expect(afterUserBalance).to.closeTo(beforeUserBalance, ethers.utils.parseEther("100"));
            });
        });
    });
});
