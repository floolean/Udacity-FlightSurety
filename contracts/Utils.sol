// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

library Utils {

	function getFlightKey(address airline, string memory flightNumber, uint256 timestamp) public pure
	returns(bytes32) 
	{
		return keccak256(abi.encodePacked(airline, flightNumber, timestamp));
	}

	function getInsuranceKey(bytes32 flightKey, address account) public pure
	returns(bytes32) 
	{
		return keccak256(abi.encodePacked(flightKey, account));
	} 

}


