import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "solidity-docgen";

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "./.env") });

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.9",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },

    paths: {
        sources: path.join(__dirname, "./contracts"),
    },
    networks: {
        hardhat: {
            accounts: {
                mnemonic: "test test test test test test test test test test test junk",
                initialIndex: 0,
                accountsBalance: "1000000000" + "0".repeat(18),
            },
            forking: {
                url: "https://api.test.wemix.com",
                //"http://127.0.0.1:9100",
            },
            allowUnlimitedContractSize: true,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            gasPrice: 111000000000,
        },
        dev: {
            accounts: [process.env.SK as string],
            url: "http://127.0.0.1:9100",
            gasPrice: 111000000000,
        },
        wtestnet: {
            accounts: [process.env.SK as string],
            url: "https://api.test.wemix.com",
            gasPrice: 111000000000,
        },
    },
    docgen: {
        pages: "files",
    },
    mocha: {
        timeout: 100000000,
    },
};

export default config;
