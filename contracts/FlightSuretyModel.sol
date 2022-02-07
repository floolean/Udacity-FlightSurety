// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

library Model {

	struct Airline {
		uint funds;
		string name;
		uint256 created;
		bool registered;
	}

	struct Flight {
		string number;
		bool registered;
		uint8 statusCode;
		uint256 timestamp;       
		address airline;
	}

	struct Insurance {
		uint credit;
		bool registered;
		uint insuredAmount;
	}

	struct Oracle {
		bool registered;
		uint8[3] indexes;        
	}

	// Model for responses from oracles
	struct OracleRequestInfo {
		address requester;                              // Account that requested status
		bool open;                                    // If open, oracle responses are accepted         // Mapping key is the status code reported
	}

}


