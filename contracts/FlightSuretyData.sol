// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import "./FlightSuretyModel.sol";

contract FlightSuretyData {

	mapping(bytes32 => Model.Flight)  private flights;
	mapping(address => Model.Airline) private airlines;
	mapping(address => Model.Oracle) private oracles;
	mapping(bytes32 => Model.Insurance) insurances;
	address[] private oracleAddresses;
	address[] private airlineAddresses;
	address private contractOwner;                                      // Account used to deploy contract
	address private contractOwnerApp;                                   // Address of Owner App Contract
	bool private operational = false;


	constructor () 
	{
			contractOwner = msg.sender;
	}

	modifier requireOperational() 
	{
			require(operational, "Contract is currently not operational");
			_;
	}

	modifier requireContractOwner()
	{
		require(msg.sender == contractOwner, "Caller is not contract owner");
		_;
	}

	modifier requireContractOwnerApp()
	{
		require(msg.sender == contractOwnerApp, "Caller is not contract owner app");
		_;
	}

	modifier requireContractOwnerOrApp()
	{
		require(msg.sender == contractOwnerApp || msg.sender == contractOwner, "Caller is neither contract owner or contract owner app");
		_;
	}
	
	function isOperational() public view returns(bool) 
	{
		return operational;
	}

	function setContractOwner(address newOwner) public
	{
		require(msg.sender == contractOwner, "Contract owner can only be changed by current owner");
		require(newOwner != address(0), "New owner needs to be a valid address");
		contractOwner = newOwner;
	}

	function isContractOwner(address sender) external view returns (bool)
	{
		return sender == contractOwner;
	}

	function setContractOwnerApp(address newOwnerApp) external
	{
		require(msg.sender == contractOwner || msg.sender == contractOwnerApp, "Only contract owner or app owner");
		require(newOwnerApp != address(0), "New owner needs to be a valid address");
		contractOwnerApp = newOwnerApp;
	}

	function isContractOwnerApp(address sender) external view returns (bool)
	{
		return sender == contractOwnerApp;
	}

	function setOperatingStatus (bool mode) external
	requireContractOwnerOrApp
	{
			operational = mode;
	}

	function isAirline(address airline) external view
	returns(bool) {
		return airlines[airline].registered;
	}

	function setAirline(address airlineAddress, Model.Airline memory airline) external 
	requireContractOwnerApp
	{
		airlines[airlineAddress] = airline;
		if (airline.registered == false)
			return;
		bool found = false;
		for (uint i = 0; i < airlineAddresses.length; ++i)
		{
			if (airlineAddresses[i] == airlineAddress)
			{
				found = true;
				break;
			}
		}
		if (found == false)
		{
			airlineAddresses.push(airlineAddress);
		}
	}

	function getAirline(address airlineAddress) external view
	requireContractOwnerOrApp
	returns(Model.Airline memory airline) 
	{
		airline = airlines[airlineAddress];
	}

	function getAirlines(uint page) external view
	returns(Model.Airline[10] memory output) 
	{
		uint limit = 10;
		uint start = page * limit;
		for (uint i = 0; i < limit; ++i) 
		{
			uint index = start + i;
			Model.Airline memory airline = airlines[airlineAddresses[index]];
			output[i] = airline;
		}
	}

	function getAirlineCount() external view
	returns(uint) 
	{
		return airlineAddresses.length;
	}

	function getFlight(bytes32 flightKey) external view
	requireOperational
	returns(Model.Flight memory flight)
	{
		flight = flights[flightKey];
	}

	function setFlight(bytes32 flightKey, Model.Flight calldata flight) external
	requireOperational
	requireContractOwnerApp
	{
		flights[flightKey] = flight;
	}

	function getOracle(address oracleAddress) external view
	requireOperational
	returns(Model.Oracle memory oracle)
	{
		oracle = oracles[oracleAddress];
	}

	function setOracle(address oracleAddress, Model.Oracle calldata oracle) external
	requireOperational
	requireContractOwnerApp
	{
		oracles[oracleAddress] = oracle;
	}

	function getInsurance(bytes32 key) external view
	requireOperational
	returns(Model.Insurance memory insurance)
	{
		insurance = insurances[key];
	}

	function setInsurance(bytes32 key, Model.Insurance memory insurance) external
	requireOperational
	requireContractOwnerApp
	{
		insurances[key] = insurance;
	}

}

