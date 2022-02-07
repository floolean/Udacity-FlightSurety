var HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

var useDocker = process.env['DOCKER'] || false;

module.exports = {
  networks: {
    development: {
      network_id: '*',
      gas: 6721975,
			host: "localhost",
			port: 7545
    },
		test: {
      network_id: '*',
      gas: 6721975,
			host: "localhost",
			port: 7545
    }
  },
  compilers: {
    solc: {
      version: "0.8.11",
			docker: true,
			settings: {
				optimizer: {
					enabled: true,
					runs: 10
				}
			}	
    }
  }
};	