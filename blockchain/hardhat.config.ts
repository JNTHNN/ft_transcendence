import { config as dotenv } from "dotenv"; 
dotenv();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const { AVALANCHE_RPC_URL, PRIVATE_KEY } = process.env;

const cfg: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    fuji: {
      url: AVALANCHE_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 43113,
      gasPrice: 25000000000,
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 43114,
    },
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: "ABC123ABC123ABC123ABC123ABC123ABC1",
    },
  },
};

export default cfg;
