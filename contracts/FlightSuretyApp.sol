// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

// import "./Voting.sol";
import "./Utils.sol";
import "./SafeMath.sol";
import "./FlightSuretyData.sol";
import "./FlightSuretyModel.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
	using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

	uint8 private oracleNonce = 0; 
	uint256 public constant ORACLE_REGISTRATION_FEE = 1 ether;
	uint256 public constant ORACLE_MIN_RESPONSES = 3;
	uint256 public constant AIRLINE_REGISTRATION_FEE = 10 ether;
	uint256 public constant MIN_INSURANCE = 100 wei;
	uint256 public constant MAX_INSURANCE = 1 ether;
	uint256 public constant INSURANCE_FACTOR = 150;

	// Flight status codees
	uint8 public constant STATUS_CODE_UNKNOWN = 0;
	uint8 public constant STATUS_CODE_ON_TIME = 10;
	uint8 public constant STATUS_CODE_LATE_AIRLINE = 20;
	uint8 public constant STATUS_CODE_LATE_WEATHER = 30;
	uint8 public constant STATUS_CODE_LATE_TECHNICAL = 40;
	uint8 public constant STATUS_CODE_LATE_OTHER = 50;

	address private contractOwner;         

	FlightSuretyData private data;

	mapping(address => address[]) private airlineVotings;
	mapping(bytes32 => Model.OracleRequestInfo) private oracleRequests;
	mapping(bytes32 => mapping(uint8 => address[])) private submittedOracleResponses;

	uint256 private constant MIN_RESPONSES = 3;
	event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);
	event OracleReport(address airline, string number, uint256 timestamp, uint8 status);
	event OracleRequest(uint8 index, address airline, string number, uint256 timestamp);
	event InsuranceBought(bytes32 insuranceKey, bytes32 flightKey, address account, uint insuredAmount);
	event InsuranceWithdrawalRequested(bytes32 insuranceKey, bytes32 flightKey, address account, uint credit);
	event InsuranceCreditWithdrawn(bytes32 insuranceKey, bytes32 flightKey, address account, uint amount);

	function isOperational() external view returns(bool) 
	{
		return data.isOperational();
	}

	function isOracle(address oracle) external view returns (bool)
	{
		return data.getOracle(oracle).registered;
	}

	function isFundedAirline(address airline) external view returns (bool)
	{
		return data.getAirline(airline).funds >= AIRLINE_REGISTRATION_FEE;
	}

	function isRegisteredAirline(address airline) external view returns (bool)
	{
		return data.getAirline(airline).registered;
	}

	modifier requireOperational() 
	{
		require(this.isOperational(), "Contract not operational");  
		_;  
	}

	modifier requireContractOwner()
	{
		require(msg.sender == contractOwner, "Not contract owner");
		_;
	}

	modifier requireFundedAirline()	
	{
		require(this.isFundedAirline(msg.sender), "Not a funded airline");
		_;
	}

	modifier requireRegisteredAirline()
	{
		require(this.isRegisteredAirline(msg.sender), "Not a registered airline");
		_;
	}

	modifier requireOracle()
	{
		require(this.isOracle(msg.sender), "Not a registered oracle");
		_;
	}

	constructor (address dataContract) 
	{
		contractOwner = msg.sender;
		data = FlightSuretyData(dataContract);
	}

	function setOperatingStatus(bool mode) external 
	requireContractOwner
	{
		data.setOperatingStatus(mode);
	}

	function fund () external
	requireRegisteredAirline 
	payable
	{
		Model.Airline memory airline = data.getAirline(msg.sender);
		airline.funds = airline.funds.add(msg.value);
		data.setAirline(msg.sender, airline);
	}

	function transferDataContractOwnership(address newDataContractOwner) public
	requireContractOwner
	{
		data.setContractOwnerApp(newDataContractOwner);
		payable(newDataContractOwner).transfer(address(this).balance);
	}

	function registerAirline(address airlineAddress, string memory airlineName) external
	requireOperational
	returns(bool success, uint voteCount)
	{
		require((data.getAirline(msg.sender).registered && data.getAirline(msg.sender).funds >= AIRLINE_REGISTRATION_FEE) || (msg.sender == contractOwner), "Caller must be either contract owner or a registered and funded airline.");
		
		Model.Airline memory airline = data.getAirline(airlineAddress);
		uint airlineCount = data.getAirlineCount();
 
		if (airline.created == 0)
		{
			airline = Model.Airline({
				name: airlineName,
				funds: 0,
				registered: false,
				created: block.timestamp
			});
			data.setAirline(airlineAddress,airline);
		}
		if (airlineCount < 4) 
		{
			airline.registered = true;
			data.setAirline(airlineAddress,airline);
			return (true,1);
		}
		else 
		{
			require(data.getAirline(msg.sender).funds >= AIRLINE_REGISTRATION_FEE, "Airline must be funded to be able to vote");
			require(airline.registered == false, "Airline is already registered");

			address[] storage votes = airlineVotings[airlineAddress];

			for(uint i = 0; i < votes.length; i++) {
				address addr = votes[i];
				require(addr != msg.sender, "Voter has already voted for airline");
    	}
			votes.push(msg.sender);
			voteCount = votes.length;
			success = voteCount >= ((airlineCount)/2);
			if (success) {
				airline.registered = true;
				delete airlineVotings[airlineAddress];
				data.setAirline(airlineAddress,airline);
			}
			else {
				airlineVotings[airlineAddress] = votes;
			}
		}
	}

	function registerFlight(string memory flightNumber, uint256 timestamp) external
	requireOperational  
	requireFundedAirline
	requireRegisteredAirline                 
	{

		bytes32 flightKey = this.getFlightKey(msg.sender,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		require(flight.registered == false, "Flight already exists");

		flight = Model.Flight({
			registered: true,
			airline: msg.sender,
			number: flightNumber,
			timestamp: timestamp,
			statusCode: STATUS_CODE_UNKNOWN
		});

		data.setFlight(flightKey, flight);

	}

	function registerOracle() external payable
	requireOperational
	{
		require(msg.value >= ORACLE_REGISTRATION_FEE, "Registration fee required");
		Model.Oracle memory oracle = data.getOracle(msg.sender);
		require(oracle.registered == false, "Oracle already registered");
		uint8[3] memory indexes = generateIndexes(msg.sender);
		oracle = Model.Oracle({
														registered: true,
														indexes: indexes
													});
		data.setOracle(msg.sender,oracle);
	}

	function fetchFlightStatus (address airline, string memory flightNumber, uint256 timestamp) external
	requireOperational  
	{
		bytes32 flightKey = this.getFlightKey(airline,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		require(flight.registered == true, "Flight does not exists");
		require(flight.statusCode == STATUS_CODE_UNKNOWN, "Flight status code has already been set");
		uint8 index = getRandomIndex(msg.sender);
		bytes32 requestKey = keccak256(abi.encodePacked(index, airline, flightNumber, timestamp));
		oracleRequests[requestKey] = Model.OracleRequestInfo({
																					requester: msg.sender,
																					open: true
																				});

		emit OracleRequest(index, airline, flightNumber, timestamp);
	} 

	function submitOracleResponse(uint8 index, address airline, string memory flightNumber, uint256 timestamp, uint8 statusCode) external
	requireOperational
	requireOracle
	{
		Model.Oracle memory oracle = data.getOracle(msg.sender);
		require(oracle.registered == true, "Oracle is not registered");
		require((oracle.indexes[0] == index) || (oracle.indexes[1] == index) || (oracle.indexes[2] == index), "Index does not match oracle request");

		bytes32 flightKey = this.getFlightKey(airline,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		require(flight.registered == true, "Flight does not exists");
		require(flight.statusCode == STATUS_CODE_UNKNOWN, "Flight status code has already been set");
		
		bytes32 requestKey = keccak256(abi.encodePacked(index, airline, flightNumber, timestamp)); 
		Model.OracleRequestInfo storage request = oracleRequests[requestKey];
		require(request.open, "Flight or timestamp do not match any oracle request");
		mapping(uint8 => address[]) storage responses = submittedOracleResponses[requestKey];

		responses[statusCode].push(msg.sender);

		emit OracleReport(airline, flightNumber, timestamp, statusCode);

		if (responses[statusCode].length >= ORACLE_MIN_RESPONSES) 
		{
			request.open = false;
			processFlightStatus(airline, flightNumber, timestamp, statusCode);
		}
	}

	function processFlightStatus (address airline, string memory flightNumber, uint256 timestamp, uint8 statusCode) internal 
	requireOperational                              
	{
		bytes32 flightKey = this.getFlightKey(airline,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		flight.statusCode = statusCode;
		data.setFlight(flightKey,flight);
		emit FlightStatusInfo(airline, flightNumber, timestamp, statusCode);
	}

	function buyInsurance(address airline, string memory flightNumber, uint256 timestamp) public 
	requireOperational
	payable 
	{
		require(msg.value >= MIN_INSURANCE && msg.value <= MAX_INSURANCE, "Invalid insurance value");
		bytes32 flightKey = Utils.getFlightKey(airline,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		require(flight.registered == true, "Flight could not be found");
		require(flight.statusCode == STATUS_CODE_UNKNOWN, "Flight status already known");
		bytes32 insuranceKey = Utils.getInsuranceKey(flightKey,msg.sender);
		Model.Insurance memory insurance = data.getInsurance(insuranceKey);
		require(insurance.registered == false, "Insurance already exists for this flight");
		insurance = Model.Insurance({
			credit: 0,
			registered: true,
			insuredAmount: msg.value
		});
		data.setInsurance(insuranceKey,insurance);
		emit InsuranceBought(insuranceKey,flightKey,msg.sender,msg.value);
	}

	function requestInsuranceWithdrawal(address airline, string memory flightNumber, uint256 timestamp) public 
	requireOperational 
	{
		bytes32 flightKey = Utils.getFlightKey(airline,flightNumber,timestamp);
		Model.Flight memory flight = data.getFlight(flightKey);
		require(flight.registered == true, "Flight could not be found");
		require(flight.statusCode != STATUS_CODE_UNKNOWN, "Flight status still unknown");
		require(flight.statusCode == STATUS_CODE_LATE_AIRLINE, "Flight status is not STATUS_CODE_LATE_AIRLINE, no insurance withdrawal allowed");
		bytes32 insuranceKey = Utils.getInsuranceKey(flightKey,msg.sender);
		Model.Insurance memory insurance = data.getInsurance(insuranceKey);
		require(insurance.registered == true, "You do not own insurance for this flight");
		require(insurance.insuredAmount > 0, "Insurance has already been withdrawn");
		insurance.credit = insurance.insuredAmount.div(100).mul(INSURANCE_FACTOR);
		insurance.insuredAmount = 0;
		data.setInsurance(insuranceKey,insurance);
		emit InsuranceWithdrawalRequested(insuranceKey, flightKey, msg.sender, insurance.credit);
	}

	function withdrawInsurance(address airline, string memory flightNumber, uint256 timestamp) public 
	requireOperational 
	{
		bytes32 flightKey = Utils.getFlightKey(airline,flightNumber,timestamp);
		bytes32 insuranceKey = Utils.getInsuranceKey(flightKey,msg.sender);
		Model.Insurance memory insurance = data.getInsurance(insuranceKey);
		require(insurance.registered == true, "You do not own insurance for this flight");
		require(insurance.credit > 0 && insurance.insuredAmount == 0, "Insurance has already been withdrawn or a withdraw request was not submitted");
		uint credit = insurance.credit;
		insurance.credit = 0;
		data.setInsurance(insuranceKey, insurance);
		payable(msg.sender).transfer(credit);
		emit InsuranceCreditWithdrawn(insuranceKey, flightKey, msg.sender, credit);
	}

	function getFlightKey(address airline, string memory flightNumber, uint256 timestamp) external pure
	returns(bytes32) 
	{
		return Utils.getFlightKey(airline, flightNumber, timestamp);
	}

	function getInsuranceKey(bytes32 flightKey) external view
	returns(bytes32) 
	{
		return Utils.getInsuranceKey(flightKey, msg.sender);
	}

	function generateIndexes(address account) internal 
	returns(uint8[3] memory)
	{
		uint8[3] memory indexes;
		indexes[0] = getRandomIndex(account);
		
		indexes[1] = indexes[0];
		while(indexes[1] == indexes[0]) 
		{
			indexes[1] = getRandomIndex(account);
		}

		indexes[2] = indexes[1];
		while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) 
		{
			indexes[2] = getRandomIndex(account);
		}

		return indexes;
	}

	function getRandomIndex(address account) internal 
	returns (uint8)
	{
		uint8 maxValue = 10;
		uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - oracleNonce++), account))) % maxValue);
		if (oracleNonce > 250) 
		{
			oracleNonce = 0;
		}
		return random;
	}

	function getMyIndexes() external view
	requireOperational
	returns(uint8[3] memory)
	{
		Model.Oracle memory oracle = data.getOracle(msg.sender);
		require(oracle.registered, "Not registered as an oracle");
		return oracle.indexes;
	}

	fallback () external
	{

	}

}   
